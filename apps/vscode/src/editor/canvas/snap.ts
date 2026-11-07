import type { Rect } from '../../layout';
import type { Point } from '../../model/types';

export const SNAP_GRID = 10;
export const GUIDE_THRESHOLD = 6;

export interface SnapGuide {
  axis: 'x' | 'y';
  position: number;
  from: number;
  to: number;
}

export interface SnapResult {
  pos: Point;
  guides: SnapGuide[];
}

export function snapScalar(value: number, grid = SNAP_GRID): number {
  return Math.round(value / grid) * grid;
}

/**
 * Snaps a moving rectangle against other rectangles' edges and centers first;
 * falls back to grid snapping on axes without an alignment match.
 */
export function computeSnap(
  moving: Rect,
  others: readonly Rect[],
  options: { enableGrid?: boolean; enableGuides?: boolean } = {},
): SnapResult {
  const enableGrid = options.enableGrid ?? true;
  const enableGuides = options.enableGuides ?? true;

  let x = moving.x;
  let y = moving.y;
  const guides: SnapGuide[] = [];

  if (enableGuides && others.length > 0) {
    const movingXPoints = [
      { offset: 0, value: moving.x },
      { offset: moving.width / 2, value: moving.x + moving.width / 2 },
      { offset: moving.width, value: moving.x + moving.width },
    ];
    const movingYPoints = [
      { offset: 0, value: moving.y },
      { offset: moving.height / 2, value: moving.y + moving.height / 2 },
      { offset: moving.height, value: moving.y + moving.height },
    ];

    let bestDx = GUIDE_THRESHOLD + 1;
    let matchedX: { nextX: number; guide: SnapGuide } | null = null;

    let bestDy = GUIDE_THRESHOLD + 1;
    let matchedY: { nextY: number; guide: SnapGuide } | null = null;

    for (const other of others) {
      const targetXs = [other.x, other.x + other.width / 2, other.x + other.width];
      for (const mp of movingXPoints) {
        for (const tx of targetXs) {
          const d = Math.abs(mp.value - tx);
          if (d < bestDx) {
            bestDx = d;
            const nextX = Math.round(tx - mp.offset);
            matchedX = {
              nextX,
              guide: {
                axis: 'x',
                position: Math.round(tx),
                from: Math.min(moving.y, other.y) - 16,
                to: Math.max(moving.y + moving.height, other.y + other.height) + 16,
              },
            };
          }
        }
      }

      const targetYs = [other.y, other.y + other.height / 2, other.y + other.height];
      for (const mp of movingYPoints) {
        for (const ty of targetYs) {
          const d = Math.abs(mp.value - ty);
          if (d < bestDy) {
            bestDy = d;
            const nextY = Math.round(ty - mp.offset);
            matchedY = {
              nextY,
              guide: {
                axis: 'y',
                position: Math.round(ty),
                from: Math.min(moving.x, other.x) - 16,
                to: Math.max(moving.x + moving.width, other.x + other.width) + 16,
              },
            };
          }
        }
      }
    }

    if (matchedX) {
      x = matchedX.nextX;
      guides.push(matchedX.guide);
    } else if (enableGrid) {
      x = snapScalar(x);
    }

    if (matchedY) {
      y = matchedY.nextY;
      guides.push(matchedY.guide);
    } else if (enableGrid) {
      y = snapScalar(y);
    }
  } else if (enableGrid) {
    x = snapScalar(x);
    y = snapScalar(y);
  } else {
    x = Math.round(x);
    y = Math.round(y);
  }

  return { pos: { x, y }, guides };
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/** Computes aligned positions for a multi-selection of elements. */
export function alignRects(
  items: ReadonlyArray<{ id: string; rect: Rect }>,
  mode: AlignMode,
): Map<string, Point> {
  const out = new Map<string, Point>();
  if (items.length < 2) return out;

  const minX = Math.min(...items.map((i) => i.rect.x));
  const maxX = Math.max(...items.map((i) => i.rect.x + i.rect.width));
  const centerX = (minX + maxX) / 2;

  const minY = Math.min(...items.map((i) => i.rect.y));
  const maxY = Math.max(...items.map((i) => i.rect.y + i.rect.height));
  const centerY = (minY + maxY) / 2;

  for (const { id, rect } of items) {
    switch (mode) {
      case 'left':
        out.set(id, { x: Math.round(minX), y: Math.round(rect.y) });
        break;
      case 'center':
        out.set(id, { x: Math.round(centerX - rect.width / 2), y: Math.round(rect.y) });
        break;
      case 'right':
        out.set(id, { x: Math.round(maxX - rect.width), y: Math.round(rect.y) });
        break;
      case 'top':
        out.set(id, { x: Math.round(rect.x), y: Math.round(minY) });
        break;
      case 'middle':
        out.set(id, { x: Math.round(rect.x), y: Math.round(centerY - rect.height / 2) });
        break;
      case 'bottom':
        out.set(id, { x: Math.round(rect.x), y: Math.round(maxY - rect.height) });
        break;
    }
  }
  return out;
}
