import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH, estimateTextWidth } from '../model/text';
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
export const SCREEN_NODE_SIZE = NODE_SIZE;

const STATION_SIZE = 44;
const WINDOW_SIZE = { width: 54, height: 44 } as const;
/** Vertical center of every station, so rails between stations in a row run straight. */
const STATION_CENTER = 50;

const COLUMN_GAP = 36;
const EDGE_LABEL_MARGIN = 32;
const ROW_GAP = 14;
const GROUP_PADDING = 16;
/** Room for the zone name above its stations. */
const GROUP_HEADER = 18;
const CLUSTER_GAP = 28;
const ORIGIN = { x: 40, y: 40 };
const EMPTY_GROUP_CONTENT = { width: 160, height: 40 };
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

export function defaultNodeSize(_icon: IconName): { width: number; height: number } {
  return NODE_SIZE;
}

/**
 * Computes automatic positions and sizes for every node and group.
 *
 * - Nodes are placed left-to-right by longest-path rank over the edges (cycles are broken),
 *   ordered within a column by the barycenter of their predecessors.
 * - Sibling groups and ungrouped columns whose rank spans do not overlap are placed
 *   side-by-side horizontally; overlapping spans stack into vertical bands.
 * - Every group wraps its descendants (plus header and padding).
 */
export function computeLayout(doc: DavDocument): Layout {
  const sizes = new Map(doc.nodes.map((n) => [n.id, defaultNodeSize(n.icon)] as const));
  const nodes = rectRecord();
  const emptyGroups = findEmptyGroups(doc);
  const placeholders = rectRecord();
  const loopRoom = selfLoopRoom(doc);

  if (doc.nodes.length > 0 || emptyGroups.size > 0) {
    const ranks = computeRanks(
      doc.nodes.map((n) => n.id),
      doc.edges.map((e) => [e.from, e.to] as const),
    );
    placeAuto(doc, emptyGroups, ranks, sizes, nodes, placeholders, loopRoom);
  }

  return { nodes, groups: computeGroupRects(doc, nodes, placeholders, loopRoom) };
}

/** Vertical space each node with self-loops needs above its rectangle. */
function selfLoopRoom(doc: DavDocument): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of doc.edges) {
    if (e.from === e.to) counts.set(e.from, (counts.get(e.from) ?? 0) + 1);
  }
  return new Map(
    [...counts].map(([id, n]) => [id, SELF_LOOP_ROOM + (n - 1) * SELF_LOOP_EXTRA_ROOM]),
  );
}

/** Prototype-less map: IDs such as `__proto__` or `constructor` must behave as plain keys. */
function rectRecord(): Record<string, Rect> {
  return Object.create(null) as Record<string, Rect>;
}

/** Longest-path ranks; back edges found by DFS are ignored so cycles terminate. */
function computeRanks(ids: string[], edges: ReadonlyArray<readonly [string, string]>) {
  const known = new Set(ids);
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [from, to] of edges) {
    if (known.has(from) && known.has(to) && from !== to) out.get(from)?.push(to);
  }

  // Remove back edges (iterative DFS to avoid stack overflow on large graphs).
  const state = new Map<string, 0 | 1 | 2>();
  const forward = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const root of ids) {
    if (state.get(root)) continue;
    const stack: Array<{ id: string; i: number }> = [{ id: root, i: 0 }];
    state.set(root, 1);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (!frame) break;
      const targets = out.get(frame.id) ?? [];
      if (frame.i >= targets.length) {
        state.set(frame.id, 2);
        stack.pop();
        continue;
      }
      const next = targets[frame.i++];
      if (next === undefined) continue;
      const s = state.get(next) ?? 0;
      if (s === 1) continue; // back edge
      forward.get(frame.id)?.push(next);
      if (s === 0) {
        state.set(next, 1);
        stack.push({ id: next, i: 0 });
      }
    }
  }

  // Kahn's algorithm over the acyclic edge set.
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const targets of forward.values()) {
    for (const t of targets) indegree.set(t, (indegree.get(t) ?? 0) + 1);
  }
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    for (const t of forward.get(id) ?? []) {
      rank.set(t, Math.max(rank.get(t) ?? 0, (rank.get(id) ?? 0) + 1));
      const d = (indegree.get(t) ?? 0) - 1;
      indegree.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  return { rank, predecessors: invert(forward) };
}

function invert(forward: Map<string, string[]>): Map<string, string[]> {
  const preds = new Map<string, string[]>();
  for (const [from, targets] of forward) {
    for (const t of targets) {
      const list = preds.get(t) ?? [];
      list.push(from);
      preds.set(t, list);
    }
  }
  return preds;
}

interface Cluster {
  id: string | undefined;
  nodes: string[];
  children: Cluster[];
}

function placeAuto(
  doc: DavDocument,
  emptyGroups: Set<string>,
  ranks: ReturnType<typeof computeRanks>,
  sizes: Map<string, { width: number; height: number }>,
  out: Record<string, Rect>,
  placeholders: Record<string, Rect>,
  loopRoom: ReadonlyMap<string, number>,
): void {
  const needsLayout = (cluster: Cluster): boolean =>
    cluster.nodes.length > 0 ||
    (cluster.id !== undefined && emptyGroups.has(cluster.id)) ||
    cluster.children.some(needsLayout);
  const parentOf = new Map(doc.nodes.map((n) => [n.id, n.parentId]));

  // Cluster tree mirrors the group hierarchy.
  const clusters = new Map<string | undefined, Cluster>();
  const root: Cluster = { id: undefined, nodes: [], children: [] };
  clusters.set(undefined, root);
  for (const g of doc.groups) clusters.set(g.id, { id: g.id, nodes: [], children: [] });
  for (const g of doc.groups)
    clusters.get(g.parentId)?.children.push(clusters.get(g.id) as Cluster);
  for (const n of doc.nodes) clusters.get(parentOf.get(n.id))?.nodes.push(n.id);

  // Column x positions shared by all clusters.
  const rankOf = (id: string) => ranks.rank.get(id) ?? 0;
  const maxRank = Math.max(0, ...doc.nodes.map((n) => rankOf(n.id)));
  const columnWidth: number[] = Array.from({ length: maxRank + 1 }, () => NODE_SIZE.width);
  for (const n of doc.nodes) {
    const r = rankOf(n.id);
    columnWidth[r] = Math.max(columnWidth[r] ?? 0, sizes.get(n.id)?.width ?? NODE_SIZE.width);
  }
  const depthOf = (groupId: string | undefined): number => {
    let depth = 0;
    let current = groupId;
    while (current !== undefined) {
      depth++;
      current = doc.groups.find((g) => g.id === current)?.parentId;
    }
    return depth;
  };
  const maxDepth = Math.max(0, ...doc.groups.map((g) => depthOf(g.id)));
  const inset = maxDepth * GROUP_PADDING;
  const groupClearance = maxDepth * GROUP_PADDING * 2;
  // A labeled edge between adjacent columns needs room for its whole label.
  const labelGap = new Map<number, number>();
  for (const e of doc.edges) {
    if (!e.label || !sizes.has(e.from) || !sizes.has(e.to)) continue;
    const left = Math.min(rankOf(e.from), rankOf(e.to));
    if (Math.abs(rankOf(e.from) - rankOf(e.to)) !== 1) continue;
    const width = Math.min(EDGE_LABEL_MAX_WIDTH, estimateTextWidth(e.label, EDGE_LABEL_FONT_SIZE));
    labelGap.set(left, Math.max(labelGap.get(left) ?? 0, width + EDGE_LABEL_MARGIN));
  }
  const columnX: number[] = [];
  let x = ORIGIN.x + inset;
  columnWidth.forEach((w, rank) => {
    columnX.push(x);
    // A label may use the whole rail, which also runs under the width of both nodes' labels.
    const needed = (labelGap.get(rank) ?? 0) - (NODE_SIZE.width - STATION_SIZE);
    x += w + Math.max(COLUMN_GAP, needed) + groupClearance;
  });

  const collectColumns = (cluster: Cluster): number[] => {
    const cols = cluster.nodes.map(rankOf);
    if (cluster.id !== undefined && emptyGroups.has(cluster.id)) cols.push(0);
    for (const child of cluster.children) cols.push(...collectColumns(child));
    return cols;
  };

  const colSpan = (cluster: Cluster): readonly [number, number] => {
    const cols = collectColumns(cluster);
    if (cols.length === 0) return [0, 0];
    return [Math.min(...cols), Math.max(...cols)];
  };

  type LayoutItem =
    | { kind: 'col'; rank: number; ids: string[]; minCol: number; maxCol: number; order: number }
    | { kind: 'group'; child: Cluster; minCol: number; maxCol: number; order: number };

  const layoutCluster = (cluster: Cluster, top: number): number => {
    const hasFrame = cluster.id !== undefined;
    // Applied to the whole cluster so that rails between stations in a row stay straight.
    const room = Math.max(0, ...cluster.nodes.map((id) => loopRoom.get(id) ?? 0));
    const startY = top + (hasFrame ? GROUP_HEADER + GROUP_PADDING : 0) + room;
    const colBottom = Array.from({ length: maxRank + 1 }, () => startY);
    let maxBottom = startY;

    const byColumn = new Map<number, string[]>();
    for (const id of cluster.nodes) {
      const r = rankOf(id);
      const list = byColumn.get(r) ?? [];
      list.push(id);
      byColumn.set(r, list);
    }

    const items: LayoutItem[] = [];
    let order = 0;
    for (const [rank, ids] of byColumn.entries()) {
      items.push({ kind: 'col', rank, ids, minCol: rank, maxCol: rank, order: order++ });
    }
    for (const child of cluster.children) {
      if (!needsLayout(child)) continue;
      const [minCol, maxCol] = colSpan(child);
      items.push({ kind: 'group', child, minCol, maxCol, order: order++ });
    }
    items.sort((a, b) => a.minCol - b.minCol || a.order - b.order);

    for (const item of items) {
      if (item.kind === 'col') {
        const { rank, ids } = item;
        const keyed = ids.map((id, i) => {
          const preds = (ranks.predecessors.get(id) ?? []).filter((p) => out[p]);
          const bary =
            preds.length > 0
              ? preds.reduce((s, p) => s + (out[p]?.y ?? 0), 0) / preds.length
              : Number.POSITIVE_INFINITY;
          return { id, bary, i };
        });
        keyed.sort((a, b) => a.bary - b.bary || a.i - b.i);
        let colY = colBottom[rank] ?? startY;
        for (const { id } of keyed) {
          const size = sizes.get(id) ?? NODE_SIZE;
          const colX = columnX[rank] ?? ORIGIN.x;
          const width = columnWidth[rank] ?? size.width;
          out[id] = { x: colX + (width - size.width) / 2, y: colY, ...size };
          colY += size.height + ROW_GAP + room;
        }
        const bottom = colY - ROW_GAP - room;
        colBottom[rank] = bottom + CLUSTER_GAP;
        maxBottom = Math.max(maxBottom, bottom);
      } else {
        const { child, minCol, maxCol } = item;
        const childTop = Math.max(...colBottom.slice(minCol, maxCol + 1));
        const childBottom = layoutCluster(child, childTop);
        for (let r = minCol; r <= maxCol; r++) {
          colBottom[r] = childBottom + CLUSTER_GAP + room;
        }
        maxBottom = Math.max(maxBottom, childBottom);
      }
    }

    if (hasFrame && maxBottom === startY && cluster.id !== undefined) {
      placeholders[cluster.id] = { x: columnX[0] ?? ORIGIN.x, y: startY, ...EMPTY_GROUP_CONTENT };
      maxBottom = startY + EMPTY_GROUP_CONTENT.height;
    }
    return maxBottom + (hasFrame ? GROUP_PADDING : 0);
  };

  layoutCluster(root, ORIGIN.y + inset);
}

/** Groups that contain no nodes at any depth. */
function findEmptyGroups(doc: DavDocument): Set<string> {
  const withNodes = new Set<string>();
  const parentOf = new Map(doc.groups.map((g) => [g.id, g.parentId]));
  for (const n of doc.nodes) {
    for (let g = n.parentId; g !== undefined; g = parentOf.get(g)) withNodes.add(g);
  }
  return new Set(doc.groups.filter((g) => !withNodes.has(g.id)).map((g) => g.id));
}

/** Groups wrap their descendants (deepest first). */
function computeGroupRects(
  doc: DavDocument,
  nodes: Record<string, Rect>,
  placeholders: Record<string, Rect>,
  loopRoom: ReadonlyMap<string, number>,
): Record<string, Rect> {
  const groups = rectRecord();
  const childrenOf = new Map<string, string[]>();
  for (const g of doc.groups) {
    if (g.parentId) childrenOf.set(g.parentId, [...(childrenOf.get(g.parentId) ?? []), g.id]);
  }
  const nodesOf = new Map<string, string[]>();
  for (const n of doc.nodes) {
    if (n.parentId) nodesOf.set(n.parentId, [...(nodesOf.get(n.parentId) ?? []), n.id]);
  }

  const visit = (groupId: string): Rect | undefined => {
    const group = doc.groups.find((g) => g.id === groupId);
    if (!group) return undefined;
    const placeholder = placeholders[groupId];
    const childRects = [
      ...(placeholder ? [placeholder] : []),
      ...(nodesOf.get(groupId) ?? []).flatMap((id) => {
        const node = nodes[id];
        if (!node) return [];
        const room = loopRoom.get(id) ?? 0;
        return [{ ...node, y: node.y - room, height: node.height + room }];
      }),
      ...(childrenOf.get(groupId) ?? []).flatMap((id) => {
        const r = groups[id] ?? visit(id);
        return r ? [r] : [];
      }),
    ];
    let rect: Rect;
    if (childRects.length === 0) {
      rect = { ...ORIGIN, width: 240, height: 140 };
    } else {
      const minX = Math.min(...childRects.map((r) => r.x)) - GROUP_PADDING;
      const minY = Math.min(...childRects.map((r) => r.y)) - GROUP_PADDING - GROUP_HEADER;
      const maxX = Math.max(...childRects.map((r) => r.x + r.width)) + GROUP_PADDING;
      const maxY = Math.max(...childRects.map((r) => r.y + r.height)) + GROUP_PADDING;
      rect = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
    groups[groupId] = rect;
    return rect;
  };
  for (const g of doc.groups) if (!groups[g.id]) visit(g.id);
  return groups;
}
