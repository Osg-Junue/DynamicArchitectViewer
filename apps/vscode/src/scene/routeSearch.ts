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
  #crowding(lane: Lane, stretch: number, edge: RouteEdge): number {
    const used = lane.use[stretch] as number;
    if (used === 0) return 0;
    const list = lane.routes[stretch];
    if (!list) return used <= 2 ? used * 0.05 : 0.1 + (used - 2) * 0.5;
    let friendly = 0;
    let unrelated = 0;
    for (const idx of list) {
      const ends = this.#edgeEnds[idx];
      if (
        ends &&
        (ends[0] === edge.from ||
          ends[0] === edge.to ||
          ends[1] === edge.from ||
          ends[1] === edge.to)
      ) {
        friendly++;
      } else {
        unrelated++;
      }
    }
    const fCost = friendly <= 3 ? friendly * 0.06 : 0.18 + (friendly - 3) * 0.25;
    const uCost = unrelated <= 2 ? unrelated * 0.35 : 0.7 + (unrelated - 2) * 0.65;
    return fCost + uCost;
  }

  /**
   * How many unrelated routes go straight through crossing `p`, across a route heading there.
   * Friendly routes that share an endpoint with `edge` part without crossing.
   */
  #crossed(p: number, level: boolean, ix: number, iy: number, edge: RouteEdge): number {
    const { W, H } = this.#grid;
    const perp = level ? this.#grid.upright : this.#grid.level;
    const before = level ? (iy > 0 ? p - W : -1) : ix > 0 ? p - 1 : -1;
    const after = level ? (iy < H - 1 ? p : -1) : ix < W - 1 ? p : -1;
    if (before < 0 || after < 0) return 0;
    const bUse = perp.use[before] as number;
    const aUse = perp.use[after] as number;
    if (bUse === 0 || aUse === 0) return 0;
    const bList = perp.routes[before];
    const aList = perp.routes[after];
    if (!bList || !aList) return Math.min(bUse, aUse);
    let count = 0;
    for (const idx of bList) {
      if (!aList.includes(idx)) continue;
      const ends = this.#edgeEnds[idx];
      if (
        ends &&
        (ends[0] === edge.from ||
          ends[0] === edge.to ||
          ends[1] === edge.from ||
          ends[1] === edge.to)
      ) {
        continue;
      }
      count++;
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
    const { xs, ys, W, H } = grid;
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
    heap.clear();
    for (const [start, costs] of starts) {
      for (let d = 0; d < 4; d++) {
        const cost = costs[d] as number;
        if (!Number.isFinite(cost)) continue;
        const state = (start * 4 + d) * 4;
        best[state] = cost;
        cameFrom[state] = -1;
        stamp[state] = run;
        heap.push(cost + rest(start), state);
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
      if (estimate > cost + rest(p) + 1e-6) continue;
      const leaving = cameFrom[state] === -1;
      if (!leaving && Number.isFinite(goals.get(p)?.[d] ?? Number.POSITIVE_INFINITY)) {
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
        const foreign = zone >= 0 && !edge.home.has(zone);
        let step =
          length *
          (foreign ? THROUGH : 1) *
          (lane.badge[stretch] === 1 ? UNDER_BADGE : 1) *
          (1 + this.#crowding(lane, stretch, edge));
        let nextTurns = turns;
        if (nd !== d) {
          step += BEND_COSTS[Math.min(2, turns)] as number;
          nextTurns = Math.min(3, turns + 1);
          const x = xs[ix] as number;
          const y = ys[iy] as number;
          // Turning right outside either station hides the rail under the arrowhead or corner.
          if (this.#turnsAtEnd(edge.to, x, y, nd)) step += SHORT_END;
          if (this.#turnsAtEnd(edge.from, x, y, (d + 2) % 4)) step += SHORT_END;
        }
        const q = ny * W + nx;
        const arrival = goals.get(q)?.[nd] ?? Number.POSITIVE_INFINITY;
        // Charge half on leaving `p` and half on entering `q` so a 1-cell Z-jog cannot dodge a crossing.
        if (!leaving) step += 0.5 * CROSS * this.#crossed(p, level, ix, iy, edge);
        if (Number.isFinite(arrival)) step += arrival + (nd === UP ? OWN_LABELS : 0);
        else step += 0.5 * CROSS * this.#crossed(q, level, nx, ny, edge);
        if (leaving && nd === DOWN) step += OWN_LABELS;
        const next = (q * 4 + nd) * 4 + nextTurns;
        const total = cost + step;
        if (stamp[next] === run && (best[next] as number) <= total) continue;
        stamp[next] = run;
        best[next] = total;
        cameFrom[next] = state;
        heap.push(total + rest(q), next);
      }
    }
    return undefined;
  }
}
