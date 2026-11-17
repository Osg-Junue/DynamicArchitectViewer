import type { Point } from './geometry';
import type { RoutedRail, RouteEdge, RouteNode } from './route';
import {
  type Grid,
  headingOf,
  pointOf,
  RAIL_GAP,
  RAIL_WIDTH,
  stationCenter,
  stretchKey,
} from './routeGrid';

/** Distance between two routes on one line, and the most a group of them may take up. */
const GAP = RAIL_GAP;
const PORT_WIDTH = 28;
const BUNDLE_WIDTH = 30;
/**
 * The least two rails of a group are set apart, where there are more of them than the group
 * has room for at `GAP`: a rail's width and one more, so that they stay lines of their own.
 */
const MIN_GAP = RAIL_WIDTH + 1;
/**
 * The most a group may take up where it meets a station, to keep its rails this near: further
 * out a rail would miss the station, which is 44 across.
 */
const PORT_WIDTH_AT_MOST = 40;
/** The same beside a loop, where the rails keep to one half of the station. */
const LOOP_SIDE_WIDTH = 18;
const LOOP_SIDE_WIDTH_AT_MOST = 20;
/** The least rails are set apart to keep them out of the nodes beside their line: half a unit clear. */
const TIGHT_GAP = RAIL_WIDTH + 0.5;

/** A route as the search found it: on the lines of the grid, before any is moved aside. */
export interface Found {
  /** Start, corners and end. */
  corners: Point[];
  /** For each stretch between two corners, the stretches of the grid it runs on. */
  cover: string[][];
}

/** Each path as its corners, with the stretches of the grid between them. */
export function cornersOf(paths: ReadonlyMap<string, number[]>, grid: Grid): Map<string, Found> {
  const found = new Map<string, Found>();
  for (const [id, path] of paths) {
    const corners: Point[] = [];
    const cover: string[][] = [];
    path.forEach((point, k) => {
      const prev = path[k - 1];
      const next = path[k + 1];
      const straight = prev !== undefined && next !== undefined && point - prev === next - point;
      if (!straight) {
        corners.push(pointOf(grid, point));
        if (next !== undefined) cover.push([]);
      }
      if (next !== undefined) cover[cover.length - 1]?.push(stretchKey(point, next));
    });
    found.set(id, { corners, cover });
  }
  return found;
}

/**
 * Which of two routes goes on which side, wherever they run on the same line.
 *
 * Two routes that run together keep their sides for as long as they do, round every corner:
 * the one that turns off to the left at the end of the shared run is the left one all along.
 * The result maps `a|b|stretch` to where a goes from b: below zero nearer the line's start
 * (left of an upright line, above a level one), above zero further. The size says how much
 * the two ends of their run agree: 2 when both say so, 1 when one does or neither says
 * anything, 0.1 when they disagree and the far end has its way.
 */
export function sides(paths: ReadonlyMap<string, number[]>, W: number): Map<string, number> {
  const heading = (p: number, q: number) => headingOf(p, q, W);
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
        // Below zero: a is on the left of b, for someone travelling with a. With nothing to
        // tell them apart, any side will do, as long as it is the same one all along.
        const sf = Math.sign(far);
        const sn = Math.sign(near);
        const left =
          sf !== 0 && sn !== 0 && sf !== sn ? sf * 0.1 : sf && sn ? sf * 2 : sf || sn || -1;
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

/** The piece of a route between two of its corners. */
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
  /** How far the stretch is moved off its line. */
  offset: number;
  shared: boolean;
}

/** Every route cut into its stretches, and the stretches that lie on each line of the grid. */
function stretchesOf(found: ReadonlyMap<string, Found>): {
  byRoute: Map<string, Stretch[]>;
  byLine: Map<string, { upright: boolean; fixed: number; stretches: Stretch[] }>;
} {
  const byLine = new Map<string, { upright: boolean; fixed: number; stretches: Stretch[] }>();
  const byRoute = new Map<string, Stretch[]>();
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
      const entry = byLine.get(key);
      if (entry) entry.stretches.push(stretch);
      else byLine.set(key, { upright, fixed, stretches: [stretch] });
    }
    byRoute.set(id, own);
  }
  return { byRoute, byLine };
}

/** Whether a spread group touches the top-right quadrant of a node that carries a self-loop. */
function loopBias(
  group: readonly Stretch[],
  upright: boolean,
  fixed: number,
  nodes: readonly RouteNode[],
): 'negative' | 'positive' | undefined {
  for (const n of nodes) {
    if (!n.hasLoop) continue;
    const c = stationCenter(n);
    if (
      upright &&
      Math.abs(fixed - c.x) < 1 &&
      group.some((s) => s.lo < c.y - 0.5 && Math.abs(s.hi - c.y) < 1)
    ) {
      return 'negative';
    }
    if (
      !upright &&
      Math.abs(fixed - c.y) < 1 &&
      group.some((s) => s.hi > c.x + 0.5 && Math.abs(s.lo - c.x) < 1)
    ) {
      return 'positive';
    }
  }
  return undefined;
}

/**
 * Gives the stretches that overlap on one line an offset each, so that they run side by side:
 * each as far over as the routes beside it ask, and those that never run beside each other by
 * which way they turn off.
 */
function spread(
  line: { upright: boolean; fixed: number; stretches: Stretch[] },
  side: ReadonlyMap<string, number>,
  nodes: readonly RouteNode[],
): void {
  /** The sign of where `s` belongs relative to `t`; 0 when they do not run side by side. */
  const beside = (s: Stretch, t: Stretch): number => {
    const theirs = new Set(t.cover);
    const common = s.cover.find((key) => theirs.has(key));
    return common === undefined ? 0 : (side.get(`${s.id}|${t.id}|${common}`) ?? 0);
  };
  const settle = (group: Stretch[]) => {
    if (group.length < 2) return;
    const n = group.length;
    const pref: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const w = beside(group[i] as Stretch, group[j] as Stretch);
        (pref[i] as number[])[j] = w;
        (pref[j] as number[])[i] = -w;
      }
    }
    const remaining = new Set(Array.from({ length: n }, (_, i) => i));
    const ordered: number[] = [];
    while (remaining.size > 0) {
      let bestIdx = -1;
      let bestIn = Number.POSITIVE_INFINITY;
      let bestNet = Number.POSITIVE_INFINITY;
      for (const i of remaining) {
        let inWeight = 0;
        let net = 0;
        for (const j of remaining) {
          if (i === j) continue;
          const w = (pref[i] as number[])[j] ?? 0;
          if (w > 0) inWeight += w;
          net += w;
        }
        const si = group[i] as Stretch;
        const sb = bestIdx >= 0 ? (group[bestIdx] as Stretch) : undefined;
        if (
          inWeight < bestIn - 1e-9 ||
          (Math.abs(inWeight - bestIn) <= 1e-9 &&
            (net < bestNet - 1e-9 ||
              (Math.abs(net - bestNet) <= 1e-9 &&
                sb !== undefined &&
                (si.lean - sb.lean || si.lo - sb.lo) < 0)))
        ) {
          bestIdx = i;
          bestIn = inWeight;
          bestNet = net;
        }
      }
      remaining.delete(bestIdx);
      ordered.push(bestIdx);
    }
    for (let pass = 0; pass < n; pass++) {
      let swapped = false;
      for (let k = 0; k + 1 < n; k++) {
        const i = ordered[k] as number;
        const j = ordered[k + 1] as number;
        if (((pref[i] as number[])[j] ?? 0) > 1e-9) {
          ordered[k] = j;
          ordered[k + 1] = i;
          swapped = true;
        }
      }
      if (!swapped) break;
    }
    group.splice(0, n, ...ordered.map((i) => group[i] as Stretch));
    const tracks = new Array<number>(n).fill(0);
    let maxTrack = 0;
    for (let i = 0; i < n; i++) {
      const si = group[i] as Stretch;
      let t = 0;
      for (let j = 0; j < i; j++) {
        const sj = group[j] as Stretch;
        if (Math.min(si.hi, sj.hi) - Math.max(si.lo, sj.lo) > -0.5) {
          t = Math.max(t, (tracks[j] as number) + 1);
        }
      }
      tracks[i] = t;
      if (t > maxTrack) maxTrack = t;
    }
    if (maxTrack === 0) return;
    const bias = loopBias(group, line.upright, line.fixed, nodes);
    const port = group.some((s) => s.port);
    // Rails that meet a station stay inside its outline, however many they are: nearer to
    // each other than `MIN_GAP` rather than beside the station. Elsewhere a group takes the
    // room `MIN_GAP` needs.
    const room = bias
      ? Math.min(LOOP_SIDE_WIDTH_AT_MOST, Math.max(LOOP_SIDE_WIDTH, maxTrack * MIN_GAP))
      : port
        ? Math.min(PORT_WIDTH_AT_MOST, Math.max(PORT_WIDTH, maxTrack * MIN_GAP))
        : Math.max(BUNDLE_WIDTH, maxTrack * MIN_GAP);
    let gap = Math.min(GAP, room / maxTrack);
    let shift = 0;
    if (!bias) {
      let minOff = -room;
      let maxOff = room;
      const gLo = Math.min(...group.map((s) => s.lo)) + 1;
      const gHi = Math.max(...group.map((s) => s.hi)) - 1;
      // No rail is moved into the area of a node beside the line.
      for (const { area } of nodes) {
        const { x, y, width, height } = area;
        if (line.upright) {
          if (gHi <= y || gLo >= y + height) continue;
          if (x + width <= line.fixed) minOff = Math.max(minOff, x + width + 1.5 - line.fixed);
          else if (x >= line.fixed) maxOff = Math.min(maxOff, x - 1.5 - line.fixed);
        } else {
          if (gHi <= x || gLo >= x + width) continue;
          if (y + height <= line.fixed) minOff = Math.max(minOff, y + height + 1.5 - line.fixed);
          else if (y >= line.fixed) maxOff = Math.min(maxOff, y - 1.5 - line.fixed);
        }
      }
      if (maxOff - minOff >= maxTrack * (TIGHT_GAP + 0.05)) {
        gap = Math.max(TIGHT_GAP, Math.min(gap, (maxOff - minOff) / maxTrack));
        const half = (maxTrack * gap) / 2;
        if (-half < minOff) shift = minOff + half;
        else if (half > maxOff) shift = maxOff - half;
      }
    }
    group.forEach((s, i) => {
      const k = tracks[i] as number;
      s.offset =
        bias === 'negative'
          ? (k - maxTrack) * gap
          : bias === 'positive'
            ? k * gap
            : (k - maxTrack / 2) * gap + shift;
      s.shared = true;
    });
  };
  line.stretches.sort((a, b) => a.lo - b.lo);
  let group: Stretch[] = [];
  let end = Number.NEGATIVE_INFINITY;
  for (const stretch of line.stretches) {
    if (stretch.lo < end - 0.5) group.push(stretch);
    else {
      settle(group);
      group = [stretch];
    }
    end = Math.max(end, stretch.hi);
  }
  settle(group);
}

/** Two stretches run beside each other where they overlap by more than this. */
const BESIDE = 6;
/** How often `separate` looks again for rails that moving others has brought too near. */
const SEPARATE_ROUNDS = 4;

/**
 * Positions no nearer to each other than `gaps` asks, in the order given, that are as near
 * to `wanted` as that allows (least squares): `gaps[i]` is kept between `i` and `i + 1`.
 */
function keepApart(wanted: readonly number[], gaps: readonly number[]): number[] {
  // With the gaps taken out, the positions only have to stay in order: runs that are out of
  // order are pooled into their mean.
  const before: number[] = [0];
  for (let i = 0; i + 1 < wanted.length; i++) {
    before.push((before[i] as number) + (gaps[i] as number));
  }
  const pools: Array<{ sum: number; count: number }> = [];
  wanted.forEach((at, i) => {
    let pool = { sum: at - (before[i] as number), count: 1 };
    for (;;) {
      const last = pools[pools.length - 1];
      if (!last || last.sum / last.count <= pool.sum / pool.count) break;
      pool = { sum: last.sum + pool.sum, count: last.count + pool.count };
      pools.pop();
    }
    pools.push(pool);
  });
  const result: number[] = [];
  for (const { sum, count } of pools) {
    for (let k = 0; k < count; k++) result.push(sum / count + (before[result.length] as number));
  }
  return result;
}

/**
 * Lines of the grid can stand nearer to each other than rails are set apart, and each line
 * spreads its rails without looking at the next: a rail of one line can end up on a rail of
 * another. Moves such rails `GAP` apart, each as little as that takes, in the order they are
 * in. Rails of one line keep the distance `spread` gave them.
 */
function separate(
  lines: Iterable<{ upright: boolean; fixed: number; stretches: Stretch[] }>,
): void {
  const all = [...lines];
  for (const upright of [false, true]) {
    const items = all
      .filter((line) => line.upright === upright)
      .flatMap((line) => line.stretches.map((stretch) => ({ stretch, line: line.fixed })));
    const at = (item: (typeof items)[number]) => item.line + item.stretch.offset;
    for (let round = 0; round < SEPARATE_ROUNDS; round++) {
      items.sort((a, b) => at(a) - at(b) || a.line - b.line || a.stretch.lo - b.stretch.lo);
      // Rails that run beside each other within a gap form one cluster, which is solved as a
      // whole wherever two of its rails from different lines are too near.
      const cluster = items.map((_, i) => i);
      const root = (i: number): number => {
        let r = i;
        while (cluster[r] !== r) r = cluster[r] as number;
        cluster[i] = r;
        return r;
      };
      const tooNear = new Set<number>();
      items.forEach((a, i) => {
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j] as (typeof items)[number];
          const distance = at(b) - at(a);
          if (distance > GAP + 0.01) break;
          const beside =
            Math.min(a.stretch.hi, b.stretch.hi) - Math.max(a.stretch.lo, b.stretch.lo) > BESIDE;
          if (!beside || a.stretch.id === b.stretch.id) continue;
          cluster[root(j)] = root(i);
          if (a.line !== b.line && distance < GAP - 0.01) tooNear.add(i);
        }
      });
      if (tooNear.size === 0) break;
      const solve = new Set([...tooNear].map(root));
      const members = new Map<number, number[]>();
      items.forEach((_, i) => {
        const r = root(i);
        if (!solve.has(r)) return;
        const list = members.get(r);
        if (list) list.push(i);
        else members.set(r, [i]);
      });
      for (const list of members.values()) {
        const wanted = list.map((i) => at(items[i] as (typeof items)[number]));
        const gaps = list.slice(0, -1).map((i, k) => {
          const a = items[i] as (typeof items)[number];
          const b = items[list[k + 1] as number] as (typeof items)[number];
          return a.line === b.line ? (wanted[k + 1] as number) - (wanted[k] as number) : GAP;
        });
        keepApart(wanted, gaps).forEach((position, k) => {
          const item = items[list[k] as number] as (typeof items)[number];
          item.stretch.offset = position - item.line;
          item.stretch.shared = true;
        });
      }
    }
  }
}

/** Where a route that ends at `end`, coming from `towards`, stops: at the edge of the station; below a node, under its labels. */
function cutAtStation(end: Point, towards: Point, node: RouteNode): Point {
  const center = stationCenter(node);
  const upright = end.x === towards.x;
  const way = Math.sign(upright ? towards.y - end.y : towards.x - end.x);
  if (upright && way > 0) return { x: end.x, y: node.area.y + node.area.height + 2 };
  const off = upright ? end.x - center.x : end.y - center.y;
  const round = node.station.width === node.station.height;
  const half = (upright ? node.station.height : node.station.width) / 2;
  const out = (round ? Math.sqrt(Math.max(half * half - off * off, 0)) : half) + 2;
  return upright ? { x: end.x, y: center.y + way * out } : { x: center.x + way * out, y: end.y };
}

/** Moves the routes that run on one line apart, and cuts each route at its stations' edges. */
export function apart(
  found: ReadonlyMap<string, Found>,
  side: ReadonlyMap<string, number>,
  edges: readonly RouteEdge[],
  nodes: readonly RouteNode[],
): Map<string, RoutedRail> {
  const { byRoute, byLine } = stretchesOf(found);
  for (const line of byLine.values()) spread(line, side, nodes);
  separate(byLine.values());

  const byId = new Map(edges.map((e) => [e.id, e]));
  const routes = new Map<string, RoutedRail>();
  for (const [id, { corners: points }] of found) {
    const own = byRoute.get(id) ?? [];
    const edge = byId.get(id);
    if (!edge || own.length === 0) continue;
    // A corner moves with both of the stretches that meet in it.
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
    const last = moved.length - 1;
    moved[0] = cutAtStation(moved[0] as Point, moved[1] as Point, nodes[edge.from] as RouteNode);
    moved[last] = cutAtStation(
      moved[last] as Point,
      moved[last - 1] as Point,
      nodes[edge.to] as RouteNode,
    );
    routes.set(id, { points: moved, shared: own.map((s) => s.shared) });
  }
  return routes;
}
