import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect } from '../../layout';
import { SAMPLE_TEMPLATES } from '../../samples';
import { type Point, pointAt, type Rail, railLength } from '../geometry';
import { resolveView } from '../index';
import { boundsOfPoints, nearestRun, reach, reachBounds, runsEnter, runsOf } from '../railSamples';
import { readExample } from './helpers';

/** Samples as the placer takes them: no more than 10 units apart. */
function samples(rail: Rail): Point[] {
  const count = Math.max(8, Math.ceil(railLength(rail) / 10));
  return Array.from({ length: count + 1 }, (_, i) => pointAt(rail, i / count));
}

/** Every rail the samples and the examples draw. */
function allRails(): Rail[] {
  const dsls = [
    ...[
      '01-infra-ha-failover.dav',
      '04-enterprise-zero-trust-payment.dav',
      '05-sequence-payment-retry.dav',
      '07-dynamic-architect-viewer.dav',
    ].map(readExample),
    ...SAMPLE_TEMPLATES.map((t) => t.dsl),
  ];
  return dsls.flatMap((dsl) => {
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    return doc.steps.flatMap((_, i) => {
      const view = resolveView(doc, layout, i);
      return [...view.edges.map((e) => e.path), ...view.phases.flat().map((p) => p.path)];
    });
  });
}

/** A fixed sequence of numbers in [0, 1), so that the test is the same every run. */
function sequence(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('the runs of a rail', () => {
  const rails = allRails().map(samples);
  const next = sequence(7);
  /** Rectangles around and across a rail, some on its own lines, of callout-like sizes. */
  const rectsNear = (points: readonly Point[]): Rect[] => {
    const b = boundsOfPoints(points);
    return Array.from({ length: 60 }, (_, i) => {
      const width = 40 + Math.floor(next() * 300);
      const height = 30 + Math.floor(next() * 120);
      const onLine = points[Math.floor(next() * points.length)] as Point;
      // Every third one starts exactly on a sample, where ties are decided.
      const x = i % 3 === 0 ? onLine.x : b.minX - 200 + next() * (b.maxX - b.minX + 400);
      const y = i % 3 === 1 ? onLine.y : b.minY - 200 + next() * (b.maxY - b.minY + 400);
      return { x, y, width, height };
    });
  };

  it('gives the nearest sample exactly as a search of every sample does', () => {
    expect(rails.length).toBeGreaterThan(50);
    for (const points of rails) {
      const runs = runsOf(points);
      for (const rect of rectsNear(points)) {
        let one = Number.POSITIVE_INFINITY;
        for (const p of points) one = Math.min(one, reach(rect, p));
        expect(nearestRun(rect, runs)).toBe(one);
        // And the bounds never claim more than that.
        expect(reachBounds(rect, boundsOfPoints(points))).toBeLessThanOrEqual(one);
      }
    }
  });

  it('tells whether a sample lies inside a rectangle as a search of every sample does', () => {
    for (const points of rails) {
      const runs = runsOf(points);
      for (const rect of rectsNear(points)) {
        const one = points.some(
          (p) =>
            p.x > rect.x && p.x < rect.x + rect.width && p.y > rect.y && p.y < rect.y + rect.height,
        );
        expect(runsEnter(rect, runs)).toBe(one);
      }
    }
  });

  it('groups the straight pieces of a route into runs', () => {
    const route = {
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 150 },
      ],
    };
    const runs = runsOf(samples(route));
    expect(runs.level.length).toBeGreaterThan(0);
    expect(runs.upright.length).toBeGreaterThan(0);
  });
});
