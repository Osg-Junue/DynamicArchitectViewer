import type { Rect } from '../layout';
import type { Point } from '../model/types';

export type { Point };

export interface Bezier {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

/** Cubic Bézier between the facing top and bottom of two rectangles. */
export function connectVertical(from: Rect, to: Rect): Bezier {
  const fromCx = from.x + from.width / 2;
  const toCx = to.x + to.width / 2;
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const sign = dy >= 0 ? 1 : -1;
  const p0 = { x: fromCx, y: sign > 0 ? from.y + from.height : from.y };
  const p3 = { x: toCx, y: sign > 0 ? to.y : to.y + to.height };
  const offset = clamp(Math.abs(p3.y - p0.y) * 0.45, 40, 140);
  return {
    p0,
    p1: { x: p0.x, y: p0.y + offset * sign },
    p2: { x: p3.x, y: p3.y - offset * sign },
    p3,
  };
}

const MAX_STATION_ANGLE = (35 * Math.PI) / 180;

/**
 * Cubic Bézier between two stations. Rails leave and enter along the direction of travel,
 * so they meet a station's outline squarely instead of running along its edge.
 */
export function connectStations(from: Rect, to: Rect): Bezier {
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const angle = clamp(
    Math.atan2(b.y - a.y, Math.abs(b.x - a.x)),
    -MAX_STATION_ANGLE,
    MAX_STATION_ANGLE,
  );
  const unit = { x: Math.cos(angle) * (b.x >= a.x ? 1 : -1), y: Math.sin(angle) };
  const p0 = onOutline(from, a, unit, 1);
  const p3 = onOutline(to, b, unit, -1);
  const offset = clamp(Math.hypot(p3.x - p0.x, p3.y - p0.y) * 0.35, 24, 120);
  return {
    p0,
    p1: { x: p0.x + unit.x * offset, y: p0.y + unit.y * offset },
    p2: { x: p3.x - unit.x * offset, y: p3.y - unit.y * offset },
    p3,
  };
}

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

const DETOUR_STEPS = [56, 112, 168, 224, 280, 336, 392, 448];
/** Fine enough that a rail cannot slip past the corner of a node between two samples. */
const CROSSING_SAMPLES = 96;

/** Points along a curve, ends left out: a rail always touches its own two stations. */
function innerPoints(b: Bezier): Point[] {
  const points: Point[] = [];
  for (let i = 1; i < CROSSING_SAMPLES; i++) points.push(pointAt(b, i / CROSSING_SAMPLES));
  return points;
}

function hitsAny(b: Bezier, areas: readonly Rect[]): boolean {
  if (areas.length === 0) return false;
  const points = innerPoints(b);
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    left = Math.min(left, p.x);
    right = Math.max(right, p.x);
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y);
  }
  for (const area of areas) {
    // Most areas are nowhere near the curve.
    if (
      area.x > right ||
      area.x + area.width < left ||
      area.y > bottom ||
      area.y + area.height < top
    ) {
      continue;
    }
    for (const p of points) {
      if (pointInRect(p, area)) return true;
    }
  }
  return false;
}

/**
 * Bends a curve away from the given areas, trying the smallest detour first: at each size, a
 * bow to either side, then an S that passes one area on one side and the next on the other.
 * A curve that no detour clears is left as it was.
 *
 * Several detours of one size may clear the way. `cost` then picks among them, such as by
 * the rails each would cross; without it, or on a tie, the first one wins.
 */
export function routeAround(
  b: Bezier,
  areas: readonly Rect[],
  cost?: (candidate: Bezier) => number,
): Bezier {
  // No detour reaches further than the largest step from the curve's own box.
  const reach = (DETOUR_STEPS[DETOUR_STEPS.length - 1] ?? 0) + 1;
  const xs = [b.p0.x, b.p1.x, b.p2.x, b.p3.x];
  const ys = [b.p0.y, b.p1.y, b.p2.y, b.p3.y];
  const left = Math.min(...xs) - reach;
  const right = Math.max(...xs) + reach;
  const top = Math.min(...ys) - reach;
  const bottom = Math.max(...ys) + reach;
  const near = areas.filter(
    (area) =>
      area.x <= right &&
      area.x + area.width >= left &&
      area.y <= bottom &&
      area.y + area.height >= top,
  );
  if (!hitsAny(b, near)) return b;

  const horizontal = Math.abs(b.p3.x - b.p0.x) >= Math.abs(b.p3.y - b.p0.y);
  const move = (p: Point, amount: number): Point =>
    horizontal ? { x: p.x, y: p.y + amount } : { x: p.x + amount, y: p.y };
  const bend = (first: number, second: number): Bezier => ({
    ...b,
    p1: move(b.p1, first),
    p2: move(b.p2, second),
  });
  for (const step of DETOUR_STEPS) {
    const clear = [
      bend(-step, -step),
      bend(step, step),
      bend(-step, step),
      bend(step, -step),
    ].filter((candidate) => !hitsAny(candidate, near));
    const [first] = clear;
    if (!first) continue;
    if (!cost || clear.length === 1) return first;
    let best = first;
    let bestCost = cost(first);
    for (const candidate of clear.slice(1)) {
      const c = cost(candidate);
      if (c < bestCost) {
        best = candidate;
        bestCost = c;
      }
    }
    return best;
  }
  return b;
}

export function reverse(b: Bezier): Bezier {
  return { p0: b.p3, p1: b.p2, p2: b.p1, p3: b.p0 };
}

function leftOffset(b: Bezier, distance: number): (p: Point) => Point {
  const dx = b.p3.x - b.p0.x;
  const dy = b.p3.y - b.p0.y;
  const length = Math.hypot(dx, dy) || 1;
  return (p) => ({ x: p.x + (dy / length) * distance, y: p.y + (-dx / length) * distance });
}

/** Shifts a curve sideways, to the left of its direction of travel on screen. */
export function shiftLeft(b: Bezier, distance: number): Bezier {
  const move = leftOffset(b, distance);
  return { p0: move(b.p0), p1: move(b.p1), p2: move(b.p2), p3: move(b.p3) };
}

/** Bends a curve to the left of its direction of travel, keeping its endpoints. */
export function bowLeft(b: Bezier, distance: number): Bezier {
  const move = leftOffset(b, distance);
  return { ...b, p1: move(b.p1), p2: move(b.p2) };
}

export function pointAt(b: Bezier, t: number): Point {
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

/** Approximate arc length of a curve. */
export function curveLength(b: Bezier): number {
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

export function svgPath(b: Bezier): string {
  const f = (p: Point) => `${round(p.x)} ${round(p.y)}`;
  return `M ${f(b.p0)} C ${f(b.p1)}, ${f(b.p2)}, ${f(b.p3)}`;
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
