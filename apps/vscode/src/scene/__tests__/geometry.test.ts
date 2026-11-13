import { describe, expect, it } from 'vitest';
import type { Rect } from '../../layout';
import { expandRect, segmentIntersectsRect } from '../geometry';

describe('2D rectangle and segment geometry helpers', () => {
  const box: Rect = { x: 100, y: 200, width: 80, height: 40 };

  it('expands or insets rectangles symmetrically around their center', () => {
    expect(expandRect(box, 14)).toEqual({ x: 86, y: 186, width: 108, height: 68 });
    expect(expandRect(box, 0)).toEqual(box);
    expect(expandRect(box, -10)).toEqual({ x: 110, y: 210, width: 60, height: 20 });
  });

  it('clips segments accurately via Liang–Barsky across crossing, interior, boundary, miss, and degenerate cases', () => {
    // Horizontal, vertical, and diagonal crossings
    expect(segmentIntersectsRect({ x: 50, y: 220 }, { x: 220, y: 220 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 140, y: 150 }, { x: 140, y: 260 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 80, y: 180 }, { x: 200, y: 260 }, box)).toBe(true);

    // Segment wholly inside or touching an edge/corner
    expect(segmentIntersectsRect({ x: 110, y: 210 }, { x: 170, y: 230 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 100, y: 180 }, { x: 100, y: 210 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 80, y: 220 }, { x: 120, y: 180 }, box)).toBe(true);

    // Parallel outside, collinear stopping short, and diagonal passing outside corner
    expect(segmentIntersectsRect({ x: 50, y: 190 }, { x: 220, y: 190 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 40, y: 220 }, { x: 95, y: 220 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 185, y: 220 }, { x: 240, y: 220 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 80, y: 210 }, { x: 110, y: 180 }, box)).toBe(false);

    // Zero or negative dimensions never intersect
    expect(
      segmentIntersectsRect(
        { x: 90, y: 200 },
        { x: 110, y: 200 },
        { x: 100, y: 190, width: 0, height: 20 },
      ),
    ).toBe(false);
    expect(
      segmentIntersectsRect(
        { x: 100, y: 190 },
        { x: 100, y: 210 },
        { x: 90, y: 200, width: 20, height: 0 },
      ),
    ).toBe(false);
  });
});
