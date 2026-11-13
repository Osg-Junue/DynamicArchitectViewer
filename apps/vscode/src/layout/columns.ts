import {
  EDGE_LABEL_FONT_SIZE,
  EDGE_LABEL_MAX_WIDTH,
  estimateTextWidth,
  pushToMap,
} from '../model/text';
import type { DavDocument } from '../model/types';
import { ancestorIds, parentMap } from '../model/zones';
import { crossingsOf, type Link, linksOf, segmentsOf } from './links';
import {
  EMPTY_GROUP_CONTENT,
  enclosingRect,
  GROUP_HEADER,
  GROUP_PADDING,
  type Layout,
  NODE_SIZE,
  ORIGIN,
  type Rect,
  rectRecord,
  STATION_SIZE,
  selfLoopRoom,
} from './metrics';
import { computeRanks, type RankResult } from './ranks';

const COLUMN_GAP = 36;
const EDGE_LABEL_MARGIN = 32;
const ROW_GAP = 14;
const CLUSTER_GAP = 28;
/** Refinement passes over the vertical order; each one places the whole diagram again. */
const MAX_SWEEPS = 16;
/** Refinement gives up after this many passes in a row without an improvement. */
const SWEEP_PATIENCE = 4;
/** Layout runs on every edit, and counting crossings is quadratic in the edges. */
const MAX_REFINED_EDGES = 500;

interface NodePlacement {
  nodes: Record<string, Rect>;
  placeholders: Record<string, Rect>;
}

export function computeColumnLayout(doc: DavDocument): Layout {
  const groupParent = parentMap(doc.groups);
  const nodeParent = parentMap(doc.nodes);
  const childrenOf = new Map<string, string[]>();
  for (const g of doc.groups) {
    if (g.parentId) pushToMap(childrenOf, g.parentId, g.id);
  }
  const nodesOf = new Map<string, string[]>();
  for (const n of doc.nodes) {
    if (n.parentId) pushToMap(nodesOf, n.parentId, n.id);
  }

  const emptyGroups = findEmptyGroups(doc, groupParent);
  // A loop needs room above its station. Every station gets the room of the tallest loop, so
  // that stations stay level from one zone to the next and a rail between them runs straight.
  const tallestLoop = Math.max(0, ...selfLoopRoom(doc).values());
  const loopRoom = new Map(doc.nodes.map((n) => [n.id, tallestLoop]));
  const ranks = computeRanks(
    doc.nodes.map((n) => n.id),
    doc.edges.map((e): readonly [string, string] => [e.from, e.to]),
  );
  const frames = measureFrameEdges(doc, ranks.rank, emptyGroups, childrenOf, nodesOf);
  const plan =
    doc.nodes.length > 0 || emptyGroups.size > 0
      ? buildColumnPlan(doc, emptyGroups, ranks, frames, groupParent, nodeParent)
      : undefined;

  const place = (guide?: SweepGuide): NodePlacement => {
    const nodes = rectRecord();
    const placeholders = rectRecord();
    if (plan) {
      placeAuto(plan, ranks, nodes, placeholders, loopRoom, guide);
    }
    return { nodes, placeholders };
  };

  const winning = refineOrder(doc, ranks.rank, place);
  return {
    nodes: winning.nodes,
    groups: computeGroupRects(
      doc,
      winning.nodes,
      winning.placeholders,
      loopRoom,
      frames,
      childrenOf,
      nodesOf,
    ),
  };
}

interface FrameEdges {
  /** Columns that some zone's frame ends at, or starts at. */
  endsAt: ReadonlySet<number>;
  startsAt: ReadonlySet<number>;
  /** Sideways padding of each frame. */
  pads: ReadonlyMap<string, { left: number; right: number }>;
}

/**
 * Finds where zone frames meet the gaps between columns. Frames nested along one edge share
 * that edge's padding, so that the room they take does not grow with the nesting.
 */
function measureFrameEdges(
  doc: DavDocument,
  rank: ReadonlyMap<string, number>,
  emptyGroups: ReadonlySet<string>,
  childrenOf: ReadonlyMap<string, readonly string[]>,
  nodesOf: ReadonlyMap<string, readonly string[]>,
): FrameEdges {
  type Span = { min: number; max: number; left: number; right: number };
  const spans = new Map<string, Span>();
  const endsAt = new Set<number>();
  const startsAt = new Set<number>();
  // Children come after their parents in the document, so this goes from the inside out.
  for (const g of [...doc.groups].reverse()) {
    const inner = (childrenOf.get(g.id) ?? []).flatMap((id) => spans.get(id) ?? []);
    const columns = [
      ...(nodesOf.get(g.id) ?? []).map((id) => rank.get(id) ?? 0),
      ...(emptyGroups.has(g.id) ? [0] : []),
      ...inner.flatMap((c) => [c.min, c.max]),
    ];
    if (columns.length === 0) continue;
    const min = Math.min(...columns);
    const max = Math.max(...columns);
    spans.set(g.id, {
      min,
      max,
      left: 1 + Math.max(0, ...inner.filter((c) => c.min === min).map((c) => c.left)),
      right: 1 + Math.max(0, ...inner.filter((c) => c.max === max).map((c) => c.right)),
    });
    startsAt.add(min);
    endsAt.add(max);
  }

  const pads = new Map<string, { left: number; right: number }>();
  for (const g of doc.groups) {
    const span = spans.get(g.id);
    if (!span) continue;
    const parent = g.parentId === undefined ? undefined : spans.get(g.parentId);
    const parentPads = g.parentId === undefined ? undefined : pads.get(g.parentId);
    pads.set(g.id, {
      left: parent?.min === span.min && parentPads ? parentPads.left : GROUP_PADDING / span.left,
      right: parent?.max === span.max && parentPads ? parentPads.right : GROUP_PADDING / span.right,
    });
  }
  return { endsAt, startsAt, pads };
}

/** Directs a placement by the positions of the previous one. */
interface SweepGuide {
  previous: NodePlacement;
  /** Nodes a node's position within its column follows in this pass. */
  columnNeighbors: ReadonlyMap<string, readonly string[]>;
  /** All nodes linked to a node, which decide where its group goes. */
  linked: ReadonlyMap<string, readonly string[]>;
}

function refineOrder(
  doc: DavDocument,
  rank: ReadonlyMap<string, number>,
  place: (guide?: SweepGuide) => NodePlacement,
): NodePlacement {
  const links = linksOf(doc);
  let current = place();
  if (links.length === 0 || links.length > MAX_REFINED_EDGES) return current;

  const neighbors = (keep: (self: number, other: number) => boolean) => {
    const out = new Map<string, string[]>();
    const add = (a: string, b: string) => {
      if (keep(rank.get(a) ?? 0, rank.get(b) ?? 0)) pushToMap(out, a, b);
    };
    for (const [from, to] of links) {
      add(from, to);
      add(to, from);
    }
    return out;
  };
  const left = neighbors((self, other) => other < self);
  const right = neighbors((self, other) => other > self);
  const linked = neighbors(() => true);

  let best = current;
  let bestScore = scoreOf(links, best);
  let stale = 0;
  for (let sweep = 0; sweep < MAX_SWEEPS && stale < SWEEP_PATIENCE; sweep++) {
    current = place({ previous: current, columnNeighbors: sweep % 2 === 0 ? left : right, linked });
    const score = scoreOf(links, current);
    const better =
      score.crossings < bestScore.crossings ||
      (score.crossings === bestScore.crossings && score.length < bestScore.length);
    if (better) {
      best = current;
      bestScore = score;
      stale = 0;
    } else {
      stale++;
    }
  }
  return best;
}

function scoreOf(links: readonly Link[], placement: NodePlacement) {
  const segments = segmentsOf(links, placement);
  return {
    crossings: crossingsOf(segments),
    length: segments.reduce((sum, s) => sum + Math.abs(s.ay - s.by), 0),
  };
}

interface Cluster {
  id: string | undefined;
  nodes: string[];
  children: Cluster[];
  allNodes: string[];
  colSpan: readonly [number, number];
  needsLayout: boolean;
}

interface ColumnPlan {
  root: Cluster;
  columnX: readonly number[];
  maxRank: number;
  inset: number;
}

function buildColumnPlan(
  doc: DavDocument,
  emptyGroups: ReadonlySet<string>,
  ranks: RankResult,
  frames: FrameEdges,
  groupParent: ReadonlyMap<string, string | undefined>,
  nodeParent: ReadonlyMap<string, string | undefined>,
): ColumnPlan {
  const makeCluster = (id: string | undefined): Cluster => ({
    id,
    nodes: [],
    children: [],
    allNodes: [],
    colSpan: [0, 0],
    needsLayout: false,
  });

  // Cluster tree mirrors the group hierarchy.
  const clusters = new Map<string | undefined, Cluster>();
  const root = makeCluster(undefined);
  clusters.set(undefined, root);
  for (const g of doc.groups) clusters.set(g.id, makeCluster(g.id));
  for (const g of doc.groups) {
    const child = clusters.get(g.id);
    if (child) clusters.get(g.parentId)?.children.push(child);
  }
  for (const n of doc.nodes) clusters.get(nodeParent.get(n.id))?.nodes.push(n.id);

  const rankOf = (id: string) => ranks.rank.get(id) ?? 0;
  const populate = (cluster: Cluster): number[] => {
    const cols = cluster.nodes.map(rankOf);
    if (cluster.id !== undefined && emptyGroups.has(cluster.id)) cols.push(0);
    const allNodes = [...cluster.nodes];
    let childNeedsLayout = false;
    for (const child of cluster.children) {
      cols.push(...populate(child));
      allNodes.push(...child.allNodes);
      if (child.needsLayout) childNeedsLayout = true;
    }
    cluster.allNodes = allNodes;
    cluster.colSpan = cols.length === 0 ? [0, 0] : [Math.min(...cols), Math.max(...cols)];
    cluster.needsLayout =
      cluster.nodes.length > 0 ||
      (cluster.id !== undefined && emptyGroups.has(cluster.id)) ||
      childNeedsLayout;
    return cols;
  };
  populate(root);

  // Column x positions shared by all clusters.
  const maxRank = Math.max(0, ...doc.nodes.map((n) => rankOf(n.id)));
  const maxDepth = Math.max(0, ...doc.groups.map((g) => ancestorIds(groupParent, g.id).length));
  const inset = maxDepth * GROUP_PADDING;

  // A gap only needs room for the zone edges inside it, however deeply those zones are nested.
  const clearanceAfter = (rank: number) =>
    (frames.endsAt.has(rank) ? GROUP_PADDING : 0) +
    (frames.startsAt.has(rank + 1) ? GROUP_PADDING : 0);

  // A labeled edge between adjacent columns needs room for its whole label.
  const labelGap = new Map<number, number>();
  for (const e of doc.edges) {
    if (!e.label || !ranks.rank.has(e.from) || !ranks.rank.has(e.to)) continue;
    const left = Math.min(rankOf(e.from), rankOf(e.to));
    if (Math.abs(rankOf(e.from) - rankOf(e.to)) !== 1) continue;
    const width = Math.min(EDGE_LABEL_MAX_WIDTH, estimateTextWidth(e.label, EDGE_LABEL_FONT_SIZE));
    labelGap.set(left, Math.max(labelGap.get(left) ?? 0, width + EDGE_LABEL_MARGIN));
  }
  const columnX: number[] = [];
  let x = ORIGIN.x + inset;
  for (let rank = 0; rank <= maxRank; rank++) {
    columnX.push(x);
    // A label may use the whole rail, which also runs under the width of both nodes' labels.
    const needed = (labelGap.get(rank) ?? 0) - (NODE_SIZE.width - STATION_SIZE);
    x += NODE_SIZE.width + Math.max(COLUMN_GAP, needed) + clearanceAfter(rank);
  }

  return { root, columnX, maxRank, inset };
}

/** How far a frame pushes its first row of stations down. */
const FRAME_TOP = GROUP_HEADER + GROUP_PADDING;

function placeAuto(
  plan: ColumnPlan,
  ranks: RankResult,
  out: Record<string, Rect>,
  placeholders: Record<string, Rect>,
  loopRoom: ReadonlyMap<string, number>,
  guide?: SweepGuide,
): void {
  const rankOf = (id: string) => ranks.rank.get(id) ?? 0;
  const previousY = (id: string) => guide?.previous.nodes[id]?.y ?? 0;
  const meanY = (ids: readonly string[]) =>
    ids.length > 0 ? ids.reduce((sum, id) => sum + previousY(id), 0) / ids.length : undefined;

  /** Where a block belongs next to the others in its cluster: near what it is linked to. */
  const blockKey = (members: readonly string[]): number => {
    const inside = new Set(members);
    const outside = members.flatMap((id) =>
      (guide?.linked.get(id) ?? []).filter((other) => !inside.has(other)),
    );
    return meanY(outside) ?? meanY(members) ?? Number.POSITIVE_INFINITY;
  };

  /** Position within a column: the first pass follows predecessors placed so far. */
  const columnKey = (id: string): number => {
    if (guide) return meanY(guide.columnNeighbors.get(id) ?? []) ?? previousY(id);
    const preds = (ranks.predecessors.get(id) ?? []).filter((p) => out[p]);
    return preds.length > 0
      ? preds.reduce((s, p) => s + (out[p]?.y ?? 0), 0) / preds.length
      : Number.POSITIVE_INFINITY;
  };

  type LayoutItem =
    | { kind: 'col'; rank: number; ids: string[]; minCol: number; maxCol: number; order: number }
    | { kind: 'group'; child: Cluster; minCol: number; maxCol: number; order: number };

  // The same for every cluster, so that rails between stations in a row stay straight.
  const room = Math.max(0, ...loopRoom.values());
  /** How far down each frame pushes the stations inside it. */
  const level = FRAME_TOP + room;

  /** How many frames deep the groups nested in a cluster go. */
  const framesBelow = (cluster: Cluster): number =>
    Math.max(0, ...cluster.children.filter((c) => c.needsLayout).map((c) => 1 + framesBelow(c)));

  const layoutCluster = (cluster: Cluster, top: number): number => {
    const hasFrame = cluster.id !== undefined;
    // A frame pushes its stations down by its header and the room for loops. The first row of
    // a cluster starts as far down as the first row of the deepest group nested in it, so that
    // a rail from a station outside a zone to one inside it runs level.
    const depth = framesBelow(cluster);
    const startY = top + (hasFrame ? GROUP_HEADER + GROUP_PADDING : 0) + room;
    const colBottom = Array.from({ length: plan.maxRank + 1 }, () => startY);
    let maxBottom = startY;

    const byColumn = new Map<number, string[]>();
    for (const id of cluster.nodes) {
      pushToMap(byColumn, rankOf(id), id);
    }

    const items: LayoutItem[] = [];
    let order = 0;
    for (const [rank, ids] of byColumn.entries()) {
      items.push({ kind: 'col', rank, ids, minCol: rank, maxCol: rank, order: order++ });
    }
    for (const child of cluster.children) {
      if (!child.needsLayout) continue;
      const [minCol, maxCol] = child.colSpan;
      items.push({ kind: 'group', child, minCol, maxCol, order: order++ });
    }
    if (guide) {
      const keys = new Map(
        items.map((item) => [item, blockKey(item.kind === 'col' ? item.ids : item.child.allNodes)]),
      );
      items.sort((a, b) => (keys.get(a) ?? 0) - (keys.get(b) ?? 0) || a.order - b.order);
    } else {
      items.sort((a, b) => a.minCol - b.minCol || a.order - b.order);
    }

    for (const item of items) {
      if (item.kind === 'col') {
        const { rank, ids } = item;
        const keyed = ids.map((id, i) => ({ id, key: columnKey(id), i }));
        keyed.sort((a, b) => a.key - b.key || previousY(a.id) - previousY(b.id) || a.i - b.i);
        let colY = colBottom[rank] ?? startY;
        if (colY === startY) colY += depth * level;
        for (const { id } of keyed) {
          out[id] = { x: plan.columnX[rank] ?? ORIGIN.x, y: colY, ...NODE_SIZE };
          colY += NODE_SIZE.height + ROW_GAP + room;
        }
        const bottom = colY - ROW_GAP - room;
        colBottom[rank] = bottom + CLUSTER_GAP;
        maxBottom = Math.max(maxBottom, bottom);
      } else {
        const { child, minCol, maxCol } = item;
        const below = Math.max(...colBottom.slice(minCol, maxCol + 1));
        const childTop =
          below === startY ? below + (depth - 1 - framesBelow(child)) * level : below;
        const childBottom = layoutCluster(child, childTop);
        for (let r = minCol; r <= maxCol; r++) {
          colBottom[r] = childBottom + CLUSTER_GAP + room;
        }
        maxBottom = Math.max(maxBottom, childBottom);
      }
    }

    if (hasFrame && maxBottom === startY && cluster.id !== undefined) {
      placeholders[cluster.id] = {
        x: plan.columnX[0] ?? ORIGIN.x,
        y: startY,
        ...EMPTY_GROUP_CONTENT,
      };
      maxBottom = startY + EMPTY_GROUP_CONTENT.height;
    }
    return maxBottom + (hasFrame ? GROUP_PADDING : 0);
  };

  layoutCluster(plan.root, ORIGIN.y + plan.inset);
}

/** Groups that contain no nodes at any depth. */
function findEmptyGroups(
  doc: DavDocument,
  groupParent: ReadonlyMap<string, string | undefined>,
): Set<string> {
  const withNodes = new Set<string>();
  for (const n of doc.nodes) {
    for (const g of ancestorIds(groupParent, n.parentId)) withNodes.add(g);
  }
  return new Set(doc.groups.filter((g) => !withNodes.has(g.id)).map((g) => g.id));
}

/** Groups wrap their descendants (deepest first). */
function computeGroupRects(
  doc: DavDocument,
  nodes: Record<string, Rect>,
  placeholders: Record<string, Rect>,
  loopRoom: ReadonlyMap<string, number>,
  frames: FrameEdges,
  childrenOf: ReadonlyMap<string, readonly string[]>,
  nodesOf: ReadonlyMap<string, readonly string[]>,
): Record<string, Rect> {
  const groups = rectRecord();
  const knownGroups = new Set(doc.groups.map((g) => g.id));

  const visit = (groupId: string): Rect | undefined => {
    if (!knownGroups.has(groupId)) return undefined;
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
      const bounds = enclosingRect(childRects);
      const pad = frames.pads.get(groupId);
      const minX = bounds.x - (pad?.left ?? GROUP_PADDING);
      const minY = bounds.y - GROUP_PADDING - GROUP_HEADER;
      const maxX = bounds.x + bounds.width + (pad?.right ?? GROUP_PADDING);
      const maxY = bounds.y + bounds.height + GROUP_PADDING;
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
