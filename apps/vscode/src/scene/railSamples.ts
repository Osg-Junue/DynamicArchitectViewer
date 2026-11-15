// The samples of a rail, and quick ways to ask how near a rectangle they come.
import type { Rect } from '../layout';
import type { Point } from './geometry';

/** Distance from a point to a rectangle; zero inside it. */
export function reach(rect: Rect, p: Point): number {
  return Math.hypot(
    Math.max(rect.x - p.x, 0, p.x - (rect.x + rect.width)),
    Math.max(rect.y - p.y, 0, p.y - (rect.y + rect.height)),
  );
}

/**
 * The samples of a rail, grouped by the straight run they lie on: a run level with the x axis
 * shares one y, an upright run one x. Along a run, the nearest sample to a rectangle and whether
 * one lies inside it are found by a binary search, with the same arithmetic `reach` uses, so the
 * answers are the ones a sample-by-sample search gives, only sooner. Samples on no run, such as
 * those round a corner, are kept loose and searched one by one.
 */
export interface Runs {
  level: Array<{ at: number; along: number[] }>;
  upright: Array<{ at: number; along: number[] }>;
  loose: Point[];
}

export function runsOf(points: readonly Point[]): Runs {
  const runs: Runs = { level: [], upright: [], loose: [] };
  let i = 0;
  while (i < points.length) {
    const start = points[i] as Point;
    let j = i;
    while (j + 1 < points.length && (points[j + 1] as Point).y === start.y) j++;
    if (j > i) {
      const along = points.slice(i, j + 1).map((p) => p.x);
      runs.level.push({ at: start.y, along: along.sort((a, b) => a - b) });
      i = j + 1;
      continue;
    }
    while (j + 1 < points.length && (points[j + 1] as Point).x === start.x) j++;
    if (j > i) {
      const along = points.slice(i, j + 1).map((p) => p.y);
      runs.upright.push({ at: start.x, along: along.sort((a, b) => a - b) });
      i = j + 1;
      continue;
    }
    runs.loose.push(start);
    i++;
  }
  return runs;
}

/** The index of the first value at least `v` in ascending `values`. */
function firstAtLeast(values: readonly number[], v: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] as number) < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The least of `max(lo - v, 0, v - hi)` over ascending `values`, as `reach` works it out. */
function spanGap(values: readonly number[], lo: number, hi: number): number {
  const i = firstAtLeast(values, lo);
  const after = values[i];
  if (after !== undefined && after <= hi) return 0;
  let best = Number.POSITIVE_INFINITY;
  if (after !== undefined) best = after - hi;
  const before = values[i - 1];
  if (before !== undefined) best = Math.min(best, lo - before);
  return best;
}

/** How near a rectangle the nearest of the samples that `runs` groups is. */
export function nearestRun(rect: Rect, runs: Runs): number {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  let best = Number.POSITIVE_INFINITY;
  for (const run of runs.level) {
    const dy = Math.max(rect.y - run.at, 0, run.at - bottom);
    best = Math.min(best, Math.hypot(spanGap(run.along, rect.x, right), dy));
  }
  for (const run of runs.upright) {
    const dx = Math.max(rect.x - run.at, 0, run.at - right);
    best = Math.min(best, Math.hypot(dx, spanGap(run.along, rect.y, bottom)));
  }
  for (const p of runs.loose) best = Math.min(best, reach(rect, p));
  return best;
}

/** Whether a sample of `runs` lies strictly inside `rect`. */
export function runsEnter(rect: Rect, runs: Runs): boolean {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const strictlyBetween = (values: readonly number[], lo: number, hi: number): boolean => {
    // The first value above `lo`.
    let i = firstAtLeast(values, lo);
    while (i < values.length && (values[i] as number) <= lo) i++;
    const v = values[i];
    return v !== undefined && v < hi;
  };
  for (const run of runs.level) {
    if (run.at > rect.y && run.at < bottom && strictlyBetween(run.along, rect.x, right)) {
      return true;
    }
  }
  for (const run of runs.upright) {
    if (run.at > rect.x && run.at < right && strictlyBetween(run.along, rect.y, bottom)) {
      return true;
    }
  }
  return runs.loose.some((p) => p.x > rect.x && p.x < right && p.y > rect.y && p.y < bottom);
}

/** The least and greatest coordinates of some points. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOfPoints(points: readonly Point[]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of points) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}

/**
 * How near a rectangle the nearest point within some bounds could be. No point inside them is
 * nearer than this, which is worked out as `reach` is, so it tells cheaply, and exactly, when
 * `nearestRun` cannot come out below some value.
 */
export function reachBounds(rect: Rect, b: Bounds): number {
  return Math.hypot(
    Math.max(rect.x - b.maxX, 0, b.minX - (rect.x + rect.width)),
    Math.max(rect.y - b.maxY, 0, b.minY - (rect.y + rect.height)),
  );
}
