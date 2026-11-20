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

/**
 * Positions nodes declared with `[mount: border]` so their station center straddles their parent
 * group's boundary on the side facing their external connections, shrinking the parent group's
 * border inward to the mounted station when interior space permits.
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
        const nx = (avgX - refCenter.x) / Math.max(1, oldRect.width / 2);
        const ny = (avgY - refCenter.y) / Math.max(1, oldRect.height / 2);
        if (Math.abs(nx) >= Math.abs(ny)) side = nx <= 0 ? 'left' : 'right';
        else side = ny <= 0 ? 'top' : 'bottom';
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
        ? groupHeaderHeight(grandparentGroup.label, grandparentRect.width)
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
      }
      if (bySide.right.length > 0) {
        const minRight = Math.max(
          inner.x + inner.width + MIN_INNER_CLEAR_X,
          newLeft + zoneMinWidth(group.label),
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
      }
      const hdrH = groupHeaderHeight(group.label, newRight - newLeft);
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
      }
    }

    const newRect: Rect = {
      x: newLeft,
      y: newTop,
      width: Math.max(zoneMinWidth(group.label), newRight - newLeft),
      height: Math.max(80, newBot - newTop),
    };
    groups[parentId] = newRect;

    // Snap mounted nodes onto `newRect`'s edges with clean separation and header clearance.
    const hdrH = groupHeaderHeight(group.label, newRect.width);
    const labelClearX =
      newRect.x + Math.min(zoneNeededWidth(group.label) + 40, newRect.width * 0.65);

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
      if (side === 'left' || side === 'right') {
        const cx = side === 'left' ? newRect.x : newRect.x + newRect.width;
        const lo = newRect.y + hdrH + 36;
        const hi = newRect.y + newRect.height - (NODE_SIZE.height - STATION_CENTER);
        const items = rawItems
          .map((entry) => ({
            node: entry.node,
            targetCoord: targetCoordOf(entry, true, lo, hi),
          }))
          .sort(
            (a, b) =>
              a.targetCoord - b.targetCoord ||
              (a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0),
          );
        const ys = spaceAlongSide(
          items.map((i) => i.targetCoord),
          SIDE_SEP_Y,
          lo,
          hi,
        );
        items.forEach((item, idx) => {
          const cy = ys[idx] ?? lo;
          nodes[item.node.id] = {
            x: Math.round(cx - NODE_SIZE.width / 2),
            y: Math.round(cy - STATION_CENTER),
            width: NODE_SIZE.width,
            height: NODE_SIZE.height,
          };
        });
      } else {
        const cy = side === 'top' ? newRect.y : newRect.y + newRect.height;
        const lo = side === 'top' ? Math.max(newRect.x + 56, labelClearX) : newRect.x + 56;
        const hi = newRect.x + newRect.width - 56;
        const items = rawItems
          .map((entry) => ({
            node: entry.node,
            targetCoord: targetCoordOf(entry, false, lo, hi),
          }))
          .sort(
            (a, b) =>
              a.targetCoord - b.targetCoord ||
              (a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0),
          );
        const xs = spaceAlongSide(
          items.map((i) => i.targetCoord),
          SIDE_SEP_X,
          lo,
          hi,
        );
        items.forEach((item, idx) => {
          const cx = xs[idx] ?? lo;
          nodes[item.node.id] = {
            x: Math.round(cx - NODE_SIZE.width / 2),
            y: Math.round(cy - STATION_CENTER),
            width: NODE_SIZE.width,
            height: NODE_SIZE.height,
          };
        });
      }
    }
  }

  return { nodes, groups };
}
