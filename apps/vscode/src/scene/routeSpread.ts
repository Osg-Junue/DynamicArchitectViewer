import type { Point } from './geometry';
import type { RoutedRail, RouteEdge, RouteNode } from './route';
import { type Grid, pointOf, stationCenter, stretchKey } from './routeGrid';

/** Distance between two routes on one line, and the most a group of them may take up. */
const GAP = 7;
const PORT_WIDTH = 28;
const BUNDLE_WIDTH = 42;

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
 * The result maps `a|b|stretch` to the sign of a's distance from the line minus b's.
 */
export function sides(paths: ReadonlyMap<string, number[]>, W: number): Map<string, number> {
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
  byLine: Map<string, Stretch[]>;
} {
  const byLine = new Map<string, Stretch[]>();
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
      byLine.set(key, [...(byLine.get(key) ?? []), stretch]);
    }
    byRoute.set(id, own);
  }
  return { byRoute, byLine };
}

/**
 * Gives the stretches that overlap on one line an offset each, so that they run side by side:
 * each as far over as the routes beside it ask, and those that never run beside each other by
 * which way they turn off.
 */
function spread(line: Stretch[], side: ReadonlyMap<string, number>): void {
  /** The sign of where `s` belongs relative to `t`; 0 when they do not run side by side. */
  const beside = (s: Stretch, t: Stretch): number => {
    const theirs = new Set(t.cover);
    const common = s.cover.find((key) => theirs.has(key));
    return common === undefined ? 0 : (side.get(`${s.id}|${t.id}|${common}`) ?? 0);
  };
  const settle = (group: Stretch[]) => {
    if (group.length < 2) return;
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
  line.sort((a, b) => a.lo - b.lo);
  let group: Stretch[] = [];
  let end = Number.NEGATIVE_INFINITY;
  for (const stretch of line) {
    if (stretch.lo < end - 0.5) group.push(stretch);
    else {
      settle(group);
      group = [stretch];
    }
    end = Math.max(end, stretch.hi);
  }
  settle(group);
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
  for (const line of byLine.values()) spread(line, side);

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
