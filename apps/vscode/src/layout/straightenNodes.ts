import type { DavDocument } from '../model/types';
import { type Link, linksOf, properlyCross, type Segment, shareStation } from './links';
import {
  GROUP_HEADER,
  GROUP_PADDING,
  type Layout,
  type Rect,
  rectRecord,
  STATION_CENTER,
  selfLoopRoom,
} from './metrics';

/** How far a node moves to put one of its links level or upright. */
const REACH = 60;
/** Stations this near level are joined by one straight line already, as the routing draws them. */
const NEAR_LEVEL = 12;
/** What a moved node keeps clear of other nodes: the gap between rows. */
const NODE_GAP = 14;
/** What a moved node keeps clear of a group it is not in: the gap between stacked blocks. */
const GROUP_GAP = 28;
const ROUNDS = 4;

const stationOf = (r: Rect): { x: number; y: number } => ({
  x: r.x + r.width / 2,
  y: r.y + STATION_CENTER,
});

const near = (a: Rect, b: Rect, gap: number): boolean =>
  a.x < b.x + b.width + gap &&
  b.x < a.x + a.width + gap &&
  a.y < b.y + b.height + gap &&
  b.y < a.y + a.height + gap;

/**
 * Moves single nodes the little it takes to put one of their links level, or one station
 * straight above the other, where the rail would otherwise step aside with two bends. The
 * layout places nodes by columns and rows, and zones as wholes, so a node can stand a few
 * units off the one it is linked to although its group has room for it to stand level.
 *
 * A node moves up to `REACH`, only inside the frame it stands in, and keeps clear of the other
 * nodes, their loops and the groups it is not in. It takes the move that straightens the most
 * of its links, and none that bends more of them than it straightens or makes its links cross
 * more, on straight lines between stations. Frames are left as they are.
 */
export function straightenNodes(doc: DavDocument, layout: Layout): Layout {
  const nodes = rectRecord();
  for (const [id, r] of Object.entries(layout.nodes)) nodes[id] = { ...r };
  const { groups } = layout;
  const loopRoom = selfLoopRoom(doc);
  const parentOf = new Map(doc.nodes.map((n) => [n.id, n.parentId]));
  const groupParent = new Map(doc.groups.map((g) => [g.id, g.parentId]));
  const links = linksOf(doc);
  const linksAt = new Map<string, Link[]>();
  for (const link of links) {
    for (const id of new Set(link)) linksAt.set(id, [...(linksAt.get(id) ?? []), link]);
  }

  /** A node with the room its loops need above it. */
  const reach = (id: string, r: Rect): Rect => {
    const room = loopRoom.get(id) ?? 0;
    return { x: r.x, y: r.y - room, width: r.width, height: r.height + room };
  };
  const segment = ([from, to]: Link): Segment => {
    const a = stationOf(nodes[from] as Rect);
    const b = stationOf(nodes[to] as Rect);
    return { from, to, ax: a.x, ay: a.y, bx: b.x, by: b.y };
  };
  /** Level or upright, with no other node between the two stations. */
  const isStraight = (link: Link): boolean => {
    const s = segment(link);
    if (Math.abs(s.ay - s.by) > NEAR_LEVEL && Math.abs(s.ax - s.bx) >= 0.5) return false;
    const between = {
      x: Math.min(s.ax, s.bx) - 1,
      y: Math.min(s.ay, s.by) - 1,
      width: Math.abs(s.ax - s.bx) + 2,
      height: Math.abs(s.ay - s.by) + 2,
    };
    for (const id in nodes) {
      if (id !== link[0] && id !== link[1] && near(nodes[id] as Rect, between, 0)) return false;
    }
    return true;
  };
  const straightAt = (id: string): number =>
    (linksAt.get(id) ?? []).filter((link) => isStraight(link)).length;
  const crossingsAt = (id: string): number => {
    let count = 0;
    for (const link of linksAt.get(id) ?? []) {
      const s = segment(link);
      for (const other of links) {
        if (other === link) continue;
        const t = segment(other);
        if (!shareStation(s, t) && properlyCross(s, t)) count++;
      }
    }
    return count;
  };
  const isClear = (id: string, r: Rect): boolean => {
    const own = reach(id, r);
    const frameId = parentOf.get(id);
    const frame = frameId ? groups[frameId] : undefined;
    if (
      frame &&
      (own.x < frame.x + GROUP_PADDING ||
        own.x + own.width > frame.x + frame.width - GROUP_PADDING ||
        own.y < frame.y + GROUP_HEADER + GROUP_PADDING ||
        own.y + own.height > frame.y + frame.height - GROUP_PADDING)
    ) {
      return false;
    }
    for (const other in nodes) {
      if (other !== id && near(own, reach(other, nodes[other] as Rect), NODE_GAP)) return false;
    }
    const inside = new Set<string>();
    for (let g = frameId; g; g = groupParent.get(g)) inside.add(g);
    for (const g in groups) {
      if (!inside.has(g) && near(own, groups[g] as Rect, GROUP_GAP)) return false;
    }
    return true;
  };

  for (let round = 0; round < ROUNDS; round++) {
    let moved = false;
    for (const { id } of doc.nodes) {
      const r = nodes[id];
      if (!r) continue;
      const home = { x: r.x, y: r.y };
      const moves: Array<{ x: number; y: number }> = [];
      for (const link of linksAt.get(id) ?? []) {
        const s = stationOf(r);
        const t = stationOf(nodes[link[0] === id ? link[1] : link[0]] as Rect);
        const dy = t.y - s.y;
        const dx = t.x - s.x;
        if (Math.abs(dy) > NEAR_LEVEL && Math.abs(dy) <= REACH) {
          moves.push({ x: home.x, y: home.y + dy });
        }
        if (Math.abs(dx) >= 0.5 && Math.abs(dx) <= REACH) {
          moves.push({ x: home.x + dx, y: home.y });
        }
      }
      // Counted only for a node with a move to weigh: most have none.
      let before: number | undefined;
      let crossedBefore: number | undefined;
      let best: { x: number; y: number; gain: number; distance: number } | undefined;
      for (const to of moves) {
        if (!isClear(id, { ...r, ...to })) continue;
        before ??= straightAt(id);
        r.x = to.x;
        r.y = to.y;
        const gain = straightAt(id) - before;
        const distance = Math.abs(to.x - home.x) + Math.abs(to.y - home.y);
        const better =
          gain > 0 &&
          (!best || gain > best.gain || (gain === best.gain && distance < best.distance));
        let crosses = false;
        if (better) {
          r.x = home.x;
          r.y = home.y;
          crossedBefore ??= crossingsAt(id);
          r.x = to.x;
          r.y = to.y;
          crosses = crossingsAt(id) > crossedBefore;
        }
        r.x = home.x;
        r.y = home.y;
        if (better && !crosses) best = { ...to, gain, distance };
      }
      if (best) {
        r.x = best.x;
        r.y = best.y;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { nodes, groups };
}
