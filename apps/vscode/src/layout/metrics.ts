import type { DavDocument, IconName } from '../model/types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Resolved geometry for every node and group. Plain objects so it serializes to JSON. */
export interface Layout {
  nodes: Record<string, Rect>;
  groups: Record<string, Rect>;
}

/** Each node occupies a station with its badge above and its labels below. */
export const NODE_SIZE = { width: 176, height: 118 } as const;
/** Vertical center of every station, so rails between stations in a row run straight. */
export const STATION_CENTER = 50;
export const STATION_SIZE = 44;
export const WINDOW_SIZE = { width: 54, height: 44 } as const;
export const GROUP_PADDING = 16;
/** Room for the zone name above its stations. */
export const GROUP_HEADER = 18;
export const ORIGIN = { x: 40, y: 40 };
export const EMPTY_GROUP_CONTENT = { width: 160, height: 40 };
/** Space above a node for its self-loop and that loop's label; further loops nest outside. */
const SELF_LOOP_ROOM = 30;
const SELF_LOOP_EXTRA_ROOM = 18;

/** The station symbol within a node's rectangle. */
export function stationRect(node: Rect, icon: IconName): Rect {
  const size =
    icon === 'screen' || icon === 'modal'
      ? WINDOW_SIZE
      : { width: STATION_SIZE, height: STATION_SIZE };
  return {
    x: node.x + (node.width - size.width) / 2,
    y: node.y + STATION_CENTER - size.height / 2,
    ...size,
  };
}

/** Vertical space each node with self-loops needs above its rectangle. */
export function selfLoopRoom(doc: Pick<DavDocument, 'edges'>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of doc.edges) {
    if (e.from === e.to) counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
  }
  return new Map(
    [...counts].map(([id, n]) => [id, SELF_LOOP_ROOM + (n - 1) * SELF_LOOP_EXTRA_ROOM]),
  );
}

/** Prototype-less map: IDs such as `__proto__` or `constructor` must behave as plain keys. */
export function rectRecord(): Record<string, Rect> {
  return Object.create(null);
}

export function rectOverlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Smallest rectangle containing all `rects` (returns a zero-sized rect at `ORIGIN` when empty). */
export function enclosingRect(rects: readonly Rect[]): Rect {
  const first = rects[0];
  if (!first) return { ...ORIGIN, width: 0, height: 0 };
  let minX = first.x;
  let minY = first.y;
  let maxX = first.x + first.width;
  let maxY = first.y + first.height;
  for (let i = 1; i < rects.length; i++) {
    const r = rects[i];
    if (!r) continue;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
