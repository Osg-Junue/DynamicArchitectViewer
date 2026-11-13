import type { Rect } from '../layout';
import type { Point } from '../model/types';

export type { Point };

export interface Bezier {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

/** A rail of straight stretches: its start, its corners and its end. The corners are drawn rounded. */
export interface Route {
  points: readonly Point[];
}

/** The line a rail is drawn along: a route, or a single curve for a loop back to its own station. */
export type Rail = Bezier | Route;

const isRoute = (rail: Rail): rail is Route => 'points' in rail;

/** Directions a self-loop leaves and re-enters its station, in degrees counter-clockwise. */
const SELF_LOOP_LEAVE = 82;
const SELF_LOOP_ENTER = 16;
/** Large enough that a numbered stop on the loop stays clear of the station. */
const SELF_LOOP_REACH = 84;
const SELF_LOOP_STEP = 18;

/** A loop at the station's upper right; further loops on the same station nest outside it. */
export function selfLoop(station: Rect, ordinal = 0): Bezier {
  const center = { x: station.x + station.width / 2, y: station.y + station.height / 2 };
  const reach = SELF_LOOP_REACH + ordinal * SELF_LOOP_STEP;
  const ray = (degrees: number): Point => {
    const radians = (degrees * Math.PI) / 180;
    return { x: Math.cos(radians), y: -Math.sin(radians) };
  };
  const leave = ray(SELF_LOOP_LEAVE);
  const enter = ray(SELF_LOOP_ENTER);
  const p0 = onOutline(station, center, leave, 1);
  const p3 = onOutline(station, center, enter, 1);
  return {
    p0,
    p1: { x: p0.x + leave.x * reach, y: p0.y + leave.y * reach },
    p2: { x: p3.x + enter.x * reach, y: p3.y + enter.y * reach },
    p3,
  };
}

/** Where a ray from a station's center leaves its outline (circle if square, else its box). */
function onOutline(station: Rect, center: Point, unit: Point, sign: number): Point {
  const reach =
    station.width === station.height
      ? station.width / 2
      : Math.min(
          station.width / 2 / Math.max(Math.abs(unit.x), 1e-6),
          station.height / 2 / Math.max(Math.abs(unit.y), 1e-6),
        );
  return { x: center.x + unit.x * reach * sign, y: center.y + unit.y * reach * sign };
}

/** Radius of the corners of a route. */
const ROUTE_CORNER = 9;

/** A part of a route as it is drawn: a straight line, or the curve round a corner (`via`). */
interface Piece {
  from: Point;
  via?: Point;
  to: Point;
  length: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

function towards(a: Point, b: Point, by: number): Point {
  const d = distance(a, b) || 1;
  return { x: a.x + ((b.x - a.x) / d) * by, y: a.y + ((b.y - a.y) / d) * by };
}

function onCorner(piece: Piece, via: Point, u: number): Point {
  const v = 1 - u;
  return {
    x: v * v * piece.from.x + 2 * u * v * via.x + u * u * piece.to.x,
    y: v * v * piece.from.y + 2 * u * v * via.y + u * u * piece.to.y,
  };
}

const CORNER_SEGMENTS = 8;

function cornerPiece(from: Point, via: Point, to: Point): Piece {
  const piece: Piece = { from, via, to, length: 0 };
  let previous = from;
  for (let i = 1; i <= CORNER_SEGMENTS; i++) {
    const point = onCorner(piece, via, i / CORNER_SEGMENTS);
    piece.length += distance(previous, point);
    previous = point;
  }
  return piece;
}

/** A route is asked for its points many times over; its pieces are worked out once. */
const piecesOfRoute = new WeakMap<Route, Piece[]>();

function piecesOf(route: Route): Piece[] {
  const known = piecesOfRoute.get(route);
  if (known) return known;
  const { points } = route;
  const pieces: Piece[] = [];
  let from = points[0];
  for (let i = 1; from && i < points.length; i++) {
    const corner = points[i];
    const next = points[i + 1];
    const previous = points[i - 1];
    if (!corner || !previous) continue;
    if (!next) {
      pieces.push({ from, to: corner, length: distance(from, corner) });
      break;
    }
    const radius = Math.min(
      ROUTE_CORNER,
      distance(previous, corner) / 2,
      distance(corner, next) / 2,
    );
    const before = towards(corner, previous, radius);
    const after = towards(corner, next, radius);
    pieces.push({ from, to: before, length: distance(from, before) });
    pieces.push(cornerPiece(before, corner, after));
    from = after;
  }
  piecesOfRoute.set(route, pieces);
  return pieces;
}

export function reverse<T extends Rail>(rail: T): T;
export function reverse(rail: Rail): Rail {
  return isRoute(rail)
    ? { points: [...rail.points].reverse() }
    : { p0: rail.p3, p1: rail.p2, p2: rail.p1, p3: rail.p0 };
}

/**
 * The shares of a route's length at which each of its corners starts, is half way round and
 * ends. Something drawn along the route from sampled points needs these to follow the corners.
 */
export function cornerShares(rail: Rail): number[] {
  if (!isRoute(rail)) return [];
  const pieces = piecesOf(rail);
  const total = pieces.reduce((sum, piece) => sum + piece.length, 0);
  if (total === 0) return [];
  const shares: number[] = [];
  let before = 0;
  for (const piece of pieces) {
    if (piece.via) {
      shares.push(
        before / total,
        (before + piece.length / 2) / total,
        (before + piece.length) / total,
      );
    }
    before += piece.length;
  }
  return shares;
}

/** Where a rail starts and where it ends. */
export function railEnds(rail: Rail): { start: Point; end: Point } {
  if (!isRoute(rail)) return { start: rail.p0, end: rail.p3 };
  const start = rail.points[0] ?? { x: 0, y: 0 };
  return { start, end: rail.points[rail.points.length - 1] ?? start };
}

/** A box that holds the whole rail: around a route's points, or a curve's control points. */
export function railBox(rail: Rail): Rect {
  const points = isRoute(rail) ? rail.points : [rail.p0, rail.p1, rail.p2, rail.p3];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * The point a share `t` of the way along a rail. On a route that is a share of its length, so
 * something moving along it keeps its speed round the corners.
 */
export function pointAt(rail: Rail, t: number): Point {
  return isRoute(rail) ? pointOnRoute(rail, t) : pointOnCurve(rail, t);
}

function pointOnRoute(route: Route, t: number): Point {
  const pieces = piecesOf(route);
  let left = clamp(t, 0, 1) * pieces.reduce((sum, piece) => sum + piece.length, 0);
  for (const piece of pieces) {
    if (left <= piece.length) {
      const u = piece.length > 0 ? left / piece.length : 0;
      return piece.via ? onCorner(piece, piece.via, u) : towards(piece.from, piece.to, left);
    }
    left -= piece.length;
  }
  return railEnds(route).end;
}

function pointOnCurve(b: Bezier, t: number): Point {
  const c = clamp(t, 0, 1);
  const u = 1 - c;
  const a = u * u * u;
  const bb = 3 * u * u * c;
  const cc = 3 * u * c * c;
  const d = c * c * c;
  return {
    x: a * b.p0.x + bb * b.p1.x + cc * b.p2.x + d * b.p3.x,
    y: a * b.p0.y + bb * b.p1.y + cc * b.p2.y + d * b.p3.y,
  };
}

/** The length of a rail; approximate for a curve. */
export function railLength(rail: Rail): number {
  if (isRoute(rail)) return piecesOf(rail).reduce((sum, piece) => sum + piece.length, 0);
  const b = rail;
  const SEGMENTS = 24;
  let length = 0;
  let previous = b.p0;
  for (let i = 1; i <= SEGMENTS; i++) {
    const point = pointAt(b, i / SEGMENTS);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

export function svgPath(rail: Rail): string {
  const f = (p: Point) => `${round(p.x)} ${round(p.y)}`;
  if (!isRoute(rail)) return `M ${f(rail.p0)} C ${f(rail.p1)}, ${f(rail.p2)}, ${f(rail.p3)}`;
  const drawn = piecesOf(rail).map((piece) =>
    piece.via ? `Q ${f(piece.via)} ${f(piece.to)}` : `L ${f(piece.to)}`,
  );
  return [`M ${f(railEnds(rail).start)}`, ...drawn].join(' ');
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function round(v: number): number {
  return Math.round(v * 10) / 10;
}

export function expandRect(r: Rect, pad: number): Rect {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Liang–Barsky segment-rectangle intersection test. */
export function segmentIntersectsRect(a: Point, b: Point, r: Rect): boolean {
  if (r.width <= 0 || r.height <= 0) return false;
  let tMin = 0;
  let tMax = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
    return true;
  };

  return (
    clip(-dx, a.x - r.x) &&
    clip(dx, r.x + r.width - a.x) &&
    clip(-dy, a.y - r.y) &&
    clip(dy, r.y + r.height - a.y) &&
    tMin <= tMax
  );
}
