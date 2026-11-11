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

const DETOUR_STEPS = [56, 112, 168, 224];
const CROSSING_SAMPLES = 32;

function crosses(b: Bezier, area: Rect): boolean {
  for (let i = 1; i < CROSSING_SAMPLES; i++) {
    const p = pointAt(b, i / CROSSING_SAMPLES);
    const insideX = p.x >= area.x && p.x <= area.x + area.width;
    if (insideX && p.y >= area.y && p.y <= area.y + area.height) return true;
  }
  return false;
}

/** Bows a curve away from the given areas, trying the smallest detour first. */
export function routeAround(b: Bezier, areas: readonly Rect[]): Bezier {
  if (!areas.some((area) => crosses(b, area))) return b;
  const horizontal = Math.abs(b.p3.x - b.p0.x) >= Math.abs(b.p3.y - b.p0.y);
  const bow = (amount: number): Bezier => {
    const move = (p: Point): Point =>
      horizontal ? { x: p.x, y: p.y + amount } : { x: p.x + amount, y: p.y };
    return { ...b, p1: move(b.p1), p2: move(b.p2) };
  };
  for (const step of DETOUR_STEPS) {
    for (const candidate of [bow(-step), bow(step)]) {
      if (!areas.some((area) => crosses(candidate, area))) return candidate;
    }
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
