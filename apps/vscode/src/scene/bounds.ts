import type { Rect } from '../layout';

const SCENE_PADDING = 48;
/** Extra room above a framed diagram for speech bubbles. */
export const BUBBLE_HEADROOM = 76;

/** Bounding box of rectangles plus scene padding (extra top headroom for speech bubbles). */
export function boundsOf(
  rects: readonly Rect[],
  pad = SCENE_PADDING,
  headroom = BUBBLE_HEADROOM,
): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 400, height: 300 };
  const minX = Math.min(...rects.map((r) => r.x)) - pad;
  const minY = Math.min(...rects.map((r) => r.y)) - pad - headroom;
  const maxX = Math.max(...rects.map((r) => r.x + r.width)) + pad;
  const maxY = Math.max(...rects.map((r) => r.y + r.height)) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
