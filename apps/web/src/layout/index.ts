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

export const NODE_SIZE = { width: 168, height: 72 } as const;
export const SCREEN_NODE_SIZE = { width: 188, height: 108 } as const;

const COLUMN_GAP = 96;
const ROW_GAP = 40;
const GROUP_PADDING = 24;
const GROUP_HEADER = 28;
const CLUSTER_GAP = 48;
const ORIGIN = { x: 40, y: 40 };
const EMPTY_GROUP_CONTENT = { width: 160, height: 40 };

export function defaultNodeSize(icon: IconName): { width: number; height: number } {
  return icon === 'screen' || icon === 'modal' ? SCREEN_NODE_SIZE : NODE_SIZE;
}

/**
 * Computes positions for every node and group.
 *
 * - Explicit `@pos` / `@size` are always respected.
 * - Nodes without `@pos` are placed left-to-right by longest-path rank over the edges
 *   (cycles are broken), ordered within a column by the barycenter of their predecessors.
 * - Each group occupies its own horizontal band so groups never overlap; nested groups
 *   are stacked inside their parent's band.
 * - If some nodes have explicit positions, auto-placed nodes go below them.
 * - Groups without `@pos` / `@size` wrap their descendants.
 */
export function computeLayout(doc: DavDocument): Layout {
  const sizes = new Map(doc.nodes.map((n) => [n.id, n.size ?? defaultNodeSize(n.icon)] as const));
  const nodes: Record<string, Rect> = {};

  for (const n of doc.nodes) {
    if (n.pos) nodes[n.id] = { ...n.pos, ...(sizes.get(n.id) ?? NODE_SIZE) };
  }

  const auto = doc.nodes.filter((n) => !n.pos).map((n) => n.id);
  const emptyGroups = findEmptyAutoGroups(doc);
  const placeholders: Record<string, Rect> = {};
  if (auto.length > 0 || emptyGroups.size > 0) {
    const ranks = computeRanks(
      doc.nodes.map((n) => n.id),
      doc.edges.map((e) => [e.from, e.to] as const),
    );
    const origin = autoOrigin(doc, nodes);
    placeAuto(doc, auto, emptyGroups, ranks, sizes, origin, nodes, placeholders);
  }

  return { nodes, groups: computeGroupRects(doc, nodes, placeholders) };
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

function autoOrigin(doc: DavDocument, placed: Record<string, Rect>): { x: number; y: number } {
  const rects = [
    ...Object.values(placed),
    ...doc.groups.flatMap((g) => (g.pos && g.size ? [{ ...g.pos, ...g.size }] : [])),
  ];
  if (rects.length === 0) return ORIGIN;
  const minX = Math.min(...rects.map((r) => r.x));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: maxY + CLUSTER_GAP * 2 };
}

interface Cluster {
  id: string | undefined;
  nodes: string[];
  children: Cluster[];
}

function placeAuto(
  doc: DavDocument,
  autoIds: string[],
  emptyGroups: Set<string>,
  ranks: ReturnType<typeof computeRanks>,
  sizes: Map<string, { width: number; height: number }>,
  origin: { x: number; y: number },
  out: Record<string, Rect>,
  placeholders: Record<string, Rect>,
): void {
  const autoSet = new Set(autoIds);
  const needsLayout = (cluster: Cluster): boolean =>
    cluster.nodes.some((id) => autoSet.has(id)) ||
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
  for (const id of autoIds) clusters.get(parentOf.get(id))?.nodes.push(id);

  // Column x positions shared by all clusters.
  const rankOf = (id: string) => ranks.rank.get(id) ?? 0;
  const maxRank = Math.max(0, ...autoIds.map(rankOf));
  const columnWidth = Array.from({ length: maxRank + 1 }, () => 0);
  for (const id of autoIds) {
    const r = rankOf(id);
    columnWidth[r] = Math.max(columnWidth[r] ?? 0, sizes.get(id)?.width ?? NODE_SIZE.width);
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
  const columnX: number[] = [];
  let x = origin.x + inset;
  for (const w of columnWidth) {
    columnX.push(x);
    x += w + COLUMN_GAP;
  }

  // Lay out clusters top to bottom; each returns the y after its band.
  const layoutCluster = (cluster: Cluster, top: number, depth: number): number => {
    const hasFrame = cluster.id !== undefined;
    let y = top + (hasFrame ? GROUP_HEADER + GROUP_PADDING : 0);
    const startY = y;

    // Order nodes in each column by predecessor barycenter (already-placed y values).
    const byColumn = new Map<number, string[]>();
    for (const id of cluster.nodes) {
      const list = byColumn.get(rankOf(id)) ?? [];
      list.push(id);
      byColumn.set(rankOf(id), list);
    }
    let bandBottom = y;
    for (const [rank, ids] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
      const keyed = ids.map((id, i) => {
        const preds = (ranks.predecessors.get(id) ?? []).filter((p) => out[p]);
        const bary =
          preds.length > 0
            ? preds.reduce((s, p) => s + (out[p]?.y ?? 0), 0) / preds.length
            : Number.POSITIVE_INFINITY;
        return { id, bary, i };
      });
      keyed.sort((a, b) => a.bary - b.bary || a.i - b.i);
      let colY = startY;
      for (const { id } of keyed) {
        const size = sizes.get(id) ?? NODE_SIZE;
        const colX = columnX[rank] ?? origin.x;
        const width = columnWidth[rank] ?? size.width;
        out[id] = { x: colX + (width - size.width) / 2, y: colY, ...size };
        colY += size.height + ROW_GAP;
      }
      bandBottom = Math.max(bandBottom, colY - ROW_GAP);
    }
    y = cluster.nodes.length > 0 ? bandBottom : startY;

    for (const child of cluster.children) {
      if (!needsLayout(child)) continue;
      if (y > startY) y += CLUSTER_GAP;
      y = layoutCluster(child, y, depth + 1);
    }
    if (hasFrame && y === startY && cluster.id !== undefined) {
      // Empty group: reserve a small content area so it gets its own band.
      placeholders[cluster.id] = { x: columnX[0] ?? origin.x, y: startY, ...EMPTY_GROUP_CONTENT };
      y += EMPTY_GROUP_CONTENT.height;
    }
    return y + (hasFrame ? GROUP_PADDING : 0);
  };

  // Root: ungrouped nodes first, then each top-level group band.
  let y = origin.y + inset;
  const rootNodesBand: Cluster = { id: undefined, nodes: root.nodes, children: [] };
  if (root.nodes.length > 0) y = layoutCluster(rootNodesBand, y, 0) + CLUSTER_GAP;
  for (const child of root.children) {
    if (!needsLayout(child)) continue;
    y = layoutCluster(child, y, 1) + CLUSTER_GAP;
  }
}

/** Groups without explicit geometry that contain no nodes at any depth. */
function findEmptyAutoGroups(doc: DavDocument): Set<string> {
  const withNodes = new Set<string>();
  const parentOf = new Map(doc.groups.map((g) => [g.id, g.parentId]));
  for (const n of doc.nodes) {
    for (let g = n.parentId; g !== undefined; g = parentOf.get(g)) withNodes.add(g);
  }
  return new Set(
    doc.groups.filter((g) => !(g.pos && g.size) && !withNodes.has(g.id)).map((g) => g.id),
  );
}

/** Explicit group rects are kept; others wrap their descendants (deepest first). */
function computeGroupRects(
  doc: DavDocument,
  nodes: Record<string, Rect>,
  placeholders: Record<string, Rect>,
): Record<string, Rect> {
  const groups: Record<string, Rect> = {};
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
      ...(nodesOf.get(groupId) ?? []).flatMap((id) => (nodes[id] ? [nodes[id]] : [])),
      ...(childrenOf.get(groupId) ?? []).flatMap((id) => {
        const r = groups[id] ?? visit(id);
        return r ? [r] : [];
      }),
    ];
    let rect: Rect;
    if (group.pos && group.size) {
      rect = { ...group.pos, ...group.size };
    } else if (childRects.length === 0) {
      rect = { ...(group.pos ?? ORIGIN), ...(group.size ?? { width: 240, height: 140 }) };
    } else {
      const minX = Math.min(...childRects.map((r) => r.x)) - GROUP_PADDING;
      const minY = Math.min(...childRects.map((r) => r.y)) - GROUP_PADDING - GROUP_HEADER;
      const maxX = Math.max(...childRects.map((r) => r.x + r.width)) + GROUP_PADDING;
      const maxY = Math.max(...childRects.map((r) => r.y + r.height)) + GROUP_PADDING;
      rect = {
        x: group.pos?.x ?? minX,
        y: group.pos?.y ?? minY,
        width: group.size?.width ?? maxX - (group.pos?.x ?? minX),
        height: group.size?.height ?? maxY - (group.pos?.y ?? minY),
      };
    }
    groups[groupId] = rect;
    return rect;
  };
  for (const g of doc.groups) if (!groups[g.id]) visit(g.id);
  return groups;
}
