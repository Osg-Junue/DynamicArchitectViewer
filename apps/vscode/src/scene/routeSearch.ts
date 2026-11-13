import type { RouteEdge, RouteNode } from './route';
import { type Grid, PORT_REACH, stationCenter } from './routeGrid';

/** What a turn costs, as a length. */
const BEND = 36;
/** A length inside a zone the link has nothing to do with counts this many times. */
const THROUGH = 4;
/** What crossing another route costs, as a length. */
const CROSS = 90;
/** What leaving a node downwards costs: that route starts below the node's labels, away from its station. */
const OWN_LABELS = 30;
/** What each unit off the middle of a station costs a route that meets it there. */
const PORT_COST = 2;

/** Right, down, left, up: a heading `d` moves `DX[d]` columns and `DY[d]` rows. */
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const DOWN = 1;
const UP = 3;

/** How much dearer a line gets with each route already on it. */
const crowding = (use: number): number => (use <= 2 ? use * 0.05 : 0.1 + (use - 2) * 0.5);

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
 * Finds the cheapest way over the grid for one link at a time (A*). A state is a crossing and
 * the heading it was reached with, numbered `crossing * 4 + heading`, because a turn costs extra.
 */
export class RouteSearch {
  readonly #grid: Grid;
  readonly #nodes: readonly RouteNode[];
  readonly #best: Float64Array;
  readonly #cameFrom: Int32Array;
  /** The search that last wrote a state: `#best` and `#cameFrom` of an earlier one do not count. */
  readonly #stamp: Uint32Array;
  readonly #heap = new CostHeap();
  #run = 0;

  constructor(grid: Grid, nodes: readonly RouteNode[]) {
    const states = grid.W * grid.H * 4;
    this.#grid = grid;
    this.#nodes = nodes;
    this.#best = new Float64Array(states);
    this.#cameFrom = new Int32Array(states);
    this.#stamp = new Uint32Array(states);
  }

  /**
   * Where a node's links may start or end, with the directions they may run there and what
   * each costs: anywhere from the middle of the station, and level or upright from a point a
   * little off it.
   */
  #doors(k: number): Doors {
    const { ports, xIndex, yIndex, W } = this.#grid;
    const c = stationCenter(this.#nodes[k] as RouteNode);
    const result: Doors = new Map();
    const door = (x: number, y: number, ways: readonly number[]) => {
      const ix = xIndex.get(x);
      const iy = yIndex.get(y);
      if (ix === undefined || iy === undefined) return;
      const costs = new Float64Array(4).fill(Number.POSITIVE_INFINITY);
      for (const way of ways) costs[way] = (Math.abs(x - c.x) + Math.abs(y - c.y)) * PORT_COST;
      result.set(iy * W + ix, costs);
    };
    for (const y of ports[k]?.ys ?? []) if (y !== c.y) door(c.x, y, [0, 2]);
    for (const x of ports[k]?.xs ?? []) if (x !== c.x) door(x, c.y, [1, 3]);
    door(c.x, c.y, [0, 1, 2, 3]);
    return result;
  }

  /** How many routes go straight on through crossing `q`, across the way of a route heading there. */
  #crossed(q: number, level: boolean, nx: number, ny: number): number {
    const { W } = this.#grid;
    const { use } = level ? this.#grid.upright : this.#grid.level;
    const before = level
      ? ny > 0
        ? (use[q - W] as number)
        : 0
      : nx > 0
        ? (use[q - 1] as number)
        : 0;
    return Math.min(before, use[q] as number);
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
    const starts = this.#doors(edge.from);
    const goals = this.#doors(edge.to);
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
        const state = start * 4 + d;
        best[state] = cost;
        cameFrom[state] = -1;
        stamp[state] = run;
        heap.push(cost + rest(start), state);
      }
    }
    while (heap.size > 0) {
      const estimate = heap.least;
      const state = heap.pop();
      const p = state >> 2;
      const d = state & 3;
      const cost = best[state] as number;
      // A cheaper way to this state was found after this entry was pushed.
      if (estimate > cost + rest(p) + 1e-6) continue;
      const leaving = cameFrom[state] === -1;
      if (!leaving && Number.isFinite(goals.get(p)?.[d] ?? Number.POSITIVE_INFINITY)) {
        const path: number[] = [];
        for (let s = state; s !== -1; s = cameFrom[s] as number) path.push(s >> 2);
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
        let step = length * (foreign ? THROUGH : 1) * (1 + crowding(lane.use[stretch] as number));
        if (nd !== d) step += BEND;
        const q = ny * W + nx;
        const arrival = goals.get(q)?.[nd] ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(arrival)) step += arrival + (nd === UP ? OWN_LABELS : 0);
        else step += CROSS * this.#crossed(q, level, nx, ny);
        if (leaving && nd === DOWN) step += OWN_LABELS;
        const next = q * 4 + nd;
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
