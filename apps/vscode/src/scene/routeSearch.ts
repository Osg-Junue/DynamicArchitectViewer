import type { RouteEdge, RouteNode } from './route';
import { type Grid, type Lane, PORT_REACH, stationCenter } from './routeGrid';

/** What the 1st, 2nd, and 3rd+ turns cost, as a length. */
const BEND_COSTS = [40, 52, 115] as const;
/** A length inside a zone the link has nothing to do with counts this many times. */
const THROUGH = 4;
/** A level length through the room of a node's badge counts this many times. */
const UNDER_BADGE = 1.25;
/** What crossing another unrelated route costs, as a length. */
const CROSS = 160;
/** What leaving a node downwards costs: that route starts below the node's labels, away from its station. */
const OWN_LABELS = 30;
/** Extra cost to use the top port of a node whose self-loop sits at its upper right. */
const LOOP_TOP_PORT_COST = 40;
/**
 * The least a rail runs straight near a node's outline/labels before turning, so the arrowhead
 * and rounded corner have room, and what a turn nearer than that costs.
 */
const ARROW_ROOM = 18;
const SHORT_END = 180;
/** What each unit off the middle of a station costs a route that meets it there. */
const PORT_COST = 2;

/** Right, down, left, up: a heading `d` moves `DX[d]` columns and `DY[d]` rows. */
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const RIGHT = 0;
const DOWN = 1;
const LEFT = 2;
const UP = 3;

/** A binary heap of states by their estimated total cost, the least first. */
class CostHeap {
  readonly #cost: number[] = [];
  readonly #state: number[] = [];

  get size(): number {
    return this.#cost.length;
  }

  /** The cost of the state `pop` returns next. */
  get least(): number {
    return this.#cost[0] as number;
  }

  clear(): void {
    this.#cost.length = 0;
    this.#state.length = 0;
  }

  push(cost: number, state: number): void {
    const costs = this.#cost;
    const states = this.#state;
    let i = costs.length;
    costs.push(cost);
    states.push(state);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((costs[parent] as number) <= cost) break;
      costs[i] = costs[parent] as number;
      states[i] = states[parent] as number;
      i = parent;
    }
    costs[i] = cost;
    states[i] = state;
  }

  pop(): number {
    const costs = this.#cost;
    const states = this.#state;
    const top = states[0] as number;
    const cost = costs.pop() as number;
    const state = states.pop() as number;
    const n = costs.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = i * 2 + 1;
        if (child >= n) break;
        if (child + 1 < n && (costs[child + 1] as number) < (costs[child] as number)) child++;
        if ((costs[child] as number) >= cost) break;
        costs[i] = costs[child] as number;
        states[i] = states[child] as number;
        i = child;
      }
      costs[i] = cost;
      states[i] = state;
    }
    return top;
  }
}

/** The first of the sorted `values` that is no less than `value`; their number when none is. */
function lowerBound(values: readonly number[], value: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** For a crossing where a node's links may start or end: what each heading costs there. */
type Doors = Map<number, Float64Array>;

/**
 * Finds the cheapest way over the grid for one link at a time (A*). A state is a crossing,
 * the heading it was reached with, and the number of turns taken so far (capped at 3), numbered
 * `(crossing * 4 + heading) * 4 + turns`, so progressive bend costs stay exact.
 */
export class RouteSearch {
  readonly #grid: Grid;
  readonly #nodes: readonly RouteNode[];
  readonly #edgeEnds: ReadonlyArray<readonly [number, number]>;
  readonly #best: Float64Array;
  readonly #cameFrom: Int32Array;
  /** The search that last wrote a state: `#best` and `#cameFrom` of an earlier one do not count. */
  readonly #stamp: Uint32Array;
  readonly #heap = new CostHeap();
  #run = 0;
  /** For the link being searched: 1 for every route that shares a station with it. */
  readonly #friend: Uint8Array;
  /**
   * What `#crowding` and `#crossed` answered in this search, for level and for upright
   * stretches and headings: a stretch is reached with every heading and number of turns, and
   * the answer is the same each time.
   */
  readonly #crowd: readonly [Float64Array, Float64Array];
  readonly #crowdRun: readonly [Uint32Array, Uint32Array];
  /** The search a crossing was last a door of the goal in, or near enough to an end to ask `#turnsAtEnd`. */
  readonly #goalRun: Uint32Array;
  readonly #endRun: Uint32Array;
  /** The search a zone was last one of the link's own in. */
  readonly #homeRun: Uint32Array;

  constructor(
    grid: Grid,
    nodes: readonly RouteNode[],
    edgeEnds: ReadonlyArray<readonly [number, number]> = [],
  ) {
    const states = grid.W * grid.H * 16;
    this.#grid = grid;
    this.#nodes = nodes;
    this.#edgeEnds = edgeEnds;
    this.#best = new Float64Array(states);
    this.#cameFrom = new Int32Array(states);
    this.#stamp = new Uint32Array(states);
    const size = grid.W * grid.H;
    this.#friend = new Uint8Array(edgeEnds.length);
    this.#crowd = [new Float64Array(size), new Float64Array(size)];
    this.#crowdRun = [new Uint32Array(size), new Uint32Array(size)];
    this.#goalRun = new Uint32Array(size);
    this.#endRun = new Uint32Array(size);
    let zones = 0;
    for (const lane of [grid.level, grid.upright]) {
      for (const zone of lane.zone) if (zone >= zones) zones = zone + 1;
    }
    this.#homeRun = new Uint32Array(zones);
  }

  /** Notes the crossings round node `k` where a turn may be too near it: the others need no asking. */
  #markEnd(k: number): void {
    const { xs, ys, W } = this.#grid;
    const { station, area } = this.#nodes[k] as RouteNode;
    const reach = ARROW_ROOM + 2;
    const bottom = area.y + area.height + reach;
    for (let iy = lowerBound(ys, station.y - reach); iy < ys.length; iy++) {
      if ((ys[iy] as number) > bottom) break;
      for (let ix = lowerBound(xs, station.x - reach); ix < xs.length; ix++) {
        if ((xs[ix] as number) > station.x + station.width + reach) break;
        this.#endRun[iy * W + ix] = this.#run;
      }
    }
  }

  /**
   * Where a node's links may start or end, with the directions they may run there and what
   * each costs: anywhere from the middle of the station, and level or upright from a point a
   * little off it.
   */
  #doors(k: number, incoming: boolean): Doors {
    const { ports, xIndex, yIndex, W } = this.#grid;
    const node = this.#nodes[k] as RouteNode;
    const c = stationCenter(node);
    const result: Doors = new Map();
    const door = (x: number, y: number, ways: readonly number[]) => {
      const ix = xIndex.get(x);
      const iy = yIndex.get(y);
      if (ix === undefined || iy === undefined) return;
      const costs = new Float64Array(4).fill(Number.POSITIVE_INFINITY);
      for (const way of ways) {
        let extra = 0;
        if (node.hasLoop && ((incoming && way === DOWN) || (!incoming && way === UP))) {
          extra = LOOP_TOP_PORT_COST;
        }
        costs[way] = (Math.abs(x - c.x) + Math.abs(y - c.y)) * PORT_COST + extra;
      }
      result.set(iy * W + ix, costs);
    };
    for (const y of ports[k]?.ys ?? []) if (y !== c.y) door(c.x, y, [0, 2]);
    for (const x of ports[k]?.xs ?? []) if (x !== c.x) door(x, c.y, [1, 3]);
    door(c.x, c.y, [0, 1, 2, 3]);
    return result;
  }

  /** How dearer a stretch is based on friendly (shared-endpoint) vs unrelated routes on it. */
  #crowding(lane: Lane, which: 0 | 1, stretch: number): number {
    const used = lane.use[stretch] as number;
    if (used === 0) return 0;
    if (this.#crowdRun[which][stretch] === this.#run) return this.#crowd[which][stretch] as number;
    const list = lane.routes[stretch];
    let cost: number;
    if (!list) cost = used <= 2 ? used * 0.05 : 0.1 + (used - 2) * 0.5;
    else {
      const friend = this.#friend;
      let friendly = 0;
      for (const idx of list) if (friend[idx] === 1) friendly++;
      const unrelated = list.length - friendly;
      const fCost = friendly <= 3 ? friendly * 0.06 : 0.18 + (friendly - 3) * 0.25;
      const uCost = unrelated <= 2 ? unrelated * 0.35 : 0.7 + (unrelated - 2) * 0.65;
      cost = fCost + uCost;
    }
    this.#crowdRun[which][stretch] = this.#run;
    this.#crowd[which][stretch] = cost;
    return cost;
  }

  #crossingsAtDivergence(state: number, p: number, d: number, nd: number): number {
    const vList = this.#grid.vertexRoutes[p];
    if (!vList) return 0;
    const friend = this.#friend;
    const w1 = (d + 2) & 3;
    const w2 = nd;
    let count = 0;
    for (let m = 0; m < vList.length; m++) {
      const entry = vList[m] as number;
      const idx = entry >> 4;
      if (friend[idx] === 1) continue;
      const u1 = (((entry >> 2) & 3) + 2) & 3;
      const u2 = entry & 3;
      if (w2 === u1 || w2 === u2) continue;
      if (w1 !== u1 && w1 !== u2) {
        if (u2 === ((u1 + 2) & 3) && w2 === ((w1 + 2) & 3)) count++;
        continue;
      }
      const fk = d;
      const aOut = u1 === w1 ? u2 : u1;
      const sideOutB = w2 === fk ? 0 : w2 === ((fk + 3) & 3) ? -1 : 1;
      const sideOutA = aOut === fk ? 0 : aOut === ((fk + 3) & 3) ? -1 : 1;
      let curState = this.#cameFrom[state] as number;
      let f0 = d;
      const vRoutes = this.#grid.vertexRoutes;
      while (curState !== -1) {
        const curP = curState >> 4;
        const d0 = (curState >> 2) & 3;
        const bBack = (d0 + 2) & 3;
        const curList = vRoutes[curP];
        let entry0 = -1;
        if (curList) {
          for (let j = 0; j < curList.length; j++) {
            const e0 = curList[j] as number;
            if (e0 >> 4 === idx) {
              entry0 = e0;
              break;
            }
          }
        }
        if (entry0 < 0) break;
        const u10 = (((entry0 >> 2) & 3) + 2) & 3;
        const u20 = entry0 & 3;
        const aBack = u10 === f0 ? u20 : u10;
        const prevState = this.#cameFrom[curState] as number;
        if (bBack === aBack && prevState !== -1) {
          f0 = d0;
          curState = prevState;
          continue;
        }
        const sideInB = bBack === ((f0 + 2) & 3) ? 0 : bBack === ((f0 + 3) & 3) ? -1 : 1;
        const sideInA = aBack === ((f0 + 2) & 3) ? 0 : aBack === ((f0 + 3) & 3) ? -1 : 1;
        if (Math.sign(sideInB - sideInA) !== Math.sign(sideOutB - sideOutA)) count++;
        break;
      }
    }
    return count;
  }

  /**
   * Whether a rail turning at (`x`, `y`) with heading `way` into node `k` leaves less than
   * `ARROW_ROOM` to where the rail is cut at `k`.
   */
  #turnsAtEnd(k: number, x: number, y: number, way: number): boolean {
    const { station, area } = this.#nodes[k] as RouteNode;
    const inX = x >= station.x && x <= station.x + station.width;
    const inY = y >= station.y && y <= station.y + station.height;
    if (inX && inY) return true;
    const bottom = area.y + area.height;
    if (inX) {
      if (way === UP) return y >= bottom && y - (bottom + 2) < ARROW_ROOM;
      if (way === DOWN) return y <= station.y && station.y - 2 - y < ARROW_ROOM;
    }
    if (inY) {
      if (way === LEFT) {
        const right = station.x + station.width;
        return x >= right && x - (right + 2) < ARROW_ROOM;
      }
      if (way === RIGHT) return x <= station.x && station.x - 2 - x < ARROW_ROOM;
    }
    return false;
  }

  /** The crossings a route passes, from its start to its end; undefined when there is no way. */
  find(edge: RouteEdge): number[] | undefined {
    const grid = this.#grid;
    const { xs, ys, W, H, vertexUse } = grid;
    const best = this.#best;
    const cameFrom = this.#cameFrom;
    const stamp = this.#stamp;
    const heap = this.#heap;
    const goal = stationCenter(this.#nodes[edge.to] as RouteNode);
    const starts = this.#doors(edge.from, false);
    const goals = this.#doors(edge.to, true);
    // What is left at least from crossing `p`. A door may be nearer than the middle of the
    // station by its reach.
    const rest = (p: number) =>
      Math.max(
        0,
        Math.abs((xs[p % W] as number) - goal.x) +
          Math.abs((ys[(p / W) | 0] as number) - goal.y) -
          PORT_REACH,
      );
    const run = ++this.#run;
    const friend = this.#friend;
    this.#edgeEnds.forEach((ends, idx) => {
      friend[idx] =
        ends[0] === edge.from || ends[0] === edge.to || ends[1] === edge.from || ends[1] === edge.to
          ? 1
          : 0;
    });
    const goalRun = this.#goalRun;
    const endRun = this.#endRun;
    const homeRun = this.#homeRun;
    for (const q of goals.keys()) goalRun[q] = run;
    for (const zone of edge.home) if (zone < homeRun.length) homeRun[zone] = run;
    this.#markEnd(edge.from);
    this.#markEnd(edge.to);
    // The turns still to come at least, from where the doors of the goal are: none where one
    // is straight ahead, one where a line through one crosses the way ahead, else two. Counting
    // them keeps a search from trying every staircase that is as long as the straight way.
    const levelDoor = new Uint8Array(H);
    const uprightDoor = new Uint8Array(W);
    let minLevel = H;
    let maxLevel = -1;
    let minUpright = W;
    let maxUpright = -1;
    for (const [q, costs] of goals) {
      const qx = q % W;
      const qy = (q / W) | 0;
      if (Number.isFinite(costs[RIGHT] as number)) {
        levelDoor[qy] = 1;
        minLevel = Math.min(minLevel, qy);
        maxLevel = Math.max(maxLevel, qy);
      }
      if (Number.isFinite(costs[DOWN] as number)) {
        uprightDoor[qx] = 1;
        minUpright = Math.min(minUpright, qx);
        maxUpright = Math.max(maxUpright, qx);
      }
    }
    const goalX = this.#grid.xIndex.get(goal.x) ?? 0;
    const goalY = this.#grid.yIndex.get(goal.y) ?? 0;
    const turnsLeft = (p: number, d: number): number => {
      const ix = p % W;
      const iy = (p / W) | 0;
      if (d === RIGHT) {
        if (levelDoor[iy] === 1 && goalX >= ix) return 0;
        return maxUpright >= ix ? 1 : 2;
      }
      if (d === LEFT) {
        if (levelDoor[iy] === 1 && goalX <= ix) return 0;
        return minUpright <= ix ? 1 : 2;
      }
      if (d === DOWN) {
        if (uprightDoor[ix] === 1 && goalY >= iy) return 0;
        return maxLevel >= iy ? 1 : 2;
      }
      if (uprightDoor[ix] === 1 && goalY <= iy) return 0;
      return minLevel <= iy ? 1 : 2;
    };
    /** What is left at least from a state: the way to the goal, and the turns it must still take. */
    const left = (p: number, d: number, turns: number): number => {
      const more = turnsLeft(p, d);
      return (
        rest(p) +
        (more === 0
          ? 0
          : more === 1
            ? (BEND_COSTS[Math.min(2, turns)] as number)
            : (BEND_COSTS[Math.min(2, turns)] as number) +
              (BEND_COSTS[Math.min(2, turns + 1)] as number))
      );
    };
    heap.clear();
    for (const [start, costs] of starts) {
      for (let d = 0; d < 4; d++) {
        const cost = costs[d] as number;
        if (!Number.isFinite(cost)) continue;
        const state = (start * 4 + d) * 4;
        best[state] = cost;
        cameFrom[state] = -1;
        stamp[state] = run;
        heap.push(cost + left(start, d, 0), state);
      }
    }
    while (heap.size > 0) {
      const estimate = heap.least;
      const state = heap.pop();
      const p = state >> 4;
      const d = (state >> 2) & 3;
      const turns = state & 3;
      const cost = best[state] as number;
      // A cheaper way to this state was found after this entry was pushed.
      if (estimate > cost + left(p, d, turns) + 1e-6) continue;
      const leaving = cameFrom[state] === -1;
      if (
        !leaving &&
        goalRun[p] === run &&
        Number.isFinite(goals.get(p)?.[d] ?? Number.POSITIVE_INFINITY)
      ) {
        const path: number[] = [];
        for (let s = state; s !== -1; s = cameFrom[s] as number) path.push(s >> 4);
        return path.reverse();
      }
      const ix = p % W;
      const iy = (p / W) | 0;
      for (let nd = 0; nd < 4; nd++) {
        // No turning back, and a route leaves its station in a straight line.
        if (nd === (d + 2) % 4 || (leaving && nd !== d)) continue;
        const nx = ix + (DX[nd] as number);
        const ny = iy + (DY[nd] as number);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const level = nd % 2 === 0;
        const lane = level ? grid.level : grid.upright;
        const stretch = level ? iy * W + Math.min(ix, nx) : Math.min(iy, ny) * W + ix;
        const blocker = lane.block[stretch] as number;
        if (blocker === -2) continue;
        if (blocker >= 0) {
          // A node lets only its own links in, and only along the lines of its doors.
          const own = blocker === edge.from || blocker === edge.to;
          if (!own || lane.door[stretch] === 0) continue;
        }
        const length = level
          ? Math.abs((xs[nx] as number) - (xs[ix] as number))
          : Math.abs((ys[ny] as number) - (ys[iy] as number));
        const zone = lane.zone[stretch] as number;
        const foreign = zone >= 0 && homeRun[zone] !== run;
        let step =
          length *
          (foreign ? THROUGH : 1) *
          (lane.badge[stretch] === 1 ? UNDER_BADGE : 1) *
          (1 + this.#crowding(lane, level ? 0 : 1, stretch));
        let nextTurns = turns;
        if (nd !== d) {
          step += BEND_COSTS[Math.min(2, turns)] as number;
          nextTurns = Math.min(3, turns + 1);
          if (endRun[p] === run) {
            const x = xs[ix] as number;
            const y = ys[iy] as number;
            // Turning right outside either station hides the rail under the arrowhead or corner.
            if (this.#turnsAtEnd(edge.to, x, y, nd)) step += SHORT_END;
            if (this.#turnsAtEnd(edge.from, x, y, (d + 2) % 4)) step += SHORT_END;
          }
        }
        const q = ny * W + nx;
        const arrival =
          goalRun[q] === run
            ? (goals.get(q)?.[nd] ?? Number.POSITIVE_INFINITY)
            : Number.POSITIVE_INFINITY;
        if (!leaving && vertexUse[p] !== 0) {
          step += CROSS * this.#crossingsAtDivergence(state, p, d, nd);
        }
        if (Number.isFinite(arrival)) step += arrival + (nd === UP ? OWN_LABELS : 0);
        if (leaving && nd === DOWN) step += OWN_LABELS;
        const next = (q * 4 + nd) * 4 + nextTurns;
        const total = cost + step;
        if (stamp[next] === run && (best[next] as number) <= total) continue;
        // The same crossing and heading reached with fewer turns for no more: whatever
        // follows from here costs no less than it does from there.
        let dominated = false;
        for (let fewer = next - nextTurns; fewer < next; fewer++) {
          if (stamp[fewer] === run && (best[fewer] as number) <= total && cameFrom[fewer] !== -1) {
            dominated = true;
            break;
          }
        }
        if (dominated) continue;
        stamp[next] = run;
        best[next] = total;
        cameFrom[next] = state;
        heap.push(total + left(q, nd, nextTurns), next);
      }
    }
    return undefined;
  }
}
