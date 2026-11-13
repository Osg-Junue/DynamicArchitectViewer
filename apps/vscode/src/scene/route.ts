/**
 * Right-angled routes for rails.
 *
 * Every route runs on a grid made of the lines that pass through each station and beside each
 * node and zone. A route is the cheapest way over that grid, where turning, crossing another
 * route and passing through a zone it has nothing to do with all cost extra. Routes that end up
 * on the same line are then moved apart, so each rail stays a line of its own.
 */
import type { Rect } from '../layout';
import type { Point } from './geometry';

export interface RouteNode {
  /** The station symbol: a route starts and ends at its center. */
  station: Rect;
  /** The station with its labels: no other node's route may enter it. */
  area: Rect;
}
export interface RouteGroup {
  rect: Rect;
  depth: number;
}
export interface RouteEdge {
  id: string;
  from: number;
  to: number;
  /** The zones around either end: passing through any other zone costs extra. */
  home: ReadonlySet<number>;
}
interface Ports {
  xs: Set<number>;
  ys: Set<number>;
}

export interface RoutedRail {
  /** Start, corners and end. */
  points: Point[];
  /** For each stretch between two points: another route runs beside it. */
  shared: boolean[];
}

/** How far beside a node, and beside a zone's border, a line of the grid runs. */
const NODE_MARGIN = 8;
const ZONE_MARGIN = 12;
/** Lines of the grid nearer than this become one. */
const MERGE = 3;
/** What a turn costs, as a length. */
const BEND = 36;
/** A length inside a zone the link has nothing to do with counts this many times. */
const THROUGH = 4;
/** What crossing another route costs, as a length. */
const CROSS = 90;
/** What leaving a node downwards costs: that route starts below the node's labels, away from its station. */
const OWN_LABELS = 30;
/** Distance between two routes on one line, and the most a group of them may take up. */
const GAP = 7;
const PORT_WIDTH = 28;
/**
 * How far off the middle of a station a route may meet it, to reach in a straight line a station
 * that is almost level with it or almost straight above it; and what each unit of that costs.
 */
const PORT_REACH = 12;
const PORT_COST = 2;
const BUNDLE_WIDTH = 42;

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/** Sorted lines of the grid; a line through a station is kept as it is. */
function gridLines(marks: Array<[number, boolean]>): number[] {
  marks.sort((a, b) => a[0] - b[0]);
  const out: Array<[number, boolean]> = [];
  for (const mark of marks) {
    const last = out[out.length - 1];
    if (!last || mark[0] - last[0] >= MERGE) out.push(mark);
    else if (mark[1] && !last[1]) out[out.length - 1] = mark;
    else if (mark[1] && last[1] && mark[0] !== last[0]) out.push(mark);
  }
  return out.map((m) => m[0]);
}

/** How much dearer a line gets with each route already on it. */
const crowding = (use: number): number => (use <= 2 ? use * 0.05 : 0.1 + (use - 2) * 0.5);

export function routeEdges(
  nodes: readonly RouteNode[],
  groups: readonly RouteGroup[],
  walls: readonly Rect[],
  edges: readonly RouteEdge[],
): Map<string, RoutedRail> {
  const center = (n: RouteNode): Point => ({
    x: n.station.x + n.station.width / 2,
    y: n.station.y + n.station.height / 2,
  });
  const xMarks: Array<[number, boolean]> = [];
  const yMarks: Array<[number, boolean]> = [];
  for (const n of nodes) {
    const c = center(n);
    xMarks.push(
      [c.x, true],
      [n.area.x - NODE_MARGIN, false],
      [n.area.x + n.area.width + NODE_MARGIN, false],
    );
    yMarks.push(
      [c.y, true],
      [n.area.y - NODE_MARGIN, false],
      [n.area.y + n.area.height + NODE_MARGIN, false],
    );
  }
  for (const g of groups) {
    for (const side of [-ZONE_MARGIN, ZONE_MARGIN]) {
      xMarks.push([g.rect.x + side, false], [g.rect.x + g.rect.width + side, false]);
      yMarks.push([g.rect.y + side, false], [g.rect.y + g.rect.height + side, false]);
    }
  }
  for (const w of walls) {
    xMarks.push([w.x + w.width + 4, false]);
    yMarks.push([w.y + w.height + 4, false]);
  }
  const xs = gridLines(xMarks);
  const ys = gridLines(yMarks);
  const W = xs.length;
  const H = ys.length;
  const size = W * H;

  // One entry per stretch of a line between two neighboring crossings: `h…` for the stretch
  // to the right of a crossing, `v…` for the one below it.
  const hBlock = new Int32Array(size).fill(-1);
  const vBlock = new Int32Array(size).fill(-1);
  const hCenter = new Uint8Array(size);
  const vCenter = new Uint8Array(size);
  const hZone = new Int16Array(size).fill(-1);
  const vZone = new Int16Array(size).fill(-1);
  const hUse = new Uint8Array(size);
  const vUse = new Uint8Array(size);

  const mark = (
    block: Int32Array,
    onCenter: Uint8Array,
    i: number,
    who: number,
    centered: boolean,
  ) => {
    if (block[i] === -1) {
      block[i] = who;
      onCenter[i] = centered ? 1 : 0;
    } else if (block[i] !== who) block[i] = -2;
  };
  /**
   * Closes every stretch inside `box`: to all routes (`who` -2), or to all but a node's own,
   * which may enter along the lines of `own`.
   */
  const close = (box: Rect, who: number, own?: Ports) => {
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    for (let iy = 0; iy < H; iy++) {
      const y = ys[iy] as number;
      for (let ix = 0; ix < W; ix++) {
        const x = xs[ix] as number;
        const i = iy * W + ix;
        if (ix < W - 1 && y > box.y && y < bottom && (xs[ix + 1] as number) > box.x && x < right) {
          mark(hBlock, hCenter, i, who, own?.ys.has(y) ?? false);
        }
        if (iy < H - 1 && x > box.x && x < right && (ys[iy + 1] as number) > box.y && y < bottom) {
          mark(vBlock, vCenter, i, who, own?.xs.has(x) ?? false);
        }
      }
    }
  };
  // The lines a node's links may meet it on: those through the middle of its station, and
  // those through a linked station that is only a little off them.
  const ports: Ports[] = nodes.map((n) => {
    const c = center(n);
    return { xs: new Set([c.x]), ys: new Set([c.y]) };
  });
  for (const e of edges) {
    const a = center(nodes[e.from] as RouteNode);
    const b = center(nodes[e.to] as RouteNode);
    if (a.y !== b.y && Math.abs(a.y - b.y) <= PORT_REACH) {
      ports[e.from]?.ys.add(b.y);
      ports[e.to]?.ys.add(a.y);
    }
    if (a.x !== b.x && Math.abs(a.x - b.x) <= PORT_REACH) {
      ports[e.from]?.xs.add(b.x);
      ports[e.to]?.xs.add(a.x);
    }
  }
  nodes.forEach((n, k) => {
    close(n.area, k, ports[k]);
  });
  for (const w of walls) close(w, -2);

  const inside = (r: Rect, x: number, y: number) =>
    x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height;
  // The innermost zone around each stretch: deeper zones are written last.
  for (const k of groups
    .map((_, i) => i)
    .sort((a, b) => (groups[a]?.depth ?? 0) - (groups[b]?.depth ?? 0))) {
    const rect = (groups[k] as RouteGroup).rect;
    for (let iy = 0; iy < H; iy++) {
      for (let ix = 0; ix < W; ix++) {
        const x = xs[ix] as number;
        const y = ys[iy] as number;
        const i = iy * W + ix;
        if (ix < W - 1 && inside(rect, (x + (xs[ix + 1] as number)) / 2, y)) hZone[i] = k;
        if (iy < H - 1 && inside(rect, x, (y + (ys[iy + 1] as number)) / 2)) vZone[i] = k;
      }
    }
  }

  const xIndex = new Map(xs.map((x, i) => [x, i]));
  const yIndex = new Map(ys.map((y, i) => [y, i]));
  const best = new Float64Array(size * 4);
  const cameFrom = new Int32Array(size * 4);
  const stamp = new Uint32Array(size * 4);
  let run = 0;

  // A binary heap of states by estimated total cost.
  const heapCost: number[] = [];
  const heapState: number[] = [];
  const push = (cost: number, state: number) => {
    let i = heapCost.length;
    heapCost.push(cost);
    heapState.push(state);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if ((heapCost[parent] as number) <= cost) break;
      heapCost[i] = heapCost[parent] as number;
      heapState[i] = heapState[parent] as number;
      i = parent;
    }
    heapCost[i] = cost;
    heapState[i] = state;
  };
  const pop = (): number => {
    const top = heapState[0] as number;
    const cost = heapCost.pop() as number;
    const state = heapState.pop() as number;
    const n = heapCost.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = i * 2 + 1;
        if (child >= n) break;
        if (child + 1 < n && (heapCost[child + 1] as number) < (heapCost[child] as number)) child++;
        if ((heapCost[child] as number) >= cost) break;
        heapCost[i] = heapCost[child] as number;
        heapState[i] = heapState[child] as number;
        i = child;
      }
      heapCost[i] = cost;
      heapState[i] = state;
    }
    return top;
  };

  /**
   * Where a node's links may start or end, with the directions they may run there (right, down,
   * left, up) and what each costs: anywhere from the middle of the station, and level or
   * upright from a point a little off it.
   */
  const doors = (k: number): Map<number, Float64Array> => {
    const c = center(nodes[k] as RouteNode);
    const result = new Map<number, Float64Array>();
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
  };

  /** The crossings a route passes, from its start to its end; undefined when there is no way. */
  const find = (edge: RouteEdge): number[] | undefined => {
    const b = center(nodes[edge.to] as RouteNode);
    const starts = doors(edge.from);
    const goals = doors(edge.to);
    // A door may be nearer than the middle of the station by its reach.
    const rest = (p: number) =>
      Math.max(
        0,
        Math.abs((xs[p % W] as number) - b.x) +
          Math.abs((ys[(p / W) | 0] as number) - b.y) -
          PORT_REACH,
      );
    run++;
    heapCost.length = 0;
    heapState.length = 0;
    for (const [start, costs] of starts) {
      for (let d = 0; d < 4; d++) {
        const cost = costs[d] as number;
        if (!Number.isFinite(cost)) continue;
        const state = start * 4 + d;
        best[state] = cost;
        cameFrom[state] = -1;
        stamp[state] = run;
        push(cost + rest(start), state);
      }
    }
    while (heapCost.length > 0) {
      const estimate = heapCost[0] as number;
      const state = pop();
      const p = state >> 2;
      const d = state & 3;
      const cost = best[state] as number;
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
        const across = nd % 2 === 0;
        const stretch = across ? iy * W + Math.min(ix, nx) : Math.min(iy, ny) * W + ix;
        const blocker = (across ? hBlock : vBlock)[stretch] as number;
        if (blocker === -2) continue;
        if (blocker >= 0) {
          // A node lets only its own links in, and only along the lines of its doors.
          const own = blocker === edge.from || blocker === edge.to;
          if (!own || (across ? hCenter : vCenter)[stretch] === 0) continue;
        }
        const length = across
          ? Math.abs((xs[nx] as number) - (xs[ix] as number))
          : Math.abs((ys[ny] as number) - (ys[iy] as number));
        const zone = (across ? hZone : vZone)[stretch] as number;
        const foreign = zone >= 0 && !edge.home.has(zone);
        let step =
          length *
          (foreign ? THROUGH : 1) *
          (1 + crowding((across ? hUse : vUse)[stretch] as number));
        if (nd !== d) step += BEND;
        const q = ny * W + nx;
        const arrival = goals.get(q)?.[nd] ?? Number.POSITIVE_INFINITY;
        if (Number.isFinite(arrival)) {
          step += arrival + (nd === 3 ? OWN_LABELS : 0);
        } else {
          // Another route that goes straight on through this crossing, the other way.
          const before = across
            ? ny > 0
              ? (vUse[q - W] as number)
              : 0
            : nx > 0
              ? (hUse[q - 1] as number)
              : 0;
          const after = across ? (vUse[q] as number) : (hUse[q] as number);
          step += CROSS * Math.min(before, after);
        }
        if (leaving && nd === 1) step += OWN_LABELS;
        const next = q * 4 + nd;
        const total = cost + step;
        if (stamp[next] === run && (best[next] as number) <= total) continue;
        stamp[next] = run;
        best[next] = total;
        cameFrom[next] = state;
        push(total + rest(q), next);
      }
    }
    return undefined;
  };

  const at = (p: number): Point => ({ x: xs[p % W] as number, y: ys[(p / W) | 0] as number });
  const reach = (e: RouteEdge) => {
    const a = center(nodes[e.from] as RouteNode);
    const b = center(nodes[e.to] as RouteNode);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };
  const lay = (path: readonly number[], by: 1 | -1) => {
    for (let i = 0; i + 1 < path.length; i++) {
      const p = path[i] as number;
      const q = path[i + 1] as number;
      const use = Math.abs(p - q) === 1 ? hUse : vUse;
      const stretch = Math.min(p, q);
      use[stretch] = Math.max(0, Math.min(255, (use[stretch] as number) + by));
    }
  };
  // Short links first: they have the least room to give way.
  const order = [...edges].sort((a, b) => reach(a) - reach(b));
  const paths = new Map<string, number[]>();
  for (const edge of order) {
    const path = find(edge);
    if (!path) continue;
    lay(path, 1);
    paths.set(edge.id, path);
  }
  const stretchKey = (p: number, q: number) =>
    `${Math.abs(p - q) === 1 ? 'h' : 'v'}${Math.min(p, q)}`;
  const found = new Map<string, Found>();
  for (const [id, path] of paths) {
    const corners: Point[] = [];
    const cover: string[][] = [];
    path.forEach((point, k) => {
      const prev = path[k - 1];
      const next = path[k + 1];
      const straight = prev !== undefined && next !== undefined && point - prev === next - point;
      if (!straight) {
        corners.push(at(point));
        if (next !== undefined) cover.push([]);
      }
      if (next !== undefined) cover[cover.length - 1]?.push(stretchKey(point, next));
    });
    found.set(id, { corners, cover });
  }

  return apart(found, sides(paths, W, stretchKey), edges, nodes);
}

interface Found {
  corners: Point[];
  /** For each stretch between two corners, the stretches of the grid it runs on. */
  cover: string[][];
}

/**
 * Which of two routes goes on which side, wherever they run on the same line.
 *
 * Two routes that run together keep their sides for as long as they do, round every corner:
 * the one that turns off to the left at the end of the shared run is the left one all along.
 * The result maps `a|b|stretch` to the sign of a's distance from the line minus b's.
 */
function sides(
  paths: Map<string, number[]>,
  W: number,
  stretchKey: (p: number, q: number) => string,
): Map<string, number> {
  // Right, down, left, up.
  const heading = (p: number, q: number) =>
    q - p === 1 ? 0 : q - p === W ? 1 : q - p === -1 ? 2 : 3;
  const on = new Map<string, Array<{ id: string; at: number }>>();
  for (const [id, path] of paths) {
    for (let k = 0; k + 1 < path.length; k++) {
      const key = stretchKey(path[k] as number, path[k + 1] as number);
      on.set(key, [...(on.get(key) ?? []), { id, at: k }]);
    }
  }
  const rank = new Map([...paths.keys()].map((id, k) => [id, k]));
  const result = new Map<string, number>();
  // -1 when `out` leaves to the left of someone facing `facing`, 1 to the right, 0 straight on or not at all.
  const turn = (out: number | undefined, facing: number) =>
    out === undefined || out === facing ? 0 : out === (facing + 3) % 4 ? -1 : 1;
  for (const [a, pathA] of paths) {
    for (let k = 0; k + 1 < pathA.length; k++) {
      const key = stretchKey(pathA[k] as number, pathA[k + 1] as number);
      for (const other of on.get(key) ?? []) {
        const b = other.id;
        if ((rank.get(b) ?? 0) <= (rank.get(a) ?? 0) || result.has(`${a}|${b}|${key}`)) continue;
        const pathB = paths.get(b) as number[];
        // b may run along the shared stretch the other way.
        const step = pathB[other.at] === pathA[k] ? 1 : -1;
        const inB = (inA: number) => (step === 1 ? other.at : other.at + 1) + (inA - k) * step;
        let lo = k;
        let hi = k + 1;
        while (lo > 0 && pathB[inB(lo - 1)] === pathA[lo - 1]) lo--;
        while (hi + 1 < pathA.length && pathB[inB(hi + 1)] === pathA[hi + 1]) hi++;
        const from = (point: number, next: number | undefined) =>
          next === undefined ? undefined : heading(point, next);
        // Where each goes on from the far end of the run, as seen by someone travelling with a...
        const ahead = heading(pathA[hi - 1] as number, pathA[hi] as number);
        const far =
          turn(from(pathA[hi] as number, pathA[hi + 1]), ahead) -
          turn(from(pathA[hi] as number, pathB[inB(hi) + step]), ahead);
        // ...and where each came from, as seen by someone looking back: left and right swap.
        const back = heading(pathA[lo + 1] as number, pathA[lo] as number);
        const near =
          turn(from(pathA[lo] as number, pathB[inB(lo) - step]), back) -
          turn(from(pathA[lo] as number, pathA[lo - 1]), back);
        // -1: a is on the left of b, for someone travelling with a. With nothing to tell them
        // apart, any side will do, as long as it is the same one all along.
        const left = Math.sign(far) || Math.sign(near) || -1;
        for (let m = lo; m < hi; m++) {
          const d = heading(pathA[m] as number, pathA[m + 1] as number);
          // Travelling right or up, the left is the side of the smaller coordinate.
          const sign = d === 0 || d === 3 ? left : -left;
          const shared = stretchKey(pathA[m] as number, pathA[m + 1] as number);
          result.set(`${a}|${b}|${shared}`, sign);
          result.set(`${b}|${a}|${shared}`, -sign);
        }
      }
    }
  }
  return result;
}

interface Stretch {
  id: string;
  index: number;
  lo: number;
  hi: number;
  cover: string[];
  /** Which way the route turns off this stretch at each end: -1, 0 (it ends at a node) or 1. */
  lean: number;
  /** Ends at a station. */
  port: boolean;
  offset: number;
  shared: boolean;
}

/** Moves the routes that run on one line apart, and cuts each route at its stations' edges. */
function apart(
  found: Map<string, Found>,
  side: Map<string, number>,
  edges: readonly RouteEdge[],
  nodes: readonly RouteNode[],
): Map<string, RoutedRail> {
  const lines = new Map<string, Stretch[]>();
  const stretches = new Map<string, Stretch[]>();
  for (const [id, { corners: points, cover }] of found) {
    const own: Stretch[] = [];
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i] as Point;
      const b = points[i + 1] as Point;
      const upright = a.x === b.x;
      const fixed = upright ? a.x : a.y;
      const lean = (other: Point | undefined) =>
        other ? Math.sign((upright ? other.x : other.y) - fixed) : 0;
      const stretch: Stretch = {
        id,
        index: i,
        lo: Math.min(upright ? a.y : a.x, upright ? b.y : b.x),
        hi: Math.max(upright ? a.y : a.x, upright ? b.y : b.x),
        cover: cover[i] ?? [],
        lean: lean(points[i - 1]) + lean(points[i + 2]),
        port: i === 0 || i + 2 === points.length,
        offset: 0,
        shared: false,
      };
      own.push(stretch);
      const key = `${upright ? 'v' : 'h'}${fixed.toFixed(1)}`;
      lines.set(key, [...(lines.get(key) ?? []), stretch]);
    }
    stretches.set(id, own);
  }
  /** The sign of where `s` belongs relative to `t`; 0 when they do not run side by side. */
  const beside = (s: Stretch, t: Stretch): number => {
    const theirs = new Set(t.cover);
    const common = s.cover.find((key) => theirs.has(key));
    return common === undefined ? 0 : (side.get(`${s.id}|${t.id}|${common}`) ?? 0);
  };
  for (const line of lines.values()) {
    line.sort((a, b) => a.lo - b.lo);
    let group: Stretch[] = [];
    let end = Number.NEGATIVE_INFINITY;
    const settle = () => {
      if (group.length < 2) return;
      // Each route as far over as the routes beside it ask; those that never run beside each
      // other go by which way they turn off.
      const place = new Map(
        group.map((s) => [s, group.reduce((sum, t) => sum + (s === t ? 0 : beside(s, t)), 0)]),
      );
      group.sort(
        (a, b) => (place.get(a) ?? 0) - (place.get(b) ?? 0) || a.lean - b.lean || a.lo - b.lo,
      );
      const room = group.some((s) => s.port) ? PORT_WIDTH : BUNDLE_WIDTH;
      const gap = Math.min(GAP, room / (group.length - 1));
      group.forEach((s, k) => {
        s.offset = (k - (group.length - 1) / 2) * gap;
        s.shared = true;
      });
    };
    for (const stretch of line) {
      if (stretch.lo < end - 0.5) group.push(stretch);
      else {
        settle();
        group = [stretch];
      }
      end = Math.max(end, stretch.hi);
    }
    settle();
  }

  const byId = new Map(edges.map((e) => [e.id, e]));
  const routes = new Map<string, RoutedRail>();
  for (const [id, { corners: points }] of found) {
    const own = stretches.get(id) ?? [];
    const edge = byId.get(id);
    if (!edge || own.length === 0) continue;
    const moved = points.map((point, i) => {
      const result = { ...point };
      for (const stretch of [own[i - 1], own[i]]) {
        if (!stretch) continue;
        const a = points[stretch.index] as Point;
        const b = points[stretch.index + 1] as Point;
        if (a.x === b.x) result.x = a.x + stretch.offset;
        else result.y = a.y + stretch.offset;
      }
      return result;
    });
    // Each end stops at the edge of its station; below a node, under its labels.
    const cut = (end: Point, towards: Point, node: RouteNode): Point => {
      const cx = node.station.x + node.station.width / 2;
      const cy = node.station.y + node.station.height / 2;
      const upright = end.x === towards.x;
      const way = Math.sign(upright ? towards.y - end.y : towards.x - end.x);
      if (upright && way > 0) return { x: end.x, y: node.area.y + node.area.height + 2 };
      const off = upright ? end.x - cx : end.y - cy;
      const round = node.station.width === node.station.height;
      const half = (upright ? node.station.height : node.station.width) / 2;
      const out = (round ? Math.sqrt(Math.max(half * half - off * off, 0)) : half) + 2;
      return upright ? { x: end.x, y: cy + way * out } : { x: cx + way * out, y: end.y };
    };
    const last = moved.length - 1;
    moved[0] = cut(moved[0] as Point, moved[1] as Point, nodes[edge.from] as RouteNode);
    moved[last] = cut(moved[last] as Point, moved[last - 1] as Point, nodes[edge.to] as RouteNode);
    routes.set(id, { points: moved, shared: own.map((s) => s.shared) });
  }
  return routes;
}
