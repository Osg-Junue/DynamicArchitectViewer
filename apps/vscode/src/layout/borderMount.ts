import { synthesizedConnections } from '../model/connections';
import type { DavDocument, DavNode } from '../model/types';
import { ancestorIds, parentMap } from '../model/zones';
import {
  enclosingRect,
  GROUP_PADDING,
  groupHeaderHeight,
  type Layout,
  NODE_SIZE,
  type Rect,
  rectRecord,
  STATION_CENTER,
  zoneMinWidth,
  zoneNeededWidth,
} from './metrics';

type Side = 'left' | 'right' | 'top' | 'bottom';

const MIN_INNER_CLEAR_X = 56;
const MIN_INNER_CLEAR_Y = 44;
const TOP_MOUNT_INNER_CLEAR = NODE_SIZE.height - STATION_CENTER + 8;
const BOT_MOUNT_INNER_CLEAR = 36;
const MOUNT_OUTER_CLEAR = 28;
const MIN_EDGE_INSET_X = 20;
const MIN_EDGE_INSET_Y = 24;
const SIDE_SEP_Y = NODE_SIZE.height + 12;
const SIDE_SEP_X = 136;

const clamp = (v: number, lo: number, hi: number): number =>
  hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));

function centerOf(r: Rect, isNode: boolean): { x: number; y: number } {
  return {
    x: r.x + r.width / 2,
    y: isNode ? r.y + STATION_CENTER : r.y + r.height / 2,
  };
}

/** Collects every node and group ID strictly inside `groupId`'s subtree (including `groupId`). */
function subtreeIds(
  doc: DavDocument,
  groupId: string,
  groupParent: ReadonlyMap<string, string | undefined>,
): Set<string> {
  const inside = new Set<string>([groupId]);
  for (const g of doc.groups) {
    if (ancestorIds(groupParent, g.parentId).includes(groupId)) inside.add(g.id);
  }
  for (const n of doc.nodes) {
    if (n.parentId !== undefined && inside.has(n.parentId)) inside.add(n.id);
  }
  return inside;
}

/** Spreads sorted 1D centers apart by at least `minSep`, keeping them within `[lo, hi]`. */
function spaceAlongSide(targets: number[], minSep: number, lo: number, hi: number): number[] {
  if (targets.length === 0) return [];
  const out = targets.map((v) => clamp(v, lo, hi));
  if (out.length === 1) return out;
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1] ?? lo;
    const cur = out[i] ?? lo;
    if (cur < prev + minSep) out[i] = prev + minSep;
  }
  const last = out[out.length - 1] ?? hi;
  if (last > hi) {
    const shift = last - hi;
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? lo) - shift;
    for (let i = 0; i < out.length; i++) {
      if ((out[i] ?? lo) < lo) out[i] = lo;
    }
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1] ?? lo;
      const cur = out[i] ?? lo;
      if (cur < prev + minSep) out[i] = prev + minSep;
    }
  }
  return out;
}

/** The least room kept between a node mounted on a border and anything it does not belong to. */
const MOUNT_GAP = 8;
/** At most this many openings, so that the pass ends whatever the diagram. */
const MAX_OPENINGS = 400;

type Axis = 'x' | 'y';

/** Where a mounted node went: its group, and the side of the group it stands on. */
interface Mount {
  parentId: string;
  side: Side;
}

const startOf = (r: Rect, axis: Axis): number => (axis === 'x' ? r.x : r.y);
const endOf = (r: Rect, axis: Axis): number => (axis === 'x' ? r.x + r.width : r.y + r.height);
/** A node counts by its station, the point a mounted node puts on the border. */
const stationOf = (r: Rect, axis: Axis): number =>
  axis === 'x' ? r.x + r.width / 2 : r.y + STATION_CENTER;

/**
 * Whether a node lies beyond the line `at` on `axis`. A node mounted on the near side of its group
 * (left or top) goes with the group, and one on the far side (right or bottom) goes with that side
 * of it, so that both stay on their border. Any other node goes by its station.
 */
function nodeBeyond(
  id: string,
  rect: Rect,
  groups: Readonly<Record<string, Rect>>,
  mounts: ReadonlyMap<string, Mount>,
  axis: Axis,
  at: number,
): boolean {
  const mount = mounts.get(id);
  const parent = mount ? groups[mount.parentId] : undefined;
  if (mount && parent) {
    if (mount.side === (axis === 'x' ? 'left' : 'top')) return startOf(parent, axis) >= at;
    if (mount.side === (axis === 'x' ? 'right' : 'bottom')) return endOf(parent, axis) > at;
  }
  return stationOf(rect, axis) >= at;
}

/**
 * Opens `delta` of room across the whole diagram at the line `at` on `axis`: a group wholly beyond
 * the line moves, a group across it grows, and a node beyond it moves. Nothing that stood apart
 * comes closer, and every member stays inside its group.
 */
function openRoom(
  nodes: Record<string, Rect>,
  groups: Record<string, Rect>,
  mounts: ReadonlyMap<string, Mount>,
  axis: Axis,
  at: number,
  delta: number,
): void {
  // Decided before anything moves, since a mounted node follows the border of its group.
  const moving = Object.entries(nodes)
    .filter(([id, r]) => nodeBeyond(id, r, groups, mounts, axis, at))
    .map(([, r]) => r);
  for (const r of Object.values(groups)) {
    if (startOf(r, axis) >= at) {
      if (axis === 'x') r.x += delta;
      else r.y += delta;
    } else if (endOf(r, axis) > at) {
      if (axis === 'x') r.width += delta;
      else r.height += delta;
    }
  }
  for (const r of moving) {
    if (axis === 'x') r.x += delta;
    else r.y += delta;
  }
}

interface Placed {
  id: string;
  rect: Rect;
  isNode: boolean;
}

interface Opening {
  axis: Axis;
  at: number;
  delta: number;
}

/**
 * The opening on `axis` that takes `other` clear of the mounted node `self`, moving whichever of
 * the two lies further along, or `undefined` when no line on `axis` parts them.
 */
function openingBetween(
  self: Placed,
  other: Placed,
  groups: Readonly<Record<string, Rect>>,
  mounts: ReadonlyMap<string, Mount>,
  axis: Axis,
): Opening | undefined {
  const beyond = (p: Placed, at: number) =>
    p.isNode ? nodeBeyond(p.id, p.rect, groups, mounts, axis, at) : startOf(p.rect, axis) >= at;
  const before = (p: Placed, at: number) =>
    p.isNode ? !nodeBeyond(p.id, p.rect, groups, mounts, axis, at) : endOf(p.rect, axis) <= at;
  // The furthest line that still moves `p`.
  const lineOf = (p: Placed): number => {
    if (!p.isNode) return startOf(p.rect, axis);
    const mount = mounts.get(p.id);
    const parent = mount ? groups[mount.parentId] : undefined;
    if (mount && parent && mount.side === (axis === 'x' ? 'left' : 'top')) {
      return startOf(parent, axis);
    }
    if (mount && parent && mount.side === (axis === 'x' ? 'right' : 'bottom')) {
      return endOf(parent, axis) - 0.5;
    }
    return stationOf(p.rect, axis);
  };
  const middle = (p: Placed) =>
    p.isNode ? stationOf(p.rect, axis) : (startOf(p.rect, axis) + endOf(p.rect, axis)) / 2;
  const pairs: Array<[Placed, Placed]> =
    middle(other) < middle(self)
      ? [
          [self, other],
          [other, self],
        ]
      : [
          [other, self],
          [self, other],
        ];
  for (const [mover, stayer] of pairs) {
    const at = lineOf(mover);
    if (!beyond(mover, at) || !before(stayer, at)) continue;
    const delta = endOf(stayer.rect, axis) + MOUNT_GAP - startOf(mover.rect, axis);
    if (delta > 0) return { axis, at, delta: Math.ceil(delta) };
  }
  return undefined;
}

/** Whether two rectangles come closer than `MOUNT_GAP`. */
const tooClose = (a: Rect, b: Rect): boolean =>
  a.x - MOUNT_GAP < b.x + b.width &&
  b.x < a.x + a.width + MOUNT_GAP &&
  a.y - MOUNT_GAP < b.y + b.height &&
  b.y < a.y + a.height + MOUNT_GAP;

/**
 * A mounted node stands half outside its group, in room the layout did not keep for it, so it can
 * cover a node or the frame of a group beside it. Opens room until no mounted node comes closer
 * than `MOUNT_GAP` to anything but the groups around it: one mounted node at a time, in the order
 * of the file, the largest opening first. A diagram where nothing is too close is left as it is.
 */
function separateMounted(
  doc: DavDocument,
  nodes: Record<string, Rect>,
  groups: Record<string, Rect>,
  mounts: ReadonlyMap<string, Mount>,
): void {
  if (mounts.size === 0) return;
  const groupParent = parentMap(doc.groups);
  const everything = [
    ...doc.nodes.map((n) => ({ id: n.id, isNode: true })),
    ...doc.groups.map((g) => ({ id: g.id, isNode: false })),
  ];
  const parted = new Set<string>();
  for (let round = 0; round < MAX_OPENINGS; round++) {
    let best: Opening | undefined;
    for (const n of doc.nodes) {
      const mount = mounts.get(n.id);
      const rect = nodes[n.id];
      if (!mount || !rect) continue;
      const around = new Set(ancestorIds(groupParent, mount.parentId));
      const normal: Axis = mount.side === 'left' || mount.side === 'right' ? 'x' : 'y';
      const across: Axis = normal === 'x' ? 'y' : 'x';
      const self: Placed = { id: n.id, rect, isNode: true };
      for (const o of everything) {
        if (o.id === n.id || (!o.isNode && around.has(o.id))) continue;
        const r = o.isNode ? nodes[o.id] : groups[o.id];
        const key = `${n.id}\0${o.id}`;
        if (!r || parted.has(key) || !tooClose(rect, r)) continue;
        const other: Placed = { id: o.id, rect: r, isNode: o.isNode };
        const opening =
          openingBetween(self, other, groups, mounts, normal) ??
          openingBetween(self, other, groups, mounts, across);
        // No line parts these two: leave them, rather than ask again.
        if (!opening) parted.add(key);
        else if (!best || opening.delta > best.delta) best = opening;
      }
      if (best) break;
    }
    if (!best) return;
    openRoom(nodes, groups, mounts, best.axis, best.at, best.delta);
  }
}

/**
 * Positions nodes declared with `[mount: border]` so their station center straddles their parent
 * group's boundary on the side facing their external connections, shrinking the parent group's
 * border inward to the mounted station when interior space permits. A side lengthens when more
 * nodes are mounted on it than it holds, and room opens where a mounted node would come too close
 * to a node or a group it does not belong to.
 *
 * Returns `layout` unchanged when no node uses `mount: 'border'`.
 */
export function applyBorderMounts(doc: DavDocument, layout: Layout): Layout {
  const mountedByParent = new Map<string, DavNode[]>();
  for (const n of doc.nodes) {
    if (n.mount === 'border' && n.parentId && layout.nodes[n.id] && layout.groups[n.parentId]) {
      const list = mountedByParent.get(n.parentId) ?? [];
      list.push(n);
      mountedByParent.set(n.parentId, list);
    }
  }
  if (mountedByParent.size === 0) return layout;

  const nodes = rectRecord();
  for (const [id, r] of Object.entries(layout.nodes)) nodes[id] = { ...r };
  const groups = rectRecord();
  for (const [id, r] of Object.entries(layout.groups)) groups[id] = { ...r };
  // Each node once it stands on its border, so that room opened later keeps it there.
  const mounts = new Map<string, Mount>();

  const groupParent = parentMap(doc.groups);
  const groupById = new Map(doc.groups.map((g) => [g.id, g]));
  const conns = synthesizedConnections(doc);

  // Process innermost mounted groups first so parent bounds see final child rects.
  const orderedParents = [...mountedByParent.keys()].sort((a, b) => {
    const da = ancestorIds(groupParent, groupParent.get(a)).length;
    const db = ancestorIds(groupParent, groupParent.get(b)).length;
    return db - da || (a < b ? -1 : a > b ? 1 : 0);
  });

  const rectOf = (id: string): { rect: Rect; isNode: boolean } | undefined => {
    const nr = nodes[id];
    if (nr) return { rect: nr, isNode: true };
    const gr = groups[id];
    if (gr) return { rect: gr, isNode: false };
    return undefined;
  };

  for (const parentId of orderedParents) {
    const group = groupById.get(parentId);
    const oldRect = groups[parentId];
    const mounted = mountedByParent.get(parentId);
    if (!group || !oldRect || !mounted || mounted.length === 0) continue;

    const mountedIds = new Set(mounted.map((n) => n.id));
    const inside = subtreeIds(doc, parentId, groupParent);
    const interiorRects: Rect[] = [];
    for (const n of doc.nodes) {
      if (n.parentId === parentId && !mountedIds.has(n.id)) {
        const r = nodes[n.id];
        if (r) interiorRects.push(r);
      }
    }
    for (const cg of doc.groups) {
      if (cg.parentId === parentId) {
        const r = groups[cg.id];
        if (r) interiorRects.push(r);
      }
    }

    const inner = interiorRects.length > 0 ? enclosingRect(interiorRects) : undefined;
    const refCenter = inner
      ? { x: inner.x + inner.width / 2, y: inner.y + inner.height / 2 }
      : { x: oldRect.x + oldRect.width / 2, y: oldRect.y + oldRect.height / 2 };

    // Choose the border side for each mounted node from its external/internal connections.
    interface NeighborRef {
      pt: { x: number; y: number };
      animated: boolean;
    }
    interface SideEntry {
      node: DavNode;
      mCenter: { x: number; y: number };
      intNbrs: NeighborRef[];
      extNbrs: NeighborRef[];
    }
    const bySide: Record<Side, SideEntry[]> = {
      left: [],
      right: [],
      top: [],
      bottom: [],
    };
    for (const m of mounted) {
      const mRect = nodes[m.id];
      if (!mRect) continue;
      const mCenter = centerOf(mRect, true);
      const extNbrs: NeighborRef[] = [];
      const intNbrs: NeighborRef[] = [];
      let inDeg = 0;
      let outDeg = 0;
      for (const c of conns) {
        if (c.from !== m.id && c.to !== m.id) continue;
        const otherId = c.from === m.id ? c.to : c.from;
        if (otherId === m.id || otherId === parentId) continue;
        const info = rectOf(otherId);
        if (!info) continue;
        const pt = centerOf(info.rect, info.isNode);
        if (inside.has(otherId)) {
          intNbrs.push({ pt, animated: c.animated });
          if (c.from === m.id) outDeg++;
          else inDeg++;
        } else {
          extNbrs.push({ pt, animated: c.animated });
        }
      }

      let side: Side;
      if (extNbrs.length > 0) {
        const avgX = extNbrs.reduce((s, n) => s + n.pt.x, 0) / extNbrs.length;
        const avgY = extNbrs.reduce((s, n) => s + n.pt.y, 0) / extNbrs.length;
        const dx = avgX - refCenter.x;
        const dy = avgY - refCenter.y;
        const nx = dx / Math.max(1, oldRect.width / 2);
        const ny = dy / Math.max(1, oldRect.height / 2);
        if (Math.abs(nx) >= Math.abs(ny)) side = nx <= 0 ? 'left' : 'right';
        else side = ny <= 0 ? 'top' : 'bottom';
        // Avoid aspect-ratio bias pulling a clearly left/right external peer onto top/bottom
        // where header clearance can push the mounted node past its internal target and cause a U-turn.
        if (side === 'top' || side === 'bottom') {
          const outsideLeft = avgX < oldRect.x - 16;
          const outsideRight = avgX > oldRect.x + oldRect.width + 16;
          if ((outsideLeft || outsideRight) && Math.abs(dx) >= Math.abs(dy)) {
            side = outsideLeft ? 'left' : 'right';
          } else if (side === 'top' && outsideLeft && intNbrs.length > 0) {
            const topClearX =
              oldRect.x +
              Math.min(
                zoneNeededWidth(group.label, Boolean(group.icon)) + 40,
                oldRect.width * 0.65,
              );
            const priInt = intNbrs.filter((n) => n.animated);
            const refInt = priInt.length > 0 ? priInt : intNbrs;
            const intAvgX = refInt.reduce((s, n) => s + n.pt.x, 0) / refInt.length;
            if (intAvgX < topClearX - 16) side = 'left';
          }
        }
      } else if (outDeg > inDeg) {
        side = 'left';
      } else if (inDeg > outDeg) {
        side = 'right';
      } else {
        side = 'top';
      }

      bySide[side].push({ node: m, mCenter, intNbrs, extNbrs });
    }

    // Collect outer bounds from enclosing parent and siblings so any outward border expansion
    // needed to clear a mounted node's label never violates containment or sibling separation.
    const grandparentId = group.parentId;
    const grandparentRect = grandparentId ? groups[grandparentId] : undefined;
    const grandparentGroup = grandparentId ? groupById.get(grandparentId) : undefined;
    const grandparentHdrH =
      grandparentGroup && grandparentRect
        ? groupHeaderHeight(
            grandparentGroup.label,
            grandparentRect.width,
            Boolean(grandparentGroup.icon),
          )
        : 0;
    const siblingRects: Rect[] = [];
    for (const sg of doc.groups) {
      if (sg.parentId === grandparentId && sg.id !== parentId) {
        const sr = groups[sg.id];
        if (sr) siblingRects.push(sr);
      }
    }
    for (const sn of doc.nodes) {
      if (sn.parentId === grandparentId) {
        const sr = nodes[sn.id];
        if (sr) siblingRects.push(sr);
      }
    }

    // Shrink parent group borders inward onto mounted stations where interior space permits,
    // or expand outward within available parent/sibling clearance when a mounted node's station
    // or label would otherwise intrude into interior members (e.g. top-mounted IGW above a subnet).
    let newLeft = oldRect.x;
    let newRight = oldRect.x + oldRect.width;
    let newTop = oldRect.y;
    let newBot = oldRect.y + oldRect.height;

    if (inner) {
      const origMounted = mounted
        .map((m) => layout.nodes[m.id])
        .filter((r): r is Rect => r !== undefined);

      if (bySide.left.length > 0) {
        const maxLeft = inner.x - MIN_INNER_CLEAR_X;
        const desired = Math.max(
          ...bySide.left.map((e) => centerOf(nodes[e.node.id] as Rect, true).x),
        );
        if (maxLeft >= oldRect.x + MIN_EDGE_INSET_X) {
          newLeft = Math.round(clamp(desired, oldRect.x + MIN_EDGE_INSET_X, maxLeft));
        } else if (maxLeft < oldRect.x) {
          let minAllowedLeft = grandparentRect
            ? grandparentRect.x + GROUP_PADDING + MOUNT_OUTER_CLEAR
            : Number.NEGATIVE_INFINITY;
          for (const sr of siblingRects) {
            if (sr.y < newBot && sr.y + sr.height > newTop && sr.x + sr.width <= oldRect.x + 1) {
              minAllowedLeft = Math.max(minAllowedLeft, sr.x + sr.width + MOUNT_OUTER_CLEAR);
            }
          }
          if (minAllowedLeft < oldRect.x) {
            newLeft = Math.round(Math.max(minAllowedLeft, maxLeft));
          }
        }
      } else if (origMounted.some((r) => r.x < inner.x) && inner.x - GROUP_PADDING > newLeft) {
        newLeft = Math.round(
          Math.min(
            inner.x - GROUP_PADDING,
            newRight - zoneMinWidth(group.label, Boolean(group.icon)),
          ),
        );
        if (newLeft < oldRect.x) newLeft = oldRect.x;
      }
      if (bySide.right.length > 0) {
        const minRight = Math.max(
          inner.x + inner.width + MIN_INNER_CLEAR_X,
          newLeft + zoneMinWidth(group.label, Boolean(group.icon)),
        );
        const desired = Math.min(
          ...bySide.right.map((e) => centerOf(nodes[e.node.id] as Rect, true).x),
        );
        if (minRight <= oldRect.x + oldRect.width - MIN_EDGE_INSET_X) {
          newRight = Math.round(
            clamp(desired, minRight, oldRect.x + oldRect.width - MIN_EDGE_INSET_X),
          );
        } else if (minRight > oldRect.x + oldRect.width) {
          let maxAllowedRight = grandparentRect
            ? grandparentRect.x + grandparentRect.width - GROUP_PADDING - MOUNT_OUTER_CLEAR
            : Number.POSITIVE_INFINITY;
          for (const sr of siblingRects) {
            if (
              sr.y < newBot &&
              sr.y + sr.height > newTop &&
              sr.x >= oldRect.x + oldRect.width - 1
            ) {
              maxAllowedRight = Math.min(maxAllowedRight, sr.x - MOUNT_OUTER_CLEAR);
            }
          }
          if (maxAllowedRight > oldRect.x + oldRect.width) {
            newRight = Math.round(Math.min(maxAllowedRight, minRight));
          }
        }
      } else if (
        origMounted.some((r) => r.x + r.width > inner.x + inner.width) &&
        inner.x + inner.width + GROUP_PADDING < newRight
      ) {
        newRight = Math.round(
          Math.max(
            inner.x + inner.width + GROUP_PADDING,
            newLeft + zoneMinWidth(group.label, Boolean(group.icon)),
          ),
        );
        if (newRight > oldRect.x + oldRect.width) newRight = oldRect.x + oldRect.width;
      }
      const hdrH = groupHeaderHeight(group.label, newRight - newLeft, Boolean(group.icon));
      if (bySide.top.length > 0) {
        const maxTop = inner.y - Math.max(hdrH + MIN_INNER_CLEAR_Y, TOP_MOUNT_INNER_CLEAR);
        const desired = Math.max(
          ...bySide.top.map((e) => centerOf(nodes[e.node.id] as Rect, true).y),
        );
        if (maxTop >= oldRect.y + MIN_EDGE_INSET_Y) {
          newTop = Math.round(clamp(desired, oldRect.y + MIN_EDGE_INSET_Y, maxTop));
        } else if (maxTop < oldRect.y) {
          let minAllowedTop = grandparentRect
            ? grandparentRect.y + grandparentHdrH + GROUP_PADDING + MOUNT_OUTER_CLEAR
            : Number.NEGATIVE_INFINITY;
          for (const sr of siblingRects) {
            if (sr.x < newRight && sr.x + sr.width > newLeft && sr.y + sr.height <= oldRect.y + 1) {
              minAllowedTop = Math.max(minAllowedTop, sr.y + sr.height + MOUNT_OUTER_CLEAR);
            }
          }
          if (minAllowedTop < oldRect.y) {
            newTop = Math.round(Math.max(minAllowedTop, maxTop));
          }
        }
      } else if (
        origMounted.some((r) => r.y < inner.y) &&
        inner.y - hdrH - GROUP_PADDING > newTop
      ) {
        newTop = Math.round(Math.min(inner.y - hdrH - GROUP_PADDING, newBot - 80));
        if (newTop < oldRect.y) newTop = oldRect.y;
      }
      if (bySide.bottom.length > 0) {
        const minBot = inner.y + inner.height + Math.max(MIN_INNER_CLEAR_Y, BOT_MOUNT_INNER_CLEAR);
        const desired = Math.min(
          ...bySide.bottom.map((e) => centerOf(nodes[e.node.id] as Rect, true).y),
        );
        if (minBot <= oldRect.y + oldRect.height - MIN_EDGE_INSET_Y) {
          newBot = Math.round(
            clamp(desired, minBot, oldRect.y + oldRect.height - MIN_EDGE_INSET_Y),
          );
        } else if (minBot > oldRect.y + oldRect.height) {
          let maxAllowedBot = grandparentRect
            ? grandparentRect.y + grandparentRect.height - GROUP_PADDING - MOUNT_OUTER_CLEAR
            : Number.POSITIVE_INFINITY;
          for (const sr of siblingRects) {
            if (
              sr.x < newRight &&
              sr.x + sr.width > newLeft &&
              sr.y >= oldRect.y + oldRect.height - 1
            ) {
              maxAllowedBot = Math.min(maxAllowedBot, sr.y - MOUNT_OUTER_CLEAR);
            }
          }
          if (maxAllowedBot > oldRect.y + oldRect.height) {
            newBot = Math.round(Math.min(maxAllowedBot, minBot));
          }
        }
      } else if (
        origMounted.some((r) => r.y + r.height > inner.y + inner.height) &&
        inner.y + inner.height + GROUP_PADDING < newBot
      ) {
        newBot = Math.round(Math.max(inner.y + inner.height + GROUP_PADDING, newTop + 80));
        if (newBot > oldRect.y + oldRect.height) newBot = oldRect.y + oldRect.height;
      }
    }

    const newRect: Rect = {
      x: newLeft,
      y: newTop,
      width: Math.max(zoneMinWidth(group.label, Boolean(group.icon)), newRight - newLeft),
      height: Math.max(80, newBot - newTop),
    };
    groups[parentId] = newRect;

    // Snap mounted nodes onto `newRect`'s edges with clean separation and header clearance.
    const hdrH = groupHeaderHeight(group.label, newRect.width, Boolean(group.icon));
    const labelClearX = () =>
      newRect.x +
      Math.min(zoneNeededWidth(group.label, Boolean(group.icon)) + 40, newRect.width * 0.65);

    // Prefer primary (`animate`) neighbors lying within the mountable edge span `[lo, hi]`
    // so distant out-of-band external nodes or `static` return edges do not jog straight flows.
    const targetCoordOf = (
      entry: SideEntry,
      vertical: boolean,
      bandLo: number,
      bandHi: number,
    ): number => {
      const axis = (p: { x: number; y: number }) => (vertical ? p.y : p.x);
      const all = [...entry.intNbrs, ...entry.extNbrs];
      const inBand = all.filter((n) => {
        const c = axis(n.pt);
        return c >= bandLo && c <= bandHi;
      });
      const inBandPrimary = inBand.filter((n) => n.animated);
      const chosen =
        inBandPrimary.length > 0
          ? inBandPrimary
          : inBand.length > 0
            ? inBand
            : entry.intNbrs.length > 0
              ? entry.intNbrs
              : all;
      if (chosen.length === 0) return axis(entry.mCenter);
      return chosen.reduce((s, n) => s + axis(n.pt), 0) / chosen.length;
    };

    for (const side of ['left', 'right', 'top', 'bottom'] as const) {
      const rawItems = bySide[side];
      if (rawItems.length === 0) continue;
      const vertical = side === 'left' || side === 'right';
      const sep = vertical ? SIDE_SEP_Y : SIDE_SEP_X;
      // Where stations may stand along this side of the group as it is now.
      const spanOf = (): [number, number] =>
        vertical
          ? [
              newRect.y + hdrH + 36,
              newRect.y + newRect.height - (NODE_SIZE.height - STATION_CENTER),
            ]
          : [
              side === 'top' ? Math.max(newRect.x + 56, labelClearX()) : newRect.x + 56,
              newRect.x + newRect.width - 56,
            ];
      let [lo, hi] = spanOf();
      const items = rawItems
        .map((entry) => ({
          node: entry.node,
          targetCoord: targetCoordOf(entry, vertical, lo, hi),
        }))
        .sort(
          (a, b) =>
            a.targetCoord - b.targetCoord ||
            (a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0),
        );
      // More nodes than the side holds: the group lengthens at the far end of that side.
      for (let grow = 0; grow < 4; grow++) {
        const short = (items.length - 1) * sep - (hi - lo);
        if (short <= 0) break;
        const end = vertical ? newRect.y + newRect.height : newRect.x + newRect.width;
        openRoom(nodes, groups, mounts, vertical ? 'y' : 'x', end - 0.5, Math.ceil(short));
        [lo, hi] = spanOf();
      }
      const along = spaceAlongSide(
        items.map((i) => i.targetCoord),
        sep,
        lo,
        hi,
      );
      const border =
        side === 'left'
          ? newRect.x
          : side === 'right'
            ? newRect.x + newRect.width
            : side === 'top'
              ? newRect.y
              : newRect.y + newRect.height;
      items.forEach((item, idx) => {
        const c = along[idx] ?? lo;
        const [cx, cy] = vertical ? [border, c] : [c, border];
        nodes[item.node.id] = {
          x: Math.round(cx - NODE_SIZE.width / 2),
          y: Math.round(cy - STATION_CENTER),
          width: NODE_SIZE.width,
          height: NODE_SIZE.height,
        };
        mounts.set(item.node.id, { parentId, side });
      });
    }
  }

  separateMounted(doc, nodes, groups, mounts);
  return { nodes, groups };
}
