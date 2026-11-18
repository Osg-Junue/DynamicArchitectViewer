import { describe, expect, it } from 'vitest';
import type { RouteEdge, RouteNode } from '../route';
import type { Grid } from '../routeGrid';
import { apart, cornersOf, sides } from '../routeSpread';

/** A grid of crossings 100 apart, ten by ten: crossing `y * 10 + x` stands at (100x, 100y). */
const W = 10;
const grid = {
  W,
  xs: Array.from({ length: W }, (_, i) => i * 100),
  ys: Array.from({ length: W }, (_, i) => i * 100),
} as unknown as Grid;
const at = (x: number, y: number) => y * W + x;
/** The crossings from one to the next, straight along a row or a column. */
const run = (...corners: Array<[number, number]>): number[] => {
  const path = [at(...(corners[0] as [number, number]))];
  for (let k = 1; k < corners.length; k++) {
    const [x0, y0] = corners[k - 1] as [number, number];
    const [x1, y1] = corners[k] as [number, number];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 1; s <= steps; s++) {
      path.push(at(x0 + Math.sign(x1 - x0) * s, y0 + Math.sign(y1 - y0) * s));
    }
  }
  return path;
};
/** A small node whose station is on a crossing. */
const node = (x: number, y: number): RouteNode => ({
  station: { x: x * 100 - 22, y: y * 100 - 22, width: 44, height: 44 },
  area: { x: x * 100 - 22, y: y * 100 - 22, width: 44, height: 44 },
  badge: { x: x * 100 - 22, y: y * 100 - 50, width: 44, height: 20 },
});
const edge = (id: string, from: number, to: number): RouteEdge => ({
  id,
  from,
  to,
  home: new Set(),
});

describe('rails that share a line', () => {
  it('keep a rail from elsewhere outside the bundle of rails that leave one node', () => {
    // `s` sends one rail level to `l` and one that turns down to `r` half way. The rail from
    // `l` to `a` comes back along the same line and turns down further on: it crosses the
    // rail to `r` whichever side it takes, and must not take the one between the two rails of
    // `s`, on which it would run inside their bundle.
    const nodes = [node(0, 3), node(9, 3), node(6, 6), node(3, 8)];
    const edges = [edge('sl', 0, 1), edge('sr', 0, 2), edge('la', 1, 3)];
    const paths = new Map([
      ['sl', run([0, 3], [9, 3])],
      ['sr', run([0, 3], [6, 3], [6, 6])],
      ['la', run([9, 3], [3, 3], [3, 8])],
    ]);
    const rails = apart(cornersOf(paths, grid), sides(paths, W), edges, nodes);
    const levelAt = (id: string) => rails.get(id)?.points[0]?.y as number;
    const lsl = levelAt('sl');
    const lsr = levelAt('sr');
    // The rail to `a` stays level until it turns down at its second point.
    const lla = rails.get('la')?.points[1]?.y as number;
    expect(lsl).toBeLessThan(lsr);
    expect(lla).toBeGreaterThan(lsr);
  });
});

describe('rails on two lines close together', () => {
  // As `grid`, with one more row 0.7 below the fourth: rows through two stations can stand
  // that near, and the rails on each are moved apart afterwards.
  const near = {
    W,
    xs: Array.from({ length: W }, (_, i) => i * 100),
    ys: [0, 100, 200, 300, 300.7, 400, 500, 600, 700, 800],
  } as unknown as Grid;

  it('put the rail that turns off nearer the station on the side it comes from', () => {
    // Both rails come down and turn right to `t`: `a` on the upper row at column 2, `b` on
    // the row just below at column 5. Kept in the order of their rows, `b` would come down
    // across `a`; above it, the two do not cross.
    const nodes = [node(2, 0), node(5, 0), node(9, 3)];
    const edges = [edge('a', 0, 2), edge('b', 1, 2)];
    const paths = new Map([
      ['a', run([2, 0], [2, 3], [9, 3])],
      ['b', run([5, 0], [5, 4], [9, 4])],
    ]);
    const rails = apart(cornersOf(paths, near), sides(paths, W), edges, nodes);
    const levelAt = (id: string) => rails.get(id)?.points[1]?.y as number;
    expect(levelAt('b')).toBeLessThan(levelAt('a'));
    expect(levelAt('a') - levelAt('b')).toBeGreaterThanOrEqual(7 - 0.01);
  });
});
