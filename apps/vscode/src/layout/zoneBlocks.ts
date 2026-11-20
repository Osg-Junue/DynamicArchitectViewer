import { synthesizedConnections } from '../model/connections';
import type { DavConnection, DavDocument } from '../model/types';
import { parentMap, topLevelGroups, zoneOfGroups, zoneOfNodes } from '../model/zones';
import {
  analyzeFlow,
  canReach,
  type FlowAnalysis,
  flowPairKey,
  isStaticRankExcluded,
} from './flow';
import { linksOf, segmentsOf } from './links';
import {
  EMPTY_GROUP_CONTENT,
  enclosingRect,
  GROUP_PADDING,
  groupHeaderHeight,
  type Layout,
  NODE_SIZE,
  ORIGIN,
  type Rect,
  rectRecord,
  STATION_CENTER,
  selfLoopRoom,
  zoneMinWidth,
} from './metrics';

/** With fewer top-level zones than this there is nothing to rearrange. */
const MIN_ZONES = 2;
export const LONG_LINK = 700;
export const HORIZONTAL_CLEARANCE = 60;
export const VERTICAL_CLEARANCE = 34;
const COLUMN_GAP = 150;
const STAGE_GAP = 80;
const ROW_GAP = 44;

/** Spacing profile for macro container placement (top-level vs tighter nested containers). */
export interface ZoneSpacing {
  stageGap: number;
  rowGap: number;
  horizontalClearance: number;
  verticalClearance: number;
  auxGap: number;
}

export const TOP_SPACING: ZoneSpacing = {
  stageGap: STAGE_GAP,
  rowGap: ROW_GAP,
  horizontalClearance: HORIZONTAL_CLEARANCE,
  verticalClearance: VERTICAL_CLEARANCE,
  auxGap: VERTICAL_CLEARANCE + 24,
};

export const NESTED_SPACING: ZoneSpacing = {
  stageGap: 48,
  rowGap: 24,
  horizontalClearance: 36,
  verticalClearance: 22,
  auxGap: 32,
};

/** Optional recursive builder used to lay out groups that contain nested child groups bottom-up. */
export type NestedBlockBuilder = (
  doc: DavDocument,
  zoneId: string,
  columnLayout: ColumnLayout,
  docFlow: FlowAnalysis,
  isAuxiliary: boolean,
  depth: number,
) => Block;

/**
 * Lays a diagram out in columns. `rankOverrides` puts nodes in a later column than their
 * edges alone would: the search moves a node that has columns to spare towards its links to
 * other zones.
 */
export type ColumnLayout = (
  doc: DavDocument,
  rankOverrides?: ReadonlyMap<string, number>,
  connections?: readonly DavConnection[],
  flow?: FlowAnalysis,
) => Layout;

/** Where the search put each zone. It holds no sizes, so it can be applied to resized zones. */
export type ZonePlacement = ReadonlyMap<
  string,
  {
    x: number;
    y: number;
    flip: 0 | 1;
    /** Node IDs ordered by unflipped local Y (applied per parent and column before flip), when refined from base order. */
    order?: readonly string[];
    /** The columns of the nodes the search moved to a later column than their edges give. */
    ranks?: Readonly<Record<string, number>>;
  }
>;

/** A top-level zone, or a node outside any zone, moved as one rigid piece. */
export interface Block {
  id: string;
  width: number;
  height: number;
  head: number;
  contentHeight: number;
  loopRoom: number;
  nodeLoopRoom: ReadonlyMap<string, number>;
  flippable: boolean;
  nodes: Map<string, Rect>;
  /** The zone's own frame first, then the groups nested in it. */
  groups: Map<string, Rect>;
  /** Group rectangles when `flip === 1`. */
  groupsFlipped: Map<string, Rect>;
  /** Per-node reflection constant `c` such that `flippedY = c - rect.y - rect.height`. */
  reflectConst: ReadonlyMap<string, number>;
  /** True when this block was composed bottom-up by recursive container placement. */
  recursive?: boolean;
}

export interface Placed {
  block: Block;
  x: number;
  y: number;
  flip: 0 | 1;
}

export function hasZonesToPlace(doc: Pick<DavDocument, 'groups'>): boolean {
  return topLevelGroups(doc.groups).length >= MIN_ZONES;
}

export const pairKey = flowPairKey;

/**
 * How much the links exceed a comfortable length. Steps do not count: a packet that goes there
 * and back moves nothing, so that writing steps never rearranges a diagram.
 */
export function longLinkExcess(doc: DavDocument, layout: Layout): number {
  let excess = 0;
  for (const s of segmentsOf(linksOf(doc), layout)) {
    excess += Math.max(0, Math.hypot(s.ax - s.bx, s.ay - s.by) - LONG_LINK);
  }
  return excess;
}

function flowStructureSnapshot(doc: DavDocument, connections = synthesizedConnections(doc)) {
  const flow = analyzeFlow(doc, connections);
  const sortedFirstSteps = [...flow.pairFirstStep.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );
  return [
    connections.filter((c) => c.from !== c.to).map((c) => [c.from, c.to]),
    flow.connections.map((c) => [c.from, c.to, c.role, c.direction]),
    flow.forwardEdges,
    [...flow.zoneStage.entries()],
    [...flow.auxiliaryZones],
    [flow.activeStepCount >= 4, ...sortedFirstSteps],
  ];
}

/** Everything the placement of the zones depends on, so other edits can reuse the last one. */
export function structureKey(doc: DavDocument): string {
  const connections = synthesizedConnections(doc);
  const selfLoops = [
    ...new Set(connections.filter((c) => c.from === c.to).map((c) => c.from)),
  ].sort();
  const connDoc = connectedSubdoc(doc);
  return JSON.stringify([
    doc.nodes.map((n) => [n.id, n.parentId ?? '', n.mount ?? '']),
    doc.groups.map((g) => [g.id, g.parentId ?? '']),
    selfLoops,
    flowStructureSnapshot(doc, connections),
    ...(connDoc === doc ? [] : [flowStructureSnapshot(connDoc)]),
  ]);
}

/**
 * Extracts the connected top-level subgraph when `doc` mixes inter-zone connected blocks with
 * `deg === 0` isolated blocks, so isolated internal edges never perturb connected flow analysis.
 */
export function connectedSubdoc(doc: DavDocument): DavDocument {
  const owners = ownersOf(doc);
  const known = new Set([...doc.nodes.map((n) => n.id), ...doc.groups.map((g) => g.id)]);
  const connectedIds = new Set<string>();
  for (const c of synthesizedConnections(doc)) {
    if (c.from === c.to || !known.has(c.from) || !known.has(c.to)) continue;
    const bu = owners.get(c.from) ?? c.from;
    const bv = owners.get(c.to) ?? c.to;
    if (bu !== bv) {
      connectedIds.add(bu);
      connectedIds.add(bv);
    }
  }
  if (connectedIds.size === 0) return doc;
  const allGroupsConnected = topLevelGroups(doc.groups).every((g) => connectedIds.has(g.id));
  const allNodesConnected = doc.nodes.every((n) => connectedIds.has(owners.get(n.id) ?? n.id));
  if (allGroupsConnected && allNodesConnected) return doc;

  const zoneOf = zoneOfGroups(doc.groups);
  const groups = doc.groups.filter((g) => connectedIds.has(zoneOf.get(g.id) ?? g.id));
  const nodes = doc.nodes.filter((n) => connectedIds.has(owners.get(n.id) ?? n.id));
  const keptNodes = new Set(nodes.map((n) => n.id));
  const keptIds = new Set([...keptNodes, ...groups.map((g) => g.id)]);
  const steps = doc.steps.map((s) => ({
    ...s,
    animations: s.animations.filter((a) => keptNodes.has(a.from) && keptNodes.has(a.to)),
    statics: s.statics.filter((st) => keptIds.has(st.from) && keptIds.has(st.to)),
  }));
  return { ...doc, groups, nodes, steps };
}

/** The same diagram without `static` labels so typing a label cannot invalidate cached placement. */
export function withoutLabels(doc: DavDocument): DavDocument {
  return {
    ...doc,
    steps: doc.steps.map((step) => ({
      ...step,
      statics: step.statics.map(({ label: _label, ...rest }) => rest),
    })),
  };
}

/** Makes something directly inside a zone top-level, for laying the zone out on its own. */
function detach<T extends { parentId?: string }>(item: T, zoneId: string): T | Omit<T, 'parentId'> {
  if (item.parentId !== zoneId) return item;
  const { parentId: _parentId, ...rest } = item;
  return rest;
}

/** The block each node or group moves with: its top-level zone, or the node itself outside any zone. */
export function ownersOf(doc: DavDocument): Map<string, string> {
  const zoneOf = zoneOfGroups(doc.groups);
  const nodeZone = zoneOfNodes(doc);
  const owners = new Map<string, string>();
  for (const g of doc.groups) {
    owners.set(g.id, zoneOf.get(g.id) ?? g.id);
  }
  for (const n of doc.nodes) {
    const z = nodeZone.get(n.id);
    owners.set(n.id, z !== undefined && zoneOf.has(z) ? z : n.id);
  }
  return owners;
}

/** How many links run between zones: the time the search takes grows with them. */
export function linksBetweenZones(doc: DavDocument): number {
  const owners = ownersOf(doc);
  return synthesizedConnections(doc).filter((e) => {
    const from = owners.get(e.from);
    const to = owners.get(e.to);
    return from !== undefined && to !== undefined && from !== to;
  }).length;
}

/**
 * What a zone looks like upside down. A zone with nothing but nodes in it mirrors as a whole.
 * One with groups in it, or with room for loops above its rows, cannot: the name of a group
 * stays at its top and the room for a loop stays above its node. Each level is mirrored on
 * its own instead: the nodes and groups directly in it swap places top to bottom inside the
 * room they took up, and each group does the same with what is in it.
 */
export function computeFlipMetadata(
  zoneId: string,
  nodes: ReadonlyArray<{ id: string; parentId?: string }>,
  nested: ReadonlyArray<{ id: string; parentId?: string }>,
  loopRoom: number,
  nodesMap: ReadonlyMap<string, Rect>,
  groupsMap: ReadonlyMap<string, Rect>,
): { groupsFlipped: Map<string, Rect>; reflectConst: Map<string, number> } {
  const groupsFlipped = new Map<string, Rect>();
  const rootFrame = groupsMap.get(zoneId);
  if (rootFrame) groupsFlipped.set(zoneId, rootFrame);
  const reflectConst = new Map<string, number>();

  const visit = (parentKey: string | undefined, shiftY: number): void => {
    const directNodes = nodes.filter((n) => n.parentId === parentKey);
    const childGroups = nested.filter((g) => g.parentId === parentKey);
    const tops: number[] = [];
    const bots: number[] = [];
    for (const dn of directNodes) {
      const r = nodesMap.get(dn.id);
      if (r) {
        tops.push(r.y - loopRoom);
        bots.push(r.y + r.height);
      }
    }
    for (const cg of childGroups) {
      const gr = groupsMap.get(cg.id);
      if (gr) {
        tops.push(gr.y);
        bots.push(gr.y + gr.height);
      }
    }
    if (tops.length === 0) return;
    const oldMinTop = Math.min(...tops);
    const oldMaxBot = Math.max(...bots);
    const newMinTop = oldMinTop + shiftY;
    const c = newMinTop + oldMaxBot + loopRoom;
    for (const dn of directNodes) reflectConst.set(dn.id, c);
    for (const cg of childGroups) {
      const gr = groupsMap.get(cg.id);
      if (!gr) continue;
      const newGrY = newMinTop + (oldMaxBot - (gr.y + gr.height));
      groupsFlipped.set(cg.id, { ...gr, y: newGrY });
      visit(cg.id, newGrY - gr.y);
    }
  };

  visit(undefined, 0);
  return { groupsFlipped, reflectConst };
}

/** Builds local role classification and acyclic forward ranking edges inside one top-level zone. */
export function intraZoneFlow(
  ids: ReadonlySet<string>,
  connections: readonly DavConnection[],
  docFlow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
): FlowAnalysis {
  const localConns = docFlow.connections.filter((c) => ids.has(c.from) && ids.has(c.to));
  const primaryConns = localConns.filter((c) => c.role === 'primary');
  const staticConns = localConns.filter((c) => c.role === 'static');
  const bidirStatic = new Set<string>();
  for (const c of connections) {
    if (c.direction === 'bidirectional') {
      bidirStatic.add(pairKey(c.from, c.to));
    }
  }

  // Score each node's external pull: negative = pulled left (receives from earlier stage), positive = pulled right (feeds later stage).
  const extBias = new Map<string, number>();
  const myZone = [...ids].map((id) => owners.get(id)).find((z) => z !== undefined);
  const myStage = myZone !== undefined ? (docFlow.zoneStage.get(myZone) ?? 0) : 0;
  for (const c of docFlow.connections) {
    const inFrom = ids.has(c.from);
    const inTo = ids.has(c.to);
    if (inFrom === inTo) continue;
    const other = inFrom ? c.to : c.from;
    const otherZone = owners.get(other) ?? other;
    const otherStage = docFlow.zoneStage.get(otherZone) ?? myStage;
    const delta = otherStage - myStage;
    const w = c.role === 'primary' ? 3 : c.role === 'static' ? 1 : 0.2;
    const self = inFrom ? c.from : c.to;
    const sign = delta !== 0 ? Math.sign(delta) : inFrom ? 1 : -1;
    extBias.set(self, (extBias.get(self) ?? 0) + sign * w);
  }

  const forwardEdges: Array<readonly [string, string]> = [];
  if (primaryConns.length === 0) {
    for (const c of staticConns) {
      const k = pairKey(c.from, c.to);
      if (docFlow.egressReturnPairs?.has(k)) continue;
      if (bidirStatic.has(k) && (extBias.get(c.from) ?? 0) > (extBias.get(c.to) ?? 0)) {
        forwardEdges.push([c.to, c.from]);
      } else {
        forwardEdges.push([c.from, c.to]);
      }
    }
  } else {
    const adj = new Map<string, Set<string>>();
    const add = (u: string, v: string) => {
      let s = adj.get(u);
      if (!s) {
        s = new Set();
        adj.set(u, s);
      }
      s.add(v);
    };
    for (const c of primaryConns) {
      add(c.from, c.to);
      forwardEdges.push([c.from, c.to]);
    }
    for (const c of staticConns) {
      if (isStaticRankExcluded(c.from, c.to, docFlow)) continue;
      const k = pairKey(c.from, c.to);
      let u = c.from;
      let v = c.to;
      if (bidirStatic.has(k) && (extBias.get(u) ?? 0) > (extBias.get(v) ?? 0)) {
        u = c.to;
        v = c.from;
      }
      if (!canReach(adj, v, u)) {
        add(u, v);
        forwardEdges.push([u, v]);
      }
    }
  }

  return {
    connections: localConns,
    byPair: new Map(),
    forwardEdges,
    hasAnimate: primaryConns.length > 0 || localConns.some((c) => c.role === 'return'),
    zoneStage: new Map(),
    auxiliaryZones: new Set(),
    primaryZonePairs: new Set(),
    pairFirstStep: new Map(),
    activeStepCount: 0,
  };
}

/** One top-level zone laid out on its own, as a piece the search moves about. */
export function buildSingleZoneBlock(
  doc: DavDocument,
  zoneId: string,
  columnLayout: ColumnLayout,
  rankOverrides?: ReadonlyMap<string, number>,
  zoneOf: ReadonlyMap<string, string> = zoneOfGroups(doc.groups),
  owners: ReadonlyMap<string, string> = ownersOf(doc),
  docFlow: FlowAnalysis = analyzeFlow(doc),
  buildNested?: NestedBlockBuilder,
  isAuxiliary = false,
  depth = 0,
): Block {
  const pad = GROUP_PADDING;
  const nodes = doc.nodes.filter((n) => owners.get(n.id) === zoneId).map((n) => detach(n, zoneId));
  const nested = doc.groups
    .filter((g) => g.id !== zoneId && zoneOf.get(g.id) === zoneId)
    .map((g) => detach(g, zoneId));
  if (buildNested && nested.length > 0 && !rankOverrides) {
    return buildNested(doc, zoneId, columnLayout, docFlow, isAuxiliary, depth);
  }
  const groupLabel = doc.groups.find((g) => g.id === zoneId)?.label ?? '';
  const ids = new Set(nodes.map((n) => n.id));
  const connections = synthesizedConnections(doc).filter((e) => ids.has(e.from) && ids.has(e.to));
  const loopSteps = doc.steps.map((s) => ({
    ...s,
    animations: s.animations.filter((a) => ids.has(a.from) && ids.has(a.to)),
    statics: s.statics.filter((st) => ids.has(st.from) && ids.has(st.to)),
  }));
  const nodeLoopRoom = selfLoopRoom({ steps: loopSteps });
  const loopRoom = Math.max(0, ...nodeLoopRoom.values());
  const frame = (width: number, height: number): [string, Rect] => [
    zoneId,
    { x: 0, y: 0, width, height },
  ];

  // A zone with groups inside is laid out like any other, even without nodes: the column
  // layout gives empty groups their rectangles.
  if (nodes.length === 0 && nested.length === 0) {
    const rawWidth = EMPTY_GROUP_CONTENT.width + pad * 2;
    const width = Math.max(rawWidth, zoneMinWidth(groupLabel));
    const head = groupHeaderHeight(groupLabel, width) + pad + loopRoom;
    const height = head + EMPTY_GROUP_CONTENT.height + pad;
    const groupsMap = new Map([frame(width, height)]);
    return {
      id: zoneId,
      width,
      height,
      head,
      contentHeight: EMPTY_GROUP_CONTENT.height,
      loopRoom,
      nodeLoopRoom,
      flippable: false,
      nodes: new Map(),
      groups: groupsMap,
      groupsFlipped: new Map(groupsMap),
      reflectConst: new Map(),
    };
  }

  const local = columnLayout(
    { ...doc, nodes, groups: nested, steps: loopSteps },
    rankOverrides,
    connections,
    intraZoneFlow(ids, connections, docFlow, owners),
  );
  const bounds = enclosingRect([...Object.values(local.nodes), ...Object.values(local.groups)]);
  const rawWidth = bounds.width + pad * 2;
  const width = Math.max(rawWidth, zoneMinWidth(groupLabel));
  const padLeft = pad + Math.round((width - rawWidth) / 2);
  const head = groupHeaderHeight(groupLabel, width) + pad + loopRoom;
  const contentHeight = bounds.height;
  const height = head + contentHeight + pad;
  const place = (r: Rect): Rect => ({
    ...r,
    x: r.x - bounds.x + padLeft,
    y: r.y - bounds.y + head,
  });
  const nodesMap = new Map(Object.entries(local.nodes).map(([id, r]) => [id, place(r)]));
  const groupsMap = new Map<string, Rect>([
    frame(width, height),
    ...Object.entries(local.groups).map(([id, r]): [string, Rect] => [id, place(r)]),
  ]);
  const { groupsFlipped, reflectConst } = computeFlipMetadata(
    zoneId,
    nodes,
    nested,
    loopRoom,
    nodesMap,
    groupsMap,
  );
  return {
    id: zoneId,
    width,
    height,
    head,
    contentHeight,
    loopRoom,
    nodeLoopRoom,
    flippable: loopRoom === 0 && nested.length === 0,
    nodes: nodesMap,
    groups: groupsMap,
    groupsFlipped,
    reflectConst,
  };
}

export function buildBlocks(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  ranksByZone?: ReadonlyMap<string, ReadonlyMap<string, number>>,
  docFlow: FlowAnalysis = analyzeFlow(doc),
  buildNested?: NestedBlockBuilder,
): { blocks: Block[]; owners: Map<string, string> } {
  const zoneOf = zoneOfGroups(doc.groups);
  const owners = ownersOf(doc);
  const docLoops = selfLoopRoom(doc);
  const connDoc = connectedSubdoc(doc);
  const connZoneIds =
    connDoc === doc ? null : new Set(topLevelGroups(connDoc.groups).map((g) => g.id));
  const connFlow =
    connDoc === doc ? docFlow : analyzeFlow(connDoc, synthesizedConnections(connDoc));

  const blocks: Block[] = [];
  for (const zone of topLevelGroups(doc.groups)) {
    const zFlow = connZoneIds === null || connZoneIds.has(zone.id) ? connFlow : docFlow;
    blocks.push(
      buildSingleZoneBlock(
        doc,
        zone.id,
        columnLayout,
        ranksByZone?.get(zone.id),
        zoneOf,
        owners,
        zFlow,
        buildNested,
        zFlow.auxiliaryZones.has(zone.id),
        0,
      ),
    );
  }
  for (const n of doc.nodes) {
    if (owners.get(n.id) !== n.id) continue;
    const { width, height } = NODE_SIZE;
    const loopRoom = docLoops.get(n.id) ?? 0;
    blocks.push({
      id: n.id,
      width,
      height,
      head: 0,
      contentHeight: height,
      loopRoom,
      nodeLoopRoom: loopRoom > 0 ? new Map([[n.id, loopRoom]]) : new Map(),
      flippable: false,
      nodes: new Map([[n.id, { x: 0, y: 0, width, height }]]),
      groups: new Map(),
      groupsFlipped: new Map(),
      reflectConst: new Map(),
    });
  }
  return { blocks, owners };
}

const compareBlockId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Separates top-level blocks that have zero inter-block edges (neither directly nor via
 * nested descendants) from connected blocks so isolated additions never perturb connected solving.
 */
export function partitionIsolatedBlocks(
  blocks: readonly Block[],
  flow: FlowAnalysis,
  owners?: ReadonlyMap<string, string>,
): { connected: Block[]; isolated: Block[] } {
  let ownerOf = owners;
  if (!ownerOf) {
    const derived = new Map<string, string>();
    for (const b of blocks) {
      for (const nodeId of b.nodes.keys()) derived.set(nodeId, b.id);
    }
    ownerOf = derived;
  }
  const connectedIds = new Set<string>();
  for (const c of flow.connections) {
    const bu = ownerOf.get(c.from) ?? c.from;
    const bv = ownerOf.get(c.to) ?? c.to;
    if (bu !== bv) {
      connectedIds.add(bu);
      connectedIds.add(bv);
    }
  }
  const connected: Block[] = [];
  const isolated: Block[] = [];
  for (const b of blocks) {
    if (connectedIds.has(b.id)) connected.push(b);
    else isolated.push(b);
  }
  return { connected, isolated };
}

/**
 * Places `deg === 0` isolated blocks deterministically in alphabetical `id` order in rows below
 * `connectedPlaced`'s final `maxY + ROW_GAP` (starting at `minX` so connected coordinates stay exact).
 */
export function placeIsolatedBlocks(
  isolated: readonly Block[],
  connectedPlaced: readonly Placed[],
  spacing: ZoneSpacing = TOP_SPACING,
): Placed[] {
  if (isolated.length === 0) return [];
  const sorted = [...isolated].sort((a, b) => compareBlockId(a.id, b.id));
  let startX = 0;
  let rowBaseY = 0;
  let rowLimit = 1800;
  if (connectedPlaced.length > 0) {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of connectedPlaced) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.block.width);
      maxY = Math.max(maxY, p.y + p.block.height);
    }
    startX = minX;
    rowBaseY = maxY + spacing.rowGap;
    rowLimit = Math.max(1800, maxX - minX);
  }
  const out: Placed[] = [];
  let x = startX;
  let rowBottom = rowBaseY;
  for (const b of sorted) {
    if (x > startX && x + b.width > startX + rowLimit) {
      x = startX;
      rowBaseY = rowBottom + spacing.rowGap;
      rowBottom = rowBaseY;
    }
    const extraTop = b.groups.size === 0 ? b.loopRoom : 0;
    const blockY = rowBaseY + extraTop;
    out.push({ block: b, x, y: blockY, flip: 0 });
    rowBottom = Math.max(rowBottom, blockY + b.height);
    x += b.width + spacing.horizontalClearance;
  }
  return out;
}

/** Partitions blocks into primary stage columns (left-to-right by `zoneStage`) and auxiliary bands. */
export function stageColumns(
  blocks: readonly Block[],
  flow: FlowAnalysis,
): { primary: Block[]; auxiliary: Block[]; columns: Block[][] } {
  const primary = blocks.filter((b) => !flow.auxiliaryZones.has(b.id));
  const auxiliary = blocks.filter((b) => flow.auxiliaryZones.has(b.id));
  if (primary.length === 0) {
    primary.push(...auxiliary);
    auxiliary.length = 0;
  }
  const stageNumbers = [...new Set(primary.map((b) => flow.zoneStage.get(b.id) ?? 0))].sort(
    (a, b) => a - b,
  );
  const columns = stageNumbers.map((stage) =>
    primary
      .filter((b) => (flow.zoneStage.get(b.id) ?? 0) === stage)
      .sort((a, b) => compareBlockId(a.id, b.id)),
  );
  return { primary, auxiliary, columns };
}

/**
 * Whether the staged left-to-right flow fits without strip wrapping (true for real multi-layer
 * architectures, false for static-only graphs or ultra-wide 6+ zone strips that wrap across rows).
 */
export function shouldPreserveFlow(blocks: readonly Block[], flow: FlowAnalysis): boolean {
  if (!flow.hasAnimate) return false;
  const { connected, isolated } = partitionIsolatedBlocks(blocks, flow);
  if (connected.length === 0) return false;
  if (isolated.length > 0) {
    const connNodes = new Set(connected.flatMap((b) => [...b.nodes.keys()]));
    const connHasAnimate = flow.connections.some(
      (c) => c.role !== 'static' && connNodes.has(c.from) && connNodes.has(c.to),
    );
    if (!connHasAnimate) return false;
  }
  const { auxiliary, columns } = stageColumns(connected, flow);
  if (columns.length === 0) return true;
  const maxWidthOfCols = columns.reduce(
    (sum, col) => sum + Math.max(...col.map((b) => b.width)),
    Math.max(0, columns.length - 1) * STAGE_GAP,
  );
  const tallestPrimary = Math.max(
    0,
    ...columns.map(
      (col) => col.reduce((s, b) => s + b.height, 0) + Math.max(0, col.length - 1) * ROW_GAP,
    ),
  );
  if (columns.length >= 6 && maxWidthOfCols / Math.max(1, tallestPrimary) > 5.8) return false;
  const auxExtra =
    auxiliary.length > 0
      ? Math.max(...auxiliary.map((b) => b.height)) + VERTICAL_CLEARANCE + 24
      : 0;
  const stagedHeight = tallestPrimary + auxExtra;
  const maxAspect = columns.length <= 3 ? 16 : 10;
  return maxWidthOfCols / Math.max(1, stagedHeight) <= maxAspect;
}

const MACRO_TARGET_ASPECT = 1.6;

export interface MacroGrid {
  rows: Block[][][];
  wrapped: boolean;
  auxiliary: Block[];
  rowOfBlock: Map<string, number>;
}

export interface AuxiliaryBandEntry {
  placed: Placed;
  cx: number;
  maxRight: number;
}

export interface AuxiliaryPlacementOptions {
  auxMode?: 'bands' | 'right-top';
  cols?: readonly (readonly Block[])[];
  rowFracOf?: ReadonlyMap<string, number>;
  sideMode?: 'stationY' | 'rowFrac';
  clampMaxSource?: boolean;
  decayStatic?: boolean;
  spacing?: ZoneSpacing;
}

function hasBlockClearance(
  a: Placed,
  placed: readonly Placed[],
  horizontalClearance = HORIZONTAL_CLEARANCE,
  verticalClearance = VERTICAL_CLEARANCE,
): boolean {
  for (const b of placed) {
    if (b === a) continue;
    if (
      a.x < b.x + b.block.width + horizontalClearance &&
      b.x < a.x + a.block.width + horizontalClearance &&
      a.y < b.y + b.block.height + verticalClearance &&
      b.y < a.y + a.block.height + verticalClearance
    ) {
      return false;
    }
  }
  return true;
}

function deriveBlockOwners(
  columns: readonly (readonly Block[])[],
  owners?: ReadonlyMap<string, string>,
): ReadonlyMap<string, string> {
  if (owners) return owners;
  const derived = new Map<string, string>();
  for (const col of columns) {
    for (const b of col) {
      for (const nodeId of b.nodes.keys()) derived.set(nodeId, b.id);
    }
  }
  return derived;
}

function splitTallStaticColumns(
  columns: readonly (readonly Block[])[],
  flow: FlowAnalysis,
  owners?: ReadonlyMap<string, string>,
): Block[][] {
  if (flow.hasAnimate || !columns.some((col) => col.length >= 4)) {
    return columns.map((col) => [...col]);
  }
  const ownerOf = deriveBlockOwners(columns, owners);
  const interDegree = new Map<string, number>();
  for (const c of flow.connections) {
    const bu = ownerOf.get(c.from) ?? c.from;
    const bv = ownerOf.get(c.to) ?? c.to;
    if (bu === bv) continue;
    interDegree.set(bu, (interDegree.get(bu) ?? 0) + 1);
    interDegree.set(bv, (interDegree.get(bv) ?? 0) + 1);
  }
  const colHeight = (col: readonly Block[]) =>
    col.reduce((s, b) => s + b.height, 0) + Math.max(0, col.length - 1) * ROW_GAP;
  const colWidth = (col: readonly Block[]) =>
    col.length === 0 ? 0 : Math.max(...col.map((b) => b.width));
  const otherCols = columns.filter((col) => col.length < 4);
  const baseOtherW = otherCols.reduce((s, col) => s + colWidth(col) + COLUMN_GAP, 0);
  const baseOtherH = Math.max(0, ...otherCols.map(colHeight));

  const chunkEvenly = (items: readonly Block[], k: number): Block[][] => {
    const chunks: Block[][] = [];
    const base = Math.floor(items.length / k);
    const rem = items.length % k;
    let offset = 0;
    for (let i = 0; i < k; i++) {
      const size = base + (i < rem ? 1 : 0);
      chunks.push(items.slice(offset, offset + size));
      offset += size;
    }
    return chunks;
  };

  const expanded: Block[][] = [];
  for (const col of columns) {
    if (col.length < 4) {
      expanded.push([...col]);
      continue;
    }
    const sorted = [...col].sort(
      (a, b) =>
        (interDegree.get(b.id) ?? 0) - (interDegree.get(a.id) ?? 0) ||
        b.nodes.size - a.nodes.size ||
        compareBlockId(a.id, b.id),
    );
    const maxK = Math.min(sorted.length, Math.max(2, Math.ceil(Math.sqrt(sorted.length)) + 1));
    let bestChunks = chunkEvenly(sorted, 2);
    let bestAspectErr = Number.POSITIVE_INFINITY;
    for (let k = 2; k <= maxK; k++) {
      const chunks = chunkEvenly(sorted, k);
      const w =
        baseOtherW +
        chunks.reduce((s, ch) => s + colWidth(ch), Math.max(0, chunks.length - 1) * COLUMN_GAP);
      const h = Math.max(baseOtherH, ...chunks.map(colHeight));
      const err = Math.abs(Math.log(Math.max(0.01, w / Math.max(1, h)) / MACRO_TARGET_ASPECT));
      if (err < bestAspectErr - 1e-9) {
        bestAspectErr = err;
        bestChunks = chunks;
      }
    }
    expanded.push(...bestChunks);
  }
  return expanded;
}

/**
 * Packs stage columns left-to-right across wrapped horizontal rows, splitting tall static-only
 * columns (`>= 4` stacked blocks) first so non-flow clusters form balanced grids.
 */
export function wrapStageColumns(
  columns: readonly (readonly Block[])[],
  flow: FlowAnalysis,
  owners?: ReadonlyMap<string, string>,
): Block[][][] {
  if (columns.length === 0) return [];
  const packedCols = splitTallStaticColumns(columns, flow, owners);
  const maxWidthOfCols = packedCols.reduce(
    (sum, col) => sum + (col.length === 0 ? 0 : Math.max(...col.map((b) => b.width))),
    Math.max(0, packedCols.length - 1) * COLUMN_GAP,
  );
  const colHeights = packedCols.map(
    (col) => col.reduce((s, b) => s + b.height, 0) + Math.max(0, col.length - 1) * ROW_GAP,
  );
  const avgRowH =
    colHeights.reduce((s, h) => s + h, 0) / Math.max(1, packedCols.length) +
    VERTICAL_CLEARANCE +
    24;
  const rowWidthTarget = Math.max(1600, Math.sqrt(maxWidthOfCols * 3.0 * avgRowH));
  const rows: Block[][][] = [[]];
  let curW = 0;
  for (const col of packedCols) {
    if (col.length === 0) continue;
    const colW = Math.max(...col.map((b) => b.width));
    const curRow = rows[rows.length - 1] as Block[][];
    if (curRow.length > 0 && curW + COLUMN_GAP + colW > rowWidthTarget) {
      rows.push([col]);
      curW = colW;
    } else {
      if (curRow.length > 0) curW += COLUMN_GAP;
      curRow.push(col);
      curW += colW;
    }
  }
  return rows.filter((r) => r.length > 0);
}

/**
 * Prepares the macro row/column grid for connected blocks, preserving single-row stage columns
 * when `shouldPreserveFlow` holds and wrapping static/ultra-wide chains into `rows` otherwise.
 */
export function prepareMacroGrid(
  connected: readonly Block[],
  flow: FlowAnalysis,
  owners?: ReadonlyMap<string, string>,
): MacroGrid {
  if (connected.length === 0) {
    return { rows: [], wrapped: false, auxiliary: [], rowOfBlock: new Map() };
  }
  const { auxiliary, columns } = stageColumns(connected, flow);
  const rowOfBlock = new Map<string, number>();
  if (shouldPreserveFlow(connected, flow)) {
    const rows = columns.length > 0 ? [columns] : [];
    for (const col of columns) {
      for (const b of col) rowOfBlock.set(b.id, 0);
    }
    return { rows, wrapped: false, auxiliary, rowOfBlock };
  }
  const rows = wrapStageColumns(columns, flow, owners);
  rows.forEach((rowCols, rowIdx) => {
    for (const col of rowCols) {
      for (const b of col) rowOfBlock.set(b.id, rowIdx);
    }
  });
  return { rows, wrapped: true, auxiliary, rowOfBlock };
}

/**
 * Starting point for zone placement: arranges connected primary blocks left-to-right by flow stage,
 * wraps over-wide synthetic chains into compact rows, places auxiliary cross-cutting zones
 * in upper/lower bands aligned with the stations they connect to, and places isolated blocks below.
 */
export function initialPositions(
  doc: DavDocument,
  blocks: readonly Block[],
  owners: ReadonlyMap<string, string>,
  flow: FlowAnalysis = analyzeFlow(doc),
): Map<string, { x: number; y: number }> {
  const { connected, isolated } = partitionIsolatedBlocks(blocks, flow, owners);
  const out = new Map<string, { x: number; y: number }>();
  if (connected.length === 0) {
    for (const p of placeIsolatedBlocks(isolated, [])) out.set(p.block.id, { x: p.x, y: p.y });
    return out;
  }

  const connDoc = isolated.length > 0 ? connectedSubdoc(doc) : doc;
  const connFlow = connDoc === doc ? flow : analyzeFlow(connDoc);
  const blockById = new Map(connected.map((b) => [b.id, b]));
  const grid = prepareMacroGrid(connected, connFlow, owners);
  const primaryPlaced: Placed[] = [];

  if (grid.wrapped) {
    let rowY = 0;
    for (const rowCols of grid.rows) {
      const colHeights = rowCols.map(
        (col) => col.reduce((s, b) => s + b.height, 0) + Math.max(0, col.length - 1) * ROW_GAP,
      );
      const rowH = Math.max(0, ...colHeights);
      let x = 0;
      rowCols.forEach((col, ci) => {
        let y = rowY + (rowH - (colHeights[ci] ?? 0)) / 2;
        for (const b of col) {
          out.set(b.id, { x, y });
          primaryPlaced.push({ block: b, x, y, flip: 0 });
          y += b.height + ROW_GAP;
        }
        x += Math.max(...col.map((b) => b.width)) + COLUMN_GAP;
      });
      rowY += rowH + VERTICAL_CLEARANCE + 24;
    }
  } else {
    const columns = grid.rows[0] ?? [];
    // Build neighbor lookup to order stacked zones within a stage near their connected neighbors.
    const predOwners = new Map<string, string[]>();
    for (const c of connFlow.connections) {
      if (c.role === 'return') continue;
      const bu = owners.get(c.from);
      const bv = owners.get(c.to);
      if (!bu || !bv || bu === bv) continue;
      const list = predOwners.get(bv);
      if (list) list.push(bu);
      else predOwners.set(bv, [bu]);
    }
    const heightOf = (column: readonly Block[]) =>
      column.reduce((sum, b) => sum + b.height, 0) + Math.max(0, column.length - 1) * ROW_GAP;
    const tallest = Math.max(0, ...columns.map(heightOf));

    let x = 0;
    for (const column of columns) {
      column.sort((a, b) => {
        const meanY = (id: string) => {
          const ys = (predOwners.get(id) ?? []).flatMap((p) => {
            const pos = out.get(p);
            const pb = blockById.get(p);
            return pos && pb ? [pos.y + pb.height / 2] : [];
          });
          return ys.length > 0
            ? ys.reduce((s, v) => s + v, 0) / ys.length
            : Number.POSITIVE_INFINITY;
        };
        return meanY(a.id) - meanY(b.id) || compareBlockId(a.id, b.id);
      });
      let y = (tallest - heightOf(column)) / 2;
      for (const b of column) {
        out.set(b.id, { x, y });
        primaryPlaced.push({ block: b, x, y, flip: 0 });
        y += b.height + ROW_GAP;
      }
      x += Math.max(...column.map((b) => b.width)) + STAGE_GAP;
    }
  }

  if (grid.auxiliary.length > 0) {
    const auxPlaced: Placed[] = grid.auxiliary.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
    placeAuxiliaryBlocks(auxPlaced, primaryPlaced, owners, connFlow);
    for (const p of auxPlaced) out.set(p.block.id, { x: p.x, y: p.y });
  }

  if (isolated.length > 0) {
    const connectedPlaced: Placed[] = connected.map((block) => {
      const pos = out.get(block.id) ?? { x: 0, y: 0 };
      return { block, x: pos.x, y: pos.y, flip: 0 };
    });
    for (const p of placeIsolatedBlocks(isolated, connectedPlaced)) {
      out.set(p.block.id, { x: p.x, y: p.y });
    }
  }
  return out;
}

/** Packs one auxiliary band row-by-row above or below the primary stage extent. */
export function placeAuxiliaryBand(
  band: readonly AuxiliaryBandEntry[],
  isAbove: boolean,
  startRefX: number,
  bandMinY: number,
  bandMaxY: number,
  rowLimit: number,
  spacing: ZoneSpacing = TOP_SPACING,
): void {
  const rows: Array<{ items: Array<{ placed: Placed; x: number }>; height: number }> = [];
  let end = Number.NEGATIVE_INFINITY;
  for (const entry of band) {
    const { placed: p, cx, maxRight } = entry;
    const rawX = cx - p.block.width / 2;
    const cur = rows[rows.length - 1];
    const nextX = Math.max(rawX, end + spacing.horizontalClearance);
    if (
      !cur ||
      (cur.items.length > 0 &&
        (nextX - startRefX + p.block.width > rowLimit || nextX + p.block.width > maxRight + 1))
    ) {
      rows.push({ items: [{ placed: p, x: rawX }], height: p.block.height });
      end = rawX + p.block.width;
    } else {
      cur.items.push({ placed: p, x: nextX });
      cur.height = Math.max(cur.height, p.block.height);
      end = nextX + p.block.width;
    }
  }
  let edgeY = isAbove ? bandMinY - spacing.auxGap : bandMaxY + spacing.auxGap;
  for (const row of rows) {
    for (const { placed: p, x } of row.items) {
      p.x = x;
      p.y = isAbove ? edgeY - p.block.height : edgeY;
    }
    edgeY = isAbove ? edgeY - row.height - spacing.rowGap : edgeY + row.height + spacing.rowGap;
  }
}

/**
 * Places auxiliary zones in upper/lower bands (and optional `'right-top'` pocket/right column)
 * aligned with their connected primary neighbors. Returns placed auxiliaries sorted by target `cx`.
 */
export function placeAuxiliaryBlocks(
  auxPlaced: readonly Placed[],
  primaryPlaced: readonly Placed[],
  owners: ReadonlyMap<string, string>,
  flow: FlowAnalysis,
  opts?: AuxiliaryPlacementOptions,
): Placed[] {
  if (auxPlaced.length === 0) return [];
  const auxMode = opts?.auxMode ?? 'bands';
  const sideMode = opts?.sideMode ?? 'stationY';
  const clampMaxSource = opts?.clampMaxSource ?? false;
  const decayStatic = opts?.decayStatic ?? false;
  const spacing = opts?.spacing ?? TOP_SPACING;
  const rowFracOf = opts?.rowFracOf;
  const cols = opts?.cols;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of primaryPlaced) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x + p.block.width);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + p.block.height);
  }
  const hasPrimary = Number.isFinite(minX);
  const midX = hasPrimary ? (minX + maxX) / 2 : 0;
  const midY = hasPrimary ? (minY + maxY) / 2 : 0;
  let bandMinY = hasPrimary ? minY : 0;
  let bandMaxY = hasPrimary ? maxY : 0;
  let rowLimit = Math.max(hasPrimary ? maxX - minX : 1600, 1600) + 400;
  const startRefX = hasPrimary ? minX : 0;

  const auxById = new Map(auxPlaced.map((p) => [p.block.id, p]));
  const priById = new Map(primaryPlaced.map((p) => [p.block.id, p]));

  const statsFor = (id: string) => {
    let wx = 0;
    let wy = 0;
    let wFrac = 0;
    let wSum = 0;
    let minTargetCenter = Number.NEGATIVE_INFINITY;
    let maxSourceCenter = Number.POSITIVE_INFINITY;
    let minOutPriStep = Number.POSITIVE_INFINITY;
    const ownPlaced = auxById.get(id);

    for (const c of flow.connections) {
      const bu = owners.get(c.from) ?? c.from;
      const bv = owners.get(c.to) ?? c.to;
      if (bu === bv || (bu !== id && bv !== id)) continue;
      const otherId = bu === id ? bv : bu;
      if (flow.auxiliaryZones.has(otherId)) continue;
      const op = priById.get(otherId);
      if (!op) continue;
      const otherNodeId = bu === id ? c.to : c.from;
      const selfNodeId = bu === id ? c.from : c.to;
      const nr = op.block.nodes.get(otherNodeId);
      const sx = op.x + (nr ? nr.x + nr.width / 2 : op.block.width / 2);
      const fs = flow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
      const w =
        c.role === 'primary'
          ? 3 / (1 + 0.08 * fs)
          : c.role === 'return'
            ? 1 / (1 + 0.08 * fs)
            : decayStatic
              ? (flow.hasAnimate ? 0.06 : 0.5) / (1 + 0.35 * fs)
              : 0.5 / (1 + 0.08 * fs);
      wx += sx * w;
      if (sideMode === 'rowFrac') {
        const relNodeFrac = nr
          ? ((op.flip ? flippedY(op.block, nr, otherNodeId) : nr.y) / Math.max(1, op.block.height) -
              0.5) *
            0.12
          : 0;
        const slotFrac = (rowFracOf?.get(otherId) ?? 0.5) + relNodeFrac;
        wFrac += slotFrac * w;
      } else {
        const sy =
          op.y +
          (nr
            ? (op.flip ? flippedY(op.block, nr, otherNodeId) : nr.y) + STATION_CENTER
            : op.block.height / 2);
        wy += sy * w;
      }
      wSum += w;

      if (c.role === 'primary' && ownPlaced) {
        const sn = ownPlaced.block.nodes.get(selfNodeId);
        if (sn) {
          const relSelfX = sn.x + sn.width / 2;
          if (bv === id) {
            minTargetCenter = Math.max(
              minTargetCenter,
              sx + 24 - relSelfX + ownPlaced.block.width / 2,
            );
          } else {
            minOutPriStep = Math.min(minOutPriStep, fs);
            if (clampMaxSource) {
              maxSourceCenter = Math.min(
                maxSourceCenter,
                sx - 24 - relSelfX + ownPlaced.block.width / 2,
              );
            }
          }
        }
      }
    }

    const meanX = wSum > 0 ? wx / wSum : midX;
    const cx = clampMaxSource
      ? minTargetCenter <= maxSourceCenter
        ? Math.min(maxSourceCenter, Math.max(meanX, minTargetCenter))
        : Math.max(meanX, minTargetCenter)
      : Math.max(meanX, minTargetCenter);
    const side: 'above' | 'below' =
      sideMode === 'rowFrac'
        ? (wSum > 0 ? wFrac / wSum : 0.5) < 0.42
          ? 'above'
          : 'below'
        : (wSum > 0 ? wy / wSum : midY) < midY - 1e-6
          ? 'above'
          : 'below';
    return {
      meanX,
      minOutPriStep,
      cx,
      maxRight:
        clampMaxSource && Number.isFinite(maxSourceCenter)
          ? maxSourceCenter + (ownPlaced?.block.width ?? 0) / 2
          : Number.POSITIVE_INFINITY,
      side,
    };
  };

  const meta = new Map(auxPlaced.map((p) => [p.block.id, statsFor(p.block.id)]));
  const ordered = [...auxPlaced].sort((a, b) => {
    const ca = meta.get(a.block.id)?.cx ?? midX;
    const cb = meta.get(b.block.id)?.cx ?? midX;
    return ca - cb || compareBlockId(a.block.id, b.block.id);
  });

  const rightAux =
    auxMode === 'right-top' && hasPrimary
      ? ordered.filter((p) => {
          const m = meta.get(p.block.id);
          return m !== undefined && m.minOutPriStep > 1 && m.meanX >= midX;
        })
      : [];
  const rightSet = new Set(rightAux);
  const bandAux = rightAux.length > 0 ? ordered.filter((p) => !rightSet.has(p)) : ordered;

  if (rightAux.length > 0 && hasPrimary) {
    const lastCol = cols?.[cols.length - 1];
    const lastP = lastCol?.length === 1 && lastCol[0] ? priById.get(lastCol[0].id) : undefined;
    if (lastP && rightAux.length === 1 && rightAux[0]) {
      const auxP = rightAux[0];
      const prevLastX = lastP.x;
      const prevLastY = lastP.y;
      const totalStackH = auxP.block.height + ROW_GAP + lastP.block.height;
      const midPriY = (minY + maxY) / 2;
      let stackX = lastP.x;
      for (const p of primaryPlaced) {
        if (p === lastP) continue;
        stackX = Math.max(stackX, p.x + p.block.width + STAGE_GAP);
      }
      auxP.x = stackX;
      lastP.x = stackX;
      auxP.y = midPriY - totalStackH / 2;
      lastP.y = auxP.y + auxP.block.height + ROW_GAP;
      const placedWithRight = [...primaryPlaced, auxP];
      if (!hasBlockClearance(auxP, placedWithRight) || !hasBlockClearance(lastP, placedWithRight)) {
        lastP.x = prevLastX;
        lastP.y = prevLastY;
        auxP.x = maxX + STAGE_GAP;
        auxP.y = midPriY - auxP.block.height / 2;
      }
    } else {
      const totalAuxH =
        rightAux.reduce((s, p) => s + p.block.height, 0) +
        Math.max(0, rightAux.length - 1) * ROW_GAP;
      let curY = (minY + maxY - totalAuxH) / 2;
      const rightX = maxX + STAGE_GAP;
      for (const p of rightAux) {
        p.x = rightX;
        p.y = curY;
        curY += p.block.height + ROW_GAP;
      }
    }
    let curMaxX = maxX;
    for (const p of primaryPlaced) {
      bandMinY = Math.min(bandMinY, p.y);
      bandMaxY = Math.max(bandMaxY, p.y + p.block.height);
      curMaxX = Math.max(curMaxX, p.x + p.block.width);
    }
    for (const p of rightAux) {
      bandMinY = Math.min(bandMinY, p.y);
      bandMaxY = Math.max(bandMaxY, p.y + p.block.height);
      curMaxX = Math.max(curMaxX, p.x + p.block.width);
    }
    rowLimit = Math.max(curMaxX - minX, 1600) + 400;
  }

  if (bandAux.length > 0) {
    const toBandEntries = (items: readonly Placed[]): AuxiliaryBandEntry[] =>
      items.map((p) => {
        const m = meta.get(p.block.id);
        return {
          placed: p,
          cx: m?.cx ?? midX,
          maxRight: m?.maxRight ?? Number.POSITIVE_INFINITY,
        };
      });
    placeAuxiliaryBand(
      toBandEntries(bandAux.filter((p) => meta.get(p.block.id)?.side === 'above')),
      true,
      startRefX,
      bandMinY,
      bandMaxY,
      rowLimit,
      spacing,
    );
    placeAuxiliaryBand(
      toBandEntries(bandAux.filter((p) => meta.get(p.block.id)?.side !== 'above')),
      false,
      startRefX,
      bandMinY,
      bandMaxY,
      rowLimit,
      spacing,
    );
  }

  return ordered;
}

/** Where the top of node `id` is in a zone that is upside down; `rect` is where it is in the zone as built. */
export function flippedY(block: Block, rect: Rect, id: string): number {
  const c = block.reflectConst.get(id);
  if (c !== undefined) return c - rect.y - rect.height;
  return block.head + block.contentHeight - (rect.y - block.head) - rect.height;
}

/** Zones can come out wider than they were searched at, and may then overlap: push them right. */
function keepClear(placed: readonly Placed[]): void {
  const byX = [...placed].sort((a, b) => a.x - b.x);
  byX.forEach((p, i) => {
    for (const q of byX.slice(0, i)) {
      const near =
        p.y < q.y + q.block.height + VERTICAL_CLEARANCE &&
        q.y < p.y + p.block.height + VERTICAL_CLEARANCE;
      if (near) p.x = Math.max(p.x, q.x + q.block.width + HORIZONTAL_CLEARANCE);
    }
  });
}

function applyNodeOrder(
  nodeParent: ReadonlyMap<string, string | undefined>,
  block: Block,
  order: readonly string[],
): void {
  const rankIndex = new Map(order.map((id, i) => [id, i]));
  const groups = new Map<string, Array<[string, Rect]>>();
  for (const entry of block.nodes.entries()) {
    const [id, r] = entry;
    const key = `${nodeParent.get(id) ?? ''}|${Math.round(r.x)}`;
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }
  for (const items of groups.values()) {
    if (items.length < 2) continue;
    const ys = items.map(([, r]) => r.y).sort((a, b) => a - b);
    items.sort((a, b) => (rankIndex.get(a[0]) ?? 0) - (rankIndex.get(b[0]) ?? 0));
    items.forEach(([, r], k) => {
      r.y = ys[k] as number;
    });
  }
}

/** Builds the layout of a diagram from a placement found for its structure. */
export function applyZonePlacement(
  doc: DavDocument,
  placement: ZonePlacement,
  columnLayout: ColumnLayout,
  buildNested?: NestedBlockBuilder,
): Layout {
  const nodeParent = parentMap(doc.nodes);
  const ranksByZone = new Map<string, ReadonlyMap<string, number>>();
  for (const [zoneId, entry] of placement) {
    if (entry.ranks) ranksByZone.set(zoneId, new Map(Object.entries(entry.ranks)));
  }
  const flow = analyzeFlow(doc);
  const { blocks, owners } = buildBlocks(doc, columnLayout, ranksByZone, flow, buildNested);
  const { connected, isolated } = partitionIsolatedBlocks(blocks, flow, owners);
  const placed = connected.map((block): Placed => {
    const entry = placement.get(block.id);
    if (entry?.order) applyNodeOrder(nodeParent, block, entry.order);
    return {
      block,
      x: entry?.x ?? 0,
      y: entry?.y ?? 0,
      flip: entry?.flip ?? 0,
    };
  });
  keepClear(placed);
  return toLayout([...placed, ...placeIsolatedBlocks(isolated, placed)]);
}

export function toLayout(placed: readonly Placed[]): Layout {
  if (placed.length === 0) return { nodes: rectRecord(), groups: rectRecord() };
  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  const nodes = rectRecord();
  const groups = rectRecord();
  for (const p of placed) {
    const left = Math.round(p.x - minX + ORIGIN.x);
    const top = Math.round(p.y - minY + ORIGIN.y);
    const { block } = p;
    for (const [id, r] of block.nodes) {
      nodes[id] = { ...r, x: left + r.x, y: top + (p.flip ? flippedY(block, r, id) : r.y) };
    }
    for (const [id, r] of p.flip ? block.groupsFlipped : block.groups) {
      groups[id] = { ...r, x: left + r.x, y: top + r.y };
    }
  }
  return { nodes, groups };
}
