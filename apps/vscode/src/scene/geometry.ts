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

export function reverse(b: Bezier): Bezier {
  return { p0: b.p3, p1: b.p2, p2: b.p1, p3: b.p0 };
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
