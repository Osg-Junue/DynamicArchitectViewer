import type { DavDocument } from '../model/types';
import { analyzeFlow, flowPairKey } from './flow';
import { type Link, linksOf, properlyCross, type Segment, shareStation } from './links';
import {
  GROUP_PADDING,
  groupHeaderHeight,
  type Layout,
  type Rect,
  rectRecord,
  STATION_CENTER,
  selfLoopRoom,
} from './metrics';
import { ownersOf } from './zoneBlocks';

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
 * nodes, their loops and the groups it is not in. Where the move would bend a straight link of
 * the node, the node at its other end is tried moving along with it. It takes the move that
 * straightens the most links, then the one that moves fewer nodes, and none that bends as many
 * links as it straightens or makes them cross more, on straight lines between stations. Frames
 * are left as they are.
 */
export function straightenNodes(doc: DavDocument, layout: Layout): Layout {
  const nodes = rectRecord();
  for (const [id, r] of Object.entries(layout.nodes)) nodes[id] = { ...r };
  const { groups } = layout;
  const loopRoom = selfLoopRoom(doc);
  const parentOf = new Map(doc.nodes.map((n) => [n.id, n.parentId]));
  const groupParent = new Map(doc.groups.map((g) => [g.id, g.parentId]));
  const groupLabel = new Map(doc.groups.map((g) => [g.id, g.label]));
  const groupHasIcon = new Map(doc.groups.map((g) => [g.id, Boolean(g.icon)]));
  const flow = analyzeFlow(doc);
  const owners = ownersOf(doc);
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
      if (id !== link[0] && id !== link[1] && near(reach(id, nodes[id] as Rect), between, 0)) {
        return false;
      }
    }
    return true;
  };
  /** The links of any of `ids`, each once. */
  const linksOfAll = (ids: readonly string[]): Link[] => [
    ...new Set(ids.flatMap((id) => linksAt.get(id) ?? [])),
  ];
  const straightOf = (some: readonly Link[]): number =>
    some.filter((link) => isStraight(link)).length;
  /** Crossings of `some` with any link, on straight lines between stations. */
  const crossingsOf = (some: readonly Link[]): number => {
    let count = 0;
    for (const link of some) {
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
    const headerH =
      frameId && frame
        ? groupHeaderHeight(
            groupLabel.get(frameId) ?? '',
            frame.width,
            groupHasIcon.get(frameId) ?? false,
          )
        : 0;
    if (
      frame &&
      (own.x < frame.x + GROUP_PADDING ||
        own.x + own.width > frame.x + frame.width - GROUP_PADDING ||
        own.y < frame.y + headerH + GROUP_PADDING ||
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

  const shift = (ids: readonly string[], dx: number, dy: number): void => {
    for (const id of ids) {
      const r = nodes[id] as Rect;
      r.x += dx;
      r.y += dy;
    }
  };
  /**
   * What moving `ids` together gains in straight links, or 0 where they do not fit, where it
   * gains none, or where their links would cross more.
   */
  const weigh = (ids: readonly string[], dx: number, dy: number): number => {
    const home = ids.map((id) => ({ ...(nodes[id] as Rect) }));
    const goHome = () => {
      ids.forEach((id, k) => {
        nodes[id] = { ...(home[k] as Rect) };
      });
    };
    const touched = linksOfAll(ids);
    const interZonePrimaryBefore: Array<{ from: string; to: string; linkDx: number }> = [];
    if (dx !== 0) {
      for (const link of touched) {
        const conn = flow.byPair.get(flowPairKey(link[0], link[1]));
        if (conn?.role === 'primary' && owners.get(conn.from) !== owners.get(conn.to)) {
          const linkDx =
            stationOf(nodes[conn.to] as Rect).x - stationOf(nodes[conn.from] as Rect).x;
          interZonePrimaryBefore.push({ from: conn.from, to: conn.to, linkDx });
        }
      }
    }
    const before = straightOf(touched);
    shift(ids, dx, dy);
    if (
      interZonePrimaryBefore.some(({ from, to, linkDx }) => {
        const nextDx = stationOf(nodes[to] as Rect).x - stationOf(nodes[from] as Rect).x;
        return linkDx > 0 ? nextDx <= 0 : nextDx < linkDx;
      }) ||
      !ids.every((id) => isClear(id, nodes[id] as Rect))
    ) {
      goHome();
      return 0;
    }
    const gain = straightOf(touched) - before;
    if (gain <= 0) {
      goHome();
      return 0;
    }
    const crossedAfter = crossingsOf(touched);
    goHome();
    return crossedAfter > crossingsOf(touched) ? 0 : gain;
  };
  /**
   * `id` and the nodes it stands level with (for a move up or down) or straight above or below
   * (for a move sideways), which would have to come along for those links to stay straight.
   */
  const withPartners = (id: string, dx: number): string[] => {
    const own = stationOf(nodes[id] as Rect);
    const ids = [id];
    for (const link of linksAt.get(id) ?? []) {
      const other = link[0] === id ? link[1] : link[0];
      const at = stationOf(nodes[other] as Rect);
      const along = dx === 0 ? Math.abs(at.y - own.y) <= NEAR_LEVEL : Math.abs(at.x - own.x) < 0.5;
      if (along && !ids.includes(other) && isStraight(link)) ids.push(other);
    }
    return ids;
  };

  for (let round = 0; round < ROUNDS; round++) {
    let moved = false;
    for (const { id } of doc.nodes) {
      const r = nodes[id];
      if (!r) continue;
      const moves: Array<{ dx: number; dy: number }> = [];
      for (const link of linksAt.get(id) ?? []) {
        const s = stationOf(r);
        const t = stationOf(nodes[link[0] === id ? link[1] : link[0]] as Rect);
        const dy = t.y - s.y;
        const dx = t.x - s.x;
        if (Math.abs(dy) > NEAR_LEVEL && Math.abs(dy) <= REACH) moves.push({ dx: 0, dy });
        if (Math.abs(dx) >= 0.5 && Math.abs(dx) <= REACH) moves.push({ dx, dy: 0 });
      }
      let best:
        | { ids: string[]; dx: number; dy: number; gain: number; distance: number }
        | undefined;
      for (const { dx, dy } of moves) {
        const partners = withPartners(id, dx);
        for (const ids of partners.length > 1 ? [[id], partners] : [[id]]) {
          const gain = weigh(ids, dx, dy);
          const distance = Math.abs(dx) + Math.abs(dy);
          if (
            gain > 0 &&
            (!best ||
              gain > best.gain ||
              (gain === best.gain && ids.length < best.ids.length) ||
              (gain === best.gain && ids.length === best.ids.length && distance < best.distance))
          ) {
            best = { ids, dx, dy, gain, distance };
          }
        }
      }
      if (best) {
        shift(best.ids, best.dx, best.dy);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { nodes, groups };
}
