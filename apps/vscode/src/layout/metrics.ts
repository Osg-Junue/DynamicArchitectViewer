import type { DavDocument } from '../model/types';

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
export const GROUP_PADDING = 16;
/** Room for the zone name above its stations. */
export const GROUP_HEADER = 18;
export const ORIGIN = { x: 40, y: 40 };
export const EMPTY_GROUP_CONTENT = { width: 160, height: 40 };
/** Space above a node for its self-loop and that loop's label; further loops nest outside. */
const SELF_LOOP_ROOM = 30;
const SELF_LOOP_EXTRA_ROOM = 18;

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
  return Object.create(null) as Record<string, Rect>;
}
