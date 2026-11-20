import { synthesizedConnections } from '../model/connections';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH, pushToMap, textWidth } from '../model/text';
import type { DavConnection, DavDocument } from '../model/types';
import { ancestorIds, parentMap, topLevelGroups } from '../model/zones';
import { analyzeFlow, type FlowAnalysis } from './flow';
import { crossingsOf, type Link, segmentsOf } from './links';
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
import { straightenNodes } from './straightenNodes';
import { type Block, ownersOf, type Placed, placeIsolatedBlocks } from './zoneBlocks';

const COLUMN_GAP = 36;
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

const ISOLATED_ROW_GAP = 44;

/**
 * Lays out diagrams with `<= 1` top-level group, partitioning the primary component (containing
 * the top-level group when connected or when no multi-node component exists, else the main
 * connected subgraph), secondary ungrouped components, any isolated `deg === 0` top-level group,
 * and `deg === 0` singletons (including self-loops) so isolated additions cause exact 0.0-unit
 * drift on connected nodes and frames.
 */
export function computeSingleGroupLayout(doc: DavDocument): Layout {
  if (doc.nodes.length === 0 && doc.groups.length === 0) {
    return { nodes: rectRecord(), groups: rectRecord() };
  }

  const topGroups = topLevelGroups(doc.groups);
  const topGroupId = topGroups.length === 1 ? topGroups[0]?.id : undefined;
  const owners = ownersOf(doc);
  const connections = synthesizedConnections(doc);
  const knownNodes = new Set(doc.nodes.map((n) => n.id));
  const nodeIndex = new Map(doc.nodes.map((n, i) => [n.id, i]));

  const blockIds: string[] = [];
  const blockSet = new Set<string>();
  if (topGroupId !== undefined) {
    blockIds.push(topGroupId);
    blockSet.add(topGroupId);
  }
  for (const n of doc.nodes) {
    const owner = owners.get(n.id) ?? n.id;
    if (!blockSet.has(owner)) {
      blockIds.push(owner);
      blockSet.add(owner);
    }
  }

  const adj = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  for (const c of connections) {
    if (c.from === c.to || !knownNodes.has(c.from) || !knownNodes.has(c.to)) continue;
    const bu = owners.get(c.from) ?? c.from;
    const bv = owners.get(c.to) ?? c.to;
    if (bu === bv) continue;
    adj.get(bu)?.add(bv);
    adj.get(bv)?.add(bu);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const start of blockIds) {
    if (visited.has(start)) continue;
    const comp: string[] = [];
    const queue = [start];
    visited.add(start);
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      if (cur === undefined) continue;
      comp.push(cur);
      for (const nxt of adj.get(cur) ?? []) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }
    components.push(comp);
  }

  let mainComp: string[] | undefined;
  let topGroupComp: string[] | undefined;
  let isolatedGroupId: string | undefined;
  const multiComps: string[][] = [];
  const singletonIds: string[] = [];

  if (topGroupId !== undefined) {
    for (const comp of components) {
      if (comp.includes(topGroupId)) topGroupComp = comp;
      else if (comp.length >= 2) multiComps.push(comp);
      else if (comp[0] !== undefined) singletonIds.push(comp[0]);
    }
  } else {
    for (const comp of components) {
      if (comp.length >= 2) multiComps.push(comp);
      else if (comp[0] !== undefined) singletonIds.push(comp[0]);
    }
  }

  const sortMulti = (comps: string[][]) => {
    const earliestOf = (comp: readonly string[]): number =>
      Math.min(...comp.map((id) => nodeIndex.get(id) ?? Number.MAX_SAFE_INTEGER));
    comps.sort((a, b) => earliestOf(a) - earliestOf(b));
  };
  sortMulti(multiComps);
  if (topGroupComp !== undefined) {
    if (topGroupComp.length >= 2 || multiComps.length === 0) {
      mainComp = topGroupComp;
    } else {
      mainComp = multiComps.shift();
      isolatedGroupId = topGroupId;
    }
  } else if (multiComps.length > 0) {
    mainComp = multiComps.shift();
  }

  if (
    isolatedGroupId === undefined &&
    multiComps.length === 0 &&
    (singletonIds.length === 0 || (mainComp === undefined && singletonIds.length <= 1))
  ) {
    return straightenNodes(doc, computeColumnLayout(doc));
  }

  const subdoc = (nodeIds: ReadonlySet<string>, includeGroups: boolean): DavDocument => ({
    ...doc,
    nodes: doc.nodes.filter((n) => nodeIds.has(n.id)),
    groups: includeGroups ? doc.groups : [],
    steps: doc.steps.map((s) => ({
      ...s,
      animations: s.animations.filter((a) => nodeIds.has(a.from) && nodeIds.has(a.to)),
      statics: s.statics.filter((st) => nodeIds.has(st.from) && nodeIds.has(st.to)),
    })),
  });

  const nodes = rectRecord();
  const groups = rectRecord();
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const trackRect = (r: Rect) => {
    minX = Math.min(minX, r.x);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  };

  if (mainComp) {
    const mainBlockSet = new Set(mainComp);
    const mainNodes = new Set<string>();
    for (const n of doc.nodes) {
      if (mainBlockSet.has(owners.get(n.id) ?? n.id)) mainNodes.add(n.id);
    }
    const mDoc = subdoc(mainNodes, isolatedGroupId === undefined && topGroupId !== undefined);
    const mainLayout = straightenNodes(mDoc, computeColumnLayout(mDoc));
    for (const [id, r] of Object.entries(mainLayout.nodes)) {
      nodes[id] = r;
      trackRect(r);
    }
    for (const [id, r] of Object.entries(mainLayout.groups)) {
      groups[id] = r;
      trackRect(r);
    }
  }

  const docLoops = selfLoopRoom(doc);
  for (const comp of multiComps) {
    const cNodes = new Set(comp);
    const cDoc = subdoc(cNodes, false);
    const cLayout = straightenNodes(cDoc, computeColumnLayout(cDoc));
    const entries = Object.entries(cLayout.nodes);
    if (entries.length === 0) continue;
    const cMinX = Math.min(...entries.map(([, r]) => r.x));
    const cVisualTop = Math.min(...entries.map(([id, r]) => r.y - (docLoops.get(id) ?? 0)));
    const targetX = Number.isFinite(minX) ? minX : ORIGIN.x;
    const targetTop = Number.isFinite(maxY) ? maxY + ISOLATED_ROW_GAP : ORIGIN.y;
    const dx = targetX - cMinX;
    const dy = targetTop - cVisualTop;
    for (const [id, r] of entries) {
      const shifted: Rect = { ...r, x: r.x + dx, y: r.y + dy };
      nodes[id] = shifted;
      trackRect(shifted);
    }
  }

  if (isolatedGroupId !== undefined) {
    const gNodes = new Set<string>();
    for (const n of doc.nodes) {
      if (owners.get(n.id) === isolatedGroupId) gNodes.add(n.id);
    }
    const gDoc = subdoc(gNodes, true);
    const gLayout = straightenNodes(gDoc, computeColumnLayout(gDoc));
    const nodeEntries = Object.entries(gLayout.nodes);
    const groupEntries = Object.entries(gLayout.groups);
    if (nodeEntries.length > 0 || groupEntries.length > 0) {
      const gMinX = Math.min(
        ...nodeEntries.map(([, r]) => r.x),
        ...groupEntries.map(([, r]) => r.x),
      );
      const gVisualTop = Math.min(
        ...nodeEntries.map(([id, r]) => r.y - (docLoops.get(id) ?? 0)),
        ...groupEntries.map(([, r]) => r.y),
      );
      const targetX = Number.isFinite(minX) ? minX : ORIGIN.x;
      const targetTop = Number.isFinite(maxY) ? maxY + ISOLATED_ROW_GAP : ORIGIN.y;
      const dx = targetX - gMinX;
      const dy = targetTop - gVisualTop;
      for (const [id, r] of nodeEntries) {
        const shifted: Rect = { ...r, x: r.x + dx, y: r.y + dy };
        nodes[id] = shifted;
        trackRect(shifted);
      }
      for (const [id, r] of groupEntries) {
        const shifted: Rect = { ...r, x: r.x + dx, y: r.y + dy };
        groups[id] = shifted;
        trackRect(shifted);
      }
    }
  }

  if (singletonIds.length > 0) {
    const isoBlocks: Block[] = singletonIds.map((id) => {
      const loopRoom = docLoops.get(id) ?? 0;
      return {
        id,
        width: NODE_SIZE.width,
        height: NODE_SIZE.height,
        head: 0,
        contentHeight: NODE_SIZE.height,
        loopRoom,
        nodeLoopRoom: loopRoom > 0 ? new Map([[id, loopRoom]]) : new Map(),
        flippable: false,
        nodes: new Map([[id, { x: 0, y: 0, width: NODE_SIZE.width, height: NODE_SIZE.height }]]),
        groups: new Map(),
        groupsFlipped: new Map(),
        reflectConst: new Map(),
      };
    });
    if (Number.isFinite(minX)) {
      const summary: Placed = {
        block: {
          id: '__connected__',
          width: maxX - minX,
          height: 0,
          head: 0,
          contentHeight: 0,
          loopRoom: 0,
          nodeLoopRoom: new Map(),
          flippable: false,
          nodes: new Map(),
          groups: new Map(),
          groupsFlipped: new Map(),
          reflectConst: new Map(),
        },
        x: minX,
        y: maxY,
        flip: 0,
      };
      for (const p of placeIsolatedBlocks(isoBlocks, [summary])) {
        nodes[p.block.id] = { x: Math.round(p.x), y: Math.round(p.y), ...NODE_SIZE };
      }
    } else {
      for (const p of placeIsolatedBlocks(isoBlocks, [])) {
        nodes[p.block.id] = {
          x: Math.round(p.x + ORIGIN.x),
          y: Math.round(p.y + ORIGIN.y),
          ...NODE_SIZE,
        };
      }
    }
  }

  return { nodes, groups };
}

export function computeColumnLayout(
  doc: DavDocument,
  rankOverrides?: ReadonlyMap<string, number>,
  connections: readonly DavConnection[] = synthesizedConnections(doc),
  flow: FlowAnalysis = analyzeFlow(doc, connections),
): Layout {
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
    flow.forwardEdges,
  );
  if (rankOverrides) {
    for (const [id, r] of rankOverrides) {
      if (ranks.rank.has(id)) ranks.rank.set(id, r);
    }
  }
  const frames = measureFrameEdges(doc, ranks.rank, emptyGroups, childrenOf, nodesOf);
  const plan =
    doc.nodes.length > 0 || emptyGroups.size > 0
      ? buildColumnPlan(doc, connections, emptyGroups, ranks, frames, groupParent, nodeParent)
      : undefined;

  const place = (guide?: SweepGuide): NodePlacement => {
    const nodes = rectRecord();
    const placeholders = rectRecord();
    if (plan) {
      placeAuto(plan, ranks, nodes, placeholders, loopRoom, guide);
    }
    return { nodes, placeholders };
  };

  const winning = refineOrder(connections, ranks.rank, place);
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
  connections: readonly DavConnection[],
  rank: ReadonlyMap<string, number>,
  place: (guide?: SweepGuide) => NodePlacement,
): NodePlacement {
  const links: Link[] = connections
    .filter((e) => e.from !== e.to && rank.has(e.from) && rank.has(e.to))
    .map((e) => [e.from, e.to]);
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
  rowGap: number;
}

function buildColumnPlan(
  doc: DavDocument,
  connections: readonly DavConnection[],
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

  // Widen column corridors that carry long-span links or hub fan-out/fan-in traffic.
  const deg = new Map<string, number>();
  for (const e of connections) {
    if (e.from === e.to || !ranks.rank.has(e.from) || !ranks.rank.has(e.to)) continue;
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1);
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
  }
  const congestedAt = new Int32Array(maxRank);
  const spanningAt = new Int32Array(maxRank);
  for (const e of connections) {
    if (e.from === e.to || !ranks.rank.has(e.from) || !ranks.rank.has(e.to)) continue;
    const rf = rankOf(e.from);
    const rt = rankOf(e.to);
    const lo = Math.min(rf, rt);
    const hi = Math.max(rf, rt);
    const congested = hi - lo >= 2 || (deg.get(e.from) ?? 0) >= 4 || (deg.get(e.to) ?? 0) >= 4;
    for (let r = lo; r < hi; r++) {
      spanningAt[r] = (spanningAt[r] ?? 0) + 1;
      if (congested) congestedAt[r] = (congestedAt[r] ?? 0) + 1;
    }
  }
  const staticLabelGapAfter = new Map<number, number>();
  for (const step of doc.steps) {
    for (const s of step.statics) {
      if (!s.label || s.from === s.to || !ranks.rank.has(s.from) || !ranks.rank.has(s.to)) {
        continue;
      }
      const rf = rankOf(s.from);
      const rt = rankOf(s.to);
      if (Math.abs(rf - rt) !== 1) continue;
      const labelW = Math.min(EDGE_LABEL_MAX_WIDTH, textWidth(s.label, EDGE_LABEL_FONT_SIZE));
      const needed = Math.ceil(labelW + 32 - (NODE_SIZE.width - STATION_SIZE));
      const leftRank = Math.min(rf, rt);
      if (needed > (staticLabelGapAfter.get(leftRank) ?? 0)) {
        staticLabelGapAfter.set(leftRank, needed);
      }
    }
  }
  const columnX: number[] = [];
  let x = ORIGIN.x + inset;
  for (let rank = 0; rank <= maxRank; rank++) {
    columnX.push(x);
    const congestedCount = Math.max(
      congestedAt[rank] ?? 0,
      (spanningAt[rank] ?? 0) >= 4 ? (spanningAt[rank] ?? 0) : 0,
    );
    const congestionGap = Math.max(
      COLUMN_GAP + Math.min(112, Math.max(0, congestedCount - 2) * 14),
      staticLabelGapAfter.get(rank) ?? 0,
    );
    x += NODE_SIZE.width + congestionGap + clearanceAfter(rank);
  }

  let longSpanEdges = 0;
  for (const e of connections) {
    if (e.from === e.to || !ranks.rank.has(e.from) || !ranks.rank.has(e.to)) continue;
    if (Math.abs(rankOf(e.from) - rankOf(e.to)) >= 2) longSpanEdges++;
  }
  let hubNodes = 0;
  for (const d of deg.values()) {
    if (d >= 5) hubNodes++;
  }
  const rowGap = ROW_GAP + Math.min(20, Math.floor((longSpanEdges + hubNodes * 2) / 3) * 4);

  return { root, columnX, maxRank, inset, rowGap };
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
          colY += NODE_SIZE.height + plan.rowGap + room;
        }
        const bottom = colY - plan.rowGap - room;
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
