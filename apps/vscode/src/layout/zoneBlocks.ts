import { synthesizedConnections } from '../model/connections';
import type { DavConnection, DavDocument } from '../model/types';
import { parentMap, topLevelGroups, zoneOfGroups, zoneOfNodes } from '../model/zones';
import { analyzeFlow, canReach, type FlowAnalysis, flowPairKey } from './flow';
import { linksOf, segmentsOf } from './links';
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
  STATION_CENTER,
  selfLoopRoom,
} from './metrics';

/** With fewer top-level zones than this there is nothing to rearrange. */
const MIN_ZONES = 2;
export const LONG_LINK = 700;
export const HORIZONTAL_CLEARANCE = 60;
export const VERTICAL_CLEARANCE = 34;
const COLUMN_GAP = 150;
const STAGE_GAP = 80;
const ROW_GAP = 44;

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
    /** The nodes of the zone from top to bottom, where the search changed their order. */
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
  flippable: boolean;
  nodes: Map<string, Rect>;
  /** The zone's own frame first, then the groups nested in it. */
  groups: Map<string, Rect>;
  /** Group rectangles when `flip === 1`. */
  groupsFlipped: Map<string, Rect>;
  /** Per-node reflection constant `c` such that `flippedY = c - rect.y - rect.height`. */
  reflectConst: ReadonlyMap<string, number>;
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

/** Everything the placement of the zones depends on, so other edits can reuse the last one. */
export function structureKey(doc: DavDocument): string {
  const connections = synthesizedConnections(doc);
  const flow = analyzeFlow(doc, connections);
  const dirByPair = new Map(connections.map((c) => [pairKey(c.from, c.to), c.direction]));
  const selfLoops = [
    ...new Set(connections.filter((c) => c.from === c.to).map((c) => c.from)),
  ].sort();
  return JSON.stringify([
    doc.nodes.map((n) => [n.id, n.parentId ?? '']),
    doc.groups.map((g) => [g.id, g.parentId ?? '']),
    flow.connections.map((c) => [
      c.from,
      c.to,
      c.role,
      c.role === 'static' ? (dirByPair.get(pairKey(c.from, c.to)) ?? 'forward') : '',
    ]),
    selfLoops,
  ]);
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

/** The block each node moves with: its top-level zone, or the node itself outside any zone. */
export function ownersOf(doc: DavDocument): Map<string, string> {
  const zoneOf = zoneOfGroups(doc.groups);
  const nodeZone = zoneOfNodes(doc);
  return new Map(
    doc.nodes.map((n) => {
      const z = nodeZone.get(n.id);
      return [n.id, z !== undefined && zoneOf.has(z) ? z : n.id];
    }),
  );
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
function computeFlipMetadata(
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
): Block {
  const pad = GROUP_PADDING;
  const nodes = doc.nodes.filter((n) => owners.get(n.id) === zoneId).map((n) => detach(n, zoneId));
  const nested = doc.groups
    .filter((g) => g.id !== zoneId && zoneOf.get(g.id) === zoneId)
    .map((g) => detach(g, zoneId));
  const ids = new Set(nodes.map((n) => n.id));
  const connections = synthesizedConnections(doc).filter((e) => ids.has(e.from) && ids.has(e.to));
  const loopSteps = doc.steps.map((s) => ({
    ...s,
    animations: s.animations.filter((a) => ids.has(a.from) && ids.has(a.to)),
    statics: s.statics.filter((st) => ids.has(st.from) && ids.has(st.to)),
  }));
  const loopRoom = Math.max(0, ...selfLoopRoom({ steps: loopSteps }).values());
  const head = GROUP_HEADER + pad + loopRoom;
  const frame = (width: number, height: number): [string, Rect] => [
    zoneId,
    { x: 0, y: 0, width, height },
  ];

  // A zone with groups inside is laid out like any other, even without nodes: the column
  // layout gives empty groups their rectangles.
  if (nodes.length === 0 && nested.length === 0) {
    const width = EMPTY_GROUP_CONTENT.width + pad * 2;
    const height = head + EMPTY_GROUP_CONTENT.height + pad;
    const groupsMap = new Map([frame(width, height)]);
    return {
      id: zoneId,
      width,
      height,
      head,
      contentHeight: EMPTY_GROUP_CONTENT.height,
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
  const width = bounds.width + pad * 2;
  const contentHeight = bounds.height;
  const height = head + contentHeight + pad;
  const place = (r: Rect): Rect => ({ ...r, x: r.x - bounds.x + pad, y: r.y - bounds.y + head });
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
): { blocks: Block[]; owners: Map<string, string> } {
  const zoneOf = zoneOfGroups(doc.groups);
  const owners = ownersOf(doc);

  const blocks: Block[] = [];
  for (const zone of topLevelGroups(doc.groups)) {
    blocks.push(
      buildSingleZoneBlock(
        doc,
        zone.id,
        columnLayout,
        ranksByZone?.get(zone.id),
        zoneOf,
        owners,
        docFlow,
      ),
    );
  }
  for (const n of doc.nodes) {
    if (owners.get(n.id) !== n.id) continue;
    const { width, height } = NODE_SIZE;
    blocks.push({
      id: n.id,
      width,
      height,
      head: 0,
      contentHeight: height,
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
 * Places `deg === 0` isolated blocks deterministically in alphabetical `id` order in a row below
 * `connectedPlaced`'s final `maxY + ROW_GAP` (starting at `minX` so connected coordinates stay exact).
 */
export function placeIsolatedBlocks(
  isolated: readonly Block[],
  connectedPlaced: readonly Placed[],
): Placed[] {
  if (isolated.length === 0) return [];
  const sorted = [...isolated].sort((a, b) => compareBlockId(a.id, b.id));
  let startX = 0;
  let y = 0;
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
    y = maxY + ROW_GAP;
    rowLimit = Math.max(1800, maxX - minX);
  }
  const out: Placed[] = [];
  let x = startX;
  let rowH = 0;
  let countInRow = 0;
  for (const block of sorted) {
    if (countInRow > 0 && x - startX + block.width > rowLimit) {
      y += rowH + ROW_GAP;
      x = startX;
      rowH = 0;
      countInRow = 0;
    }
    out.push({ block, x, y, flip: 0 });
    x += block.width + HORIZONTAL_CLEARANCE;
    rowH = Math.max(rowH, block.height);
    countInRow++;
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
    primary.filter((b) => (flow.zoneStage.get(b.id) ?? 0) === stage),
  );
  return { primary, auxiliary, columns };
}

/**
 * Whether the staged left-to-right flow fits without strip wrapping (true for real multi-layer
 * architectures, false for static-only graphs or ultra-wide 6+ zone strips that wrap across rows).
 */
export function shouldPreserveFlow(blocks: readonly Block[], flow: FlowAnalysis): boolean {
  if (!flow.hasAnimate) return false;
  const { connected } = partitionIsolatedBlocks(blocks, flow);
  if (connected.length === 0) return false;
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
  return maxWidthOfCols / Math.max(1, stagedHeight) <= 10;
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
  _columnLayout: ColumnLayout,
  flow: FlowAnalysis = analyzeFlow(doc),
): Map<string, { x: number; y: number }> {
  const { connected, isolated } = partitionIsolatedBlocks(blocks, flow, owners);
  const out = new Map<string, { x: number; y: number }>();
  if (connected.length === 0) {
    for (const p of placeIsolatedBlocks(isolated, [])) out.set(p.block.id, { x: p.x, y: p.y });
    return out;
  }

  const blockById = new Map(connected.map((b) => [b.id, b]));
  const { auxiliary, columns } = stageColumns(connected, flow);

  // Check if primary columns form an ultra-wide synthetic strip; wrap rows only when needed.
  const maxWidthOfCols = columns.reduce(
    (sum, col) => sum + Math.max(...col.map((b) => b.width)),
    Math.max(0, columns.length - 1) * COLUMN_GAP,
  );
  if (!shouldPreserveFlow(connected, flow)) {
    // Wrap long chains cleanly left-to-right across 2..3 horizontal bands.
    const rowWidthTarget = Math.max(1600, maxWidthOfCols / Math.ceil(columns.length / 4));
    const rows: Block[][][] = [[]];
    let curW = 0;
    for (const col of columns) {
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
    let rowY = 0;
    for (const rowCols of rows) {
      const colHeights = rowCols.map(
        (col) => col.reduce((s, b) => s + b.height, 0) + Math.max(0, col.length - 1) * ROW_GAP,
      );
      const rowH = Math.max(0, ...colHeights);
      let x = 0;
      rowCols.forEach((col, ci) => {
        let y = rowY + (rowH - (colHeights[ci] ?? 0)) / 2;
        for (const b of col) {
          out.set(b.id, { x, y });
          y += b.height + ROW_GAP;
        }
        x += Math.max(...col.map((b) => b.width)) + COLUMN_GAP;
      });
      rowY += rowH + VERTICAL_CLEARANCE + 24;
    }
    placeAuxiliaryBlocks(auxiliary, blockById, owners, flow, out);
  } else {
    // Build neighbor lookup to order stacked zones within a stage near their connected neighbors.
    const predOwners = new Map<string, string[]>();
    for (const c of flow.connections) {
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
        return meanY(a.id) - meanY(b.id) || blocks.indexOf(a) - blocks.indexOf(b);
      });
      let y = (tallest - heightOf(column)) / 2;
      for (const b of column) {
        out.set(b.id, { x, y });
        y += b.height + ROW_GAP;
      }
      x += Math.max(...column.map((b) => b.width)) + STAGE_GAP;
    }

    placeAuxiliaryBlocks(auxiliary, blockById, owners, flow, out);
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

function placeAuxiliaryBlocks(
  auxiliary: readonly Block[],
  blockById: ReadonlyMap<string, Block>,
  owners: ReadonlyMap<string, string>,
  flow: FlowAnalysis,
  out: Map<string, { x: number; y: number }>,
): void {
  if (auxiliary.length === 0) return;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const [id, pos] of out) {
    const b = blockById.get(id);
    if (!b) continue;
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + b.width);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y + b.height);
  }
  const hasPrimary = Number.isFinite(minX);
  const midX = hasPrimary ? (minX + maxX) / 2 : 0;
  const midY = hasPrimary ? (minY + maxY) / 2 : 0;
  const bandMinY = hasPrimary ? minY : 0;
  const bandMaxY = hasPrimary ? maxY : 0;
  const bandMaxX = hasPrimary ? maxX : 1600;

  const statsFor = (id: string) => {
    let wx = 0;
    let wy = 0;
    let wSum = 0;
    let minTargetCenter = Number.NEGATIVE_INFINITY;
    const block = blockById.get(id);

    for (const c of flow.connections) {
      const bu = owners.get(c.from) ?? c.from;
      const bv = owners.get(c.to) ?? c.to;
      if (bu === bv || (bu !== id && bv !== id)) continue;
      const otherBlockId = bu === id ? bv : bu;
      const otherNodeId = bu === id ? c.to : c.from;
      const selfNodeId = bu === id ? c.from : c.to;
      if (flow.auxiliaryZones.has(otherBlockId)) continue;
      const op = out.get(otherBlockId);
      const ob = blockById.get(otherBlockId);
      if (!op || !ob) continue;
      const nr = ob.nodes.get(otherNodeId);
      const sx = op.x + (nr ? nr.x + nr.width / 2 : ob.width / 2);
      const sy = op.y + (nr ? nr.y + STATION_CENTER : ob.height / 2);
      const fs = flow.pairFirstStep?.get(flowPairKey(c.from, c.to)) ?? 0;
      const baseW = c.role === 'primary' ? 3 : c.role === 'return' ? 1 : 0.5;
      const w = baseW / (1 + 0.08 * fs);
      wx += sx * w;
      wy += sy * w;
      wSum += w;

      if (c.role === 'primary' && bv === id && block) {
        const tn = block.nodes.get(selfNodeId);
        if (tn) {
          const relTargetX = tn.x + tn.width / 2;
          minTargetCenter = Math.max(minTargetCenter, sx + 24 - relTargetX + block.width / 2);
        }
      }
    }

    const meanX = wSum > 0 ? wx / wSum : midX;
    const meanY = wSum > 0 ? wy / wSum : midY;
    return {
      cx: Math.max(meanX, minTargetCenter),
      side: meanY < midY - 1e-6 ? ('above' as const) : ('below' as const),
    };
  };

  const meta = new Map(auxiliary.map((b) => [b.id, statsFor(b.id)]));
  const ordered = [...auxiliary].sort((a, b) => {
    const ca = meta.get(a.id)?.cx ?? midX;
    const cb = meta.get(b.id)?.cx ?? midX;
    return ca - cb || compareBlockId(a.id, b.id);
  });

  const aboveBlocks = ordered.filter((b) => meta.get(b.id)?.side === 'above');
  const belowBlocks = ordered.filter((b) => meta.get(b.id)?.side !== 'above');

  const placeBand = (band: readonly Block[], isAbove: boolean) => {
    const rowLimit = Math.max(bandMaxX, 1600) + 400;
    const rows: Array<{ items: Array<{ block: Block; x: number }>; height: number }> = [];
    let end = Number.NEGATIVE_INFINITY;
    for (const b of band) {
      const cx = meta.get(b.id)?.cx ?? midX;
      const rawX = cx - b.width / 2;
      const cur = rows[rows.length - 1];
      if (
        !cur ||
        (cur.items.length > 0 && Math.max(rawX, end + HORIZONTAL_CLEARANCE) + b.width > rowLimit)
      ) {
        const px = rawX;
        rows.push({ items: [{ block: b, x: px }], height: b.height });
        end = px + b.width;
      } else {
        const px = Math.max(rawX, end + HORIZONTAL_CLEARANCE);
        cur.items.push({ block: b, x: px });
        cur.height = Math.max(cur.height, b.height);
        end = px + b.width;
      }
    }
    let edgeY = isAbove ? bandMinY - VERTICAL_CLEARANCE - 24 : bandMaxY + VERTICAL_CLEARANCE + 24;
    for (const row of rows) {
      for (const { block, x } of row.items) {
        const py = isAbove ? edgeY - block.height : edgeY;
        out.set(block.id, { x, y: py });
      }
      edgeY = isAbove ? edgeY - row.height - ROW_GAP : edgeY + row.height + ROW_GAP;
    }
  };

  placeBand(aboveBlocks, true);
  placeBand(belowBlocks, false);
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
): Layout {
  const nodeParent = parentMap(doc.nodes);
  const ranksByZone = new Map<string, ReadonlyMap<string, number>>();
  for (const [zoneId, entry] of placement) {
    if (entry.ranks) ranksByZone.set(zoneId, new Map(Object.entries(entry.ranks)));
  }
  const flow = analyzeFlow(doc);
  const { blocks, owners } = buildBlocks(doc, columnLayout, ranksByZone, flow);
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
