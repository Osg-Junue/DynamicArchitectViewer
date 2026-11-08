import type { Rect } from '../layout';

export interface Point {
  x: number;
  y: number;
}

export interface Bezier {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

/** Cubic Bézier between the facing sides of two rectangles. */
export function connect(from: Rect, to: Rect): Bezier {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  if (Math.abs(dx) >= Math.abs(dy) * 0.85) {
    const sign = dx >= 0 ? 1 : -1;
    const p0 = { x: sign > 0 ? from.x + from.width : from.x, y: fromCy };
    const p3 = { x: sign > 0 ? to.x : to.x + to.width, y: toCy };
    const offset = clamp(Math.abs(p3.x - p0.x) * 0.45, 48, 160);
    return {
      p0,
      p1: { x: p0.x + offset * sign, y: p0.y },
      p2: { x: p3.x - offset * sign, y: p3.y },
      p3,
    };
  }
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

/** Shifts a curve sideways, to the left of its direction of travel on screen. */
export function shiftLeft(b: Bezier, distance: number): Bezier {
  const dx = b.p3.x - b.p0.x;
  const dy = b.p3.y - b.p0.y;
  const length = Math.hypot(dx, dy) || 1;
  const offset = { x: (dy / length) * distance, y: (-dx / length) * distance };
  const move = (p: Point): Point => ({ x: p.x + offset.x, y: p.y + offset.y });
  return { p0: move(b.p0), p1: move(b.p1), p2: move(b.p2), p3: move(b.p3) };
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

export function svgPath(b: Bezier): string {
  const f = (p: Point) => `${round(p.x)} ${round(p.y)}`;
  return `M ${f(b.p0)} C ${f(b.p1)}, ${f(b.p2)}, ${f(b.p3)}`;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
