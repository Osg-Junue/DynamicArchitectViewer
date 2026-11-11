import type { DavDocument, DavEdge } from '../model/types';
import { idPair, topLevelGroups, zoneOfGroups, zoneOfNodes } from '../model/zones';
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
  selfLoopRoom,
} from './metrics';

/** With fewer top-level zones than this there is nothing to rearrange. */
const MIN_ZONES = 2;
export const LONG_LINK = 700;
export const HORIZONTAL_CLEARANCE = 60;
export const VERTICAL_CLEARANCE = 34;
const COLUMN_GAP = 150;
const ROW_GAP = 44;

export type ColumnLayout = (doc: DavDocument) => Layout;

/** Where the search put each zone. It holds no sizes, so it can be applied to resized zones. */
export type ZonePlacement = ReadonlyMap<string, { x: number; y: number; flip: 0 | 1 }>;

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

export const pairKey = (a: string, b: string): string => (a < b ? idPair(a, b) : idPair(b, a));

export function roundTrips(doc: DavDocument): Set<string> {
  const pairs = new Set<string>();
  for (const step of doc.steps) {
    for (const a of step.animations) {
      if (a.direction === 'bidirectional') pairs.add(pairKey(a.from, a.to));
    }
  }
  return pairs;
}

/** How much the links exceed a comfortable length; a round trip's length counts double. */
export function longLinkExcess(doc: DavDocument, layout: Layout): number {
  const trips = roundTrips(doc);
  let excess = 0;
  for (const s of segmentsOf(linksOf(doc), layout)) {
    const weight = trips.has(pairKey(s.from, s.to)) ? 2 : 1;
    excess += Math.max(0, Math.hypot(s.ax - s.bx, s.ay - s.by) * weight - LONG_LINK);
  }
  return excess;
}

/** Everything the placement of the zones depends on, so other edits can reuse the last one. */
export function structureKey(doc: DavDocument): string {
  return JSON.stringify([
    doc.nodes.map((n) => [n.id, n.parentId ?? '']),
    doc.groups.map((g) => [g.id, g.parentId ?? '']),
    doc.edges.map((e) => [e.from, e.to]),
    [...roundTrips(doc)].sort(),
  ]);
}

/** The same diagram without what a person is most likely typing at the moment. */
export function withoutLabels(doc: DavDocument): DavDocument {
  return {
    ...doc,
    edges: doc.edges.map(({ label: _label, ...edge }) => edge),
  };
}

/** Makes something directly inside a zone top-level, for laying the zone out on its own. */
function detach<T extends { parentId?: string }>(item: T, zoneId: string): T | Omit<T, 'parentId'> {
  if (item.parentId !== zoneId) return item;
  const { parentId: _parentId, ...rest } = item;
  return rest;
}

export function buildBlocks(
  doc: DavDocument,
  columnLayout: ColumnLayout,
): { blocks: Block[]; owners: Map<string, string> } {
  const zoneOf = zoneOfGroups(doc.groups);
  const nodeZone = zoneOfNodes(doc);
  const owners = new Map(
    doc.nodes.map((n) => {
      const z = nodeZone.get(n.id);
      return [n.id, z !== undefined && zoneOf.has(z) ? z : n.id];
    }),
  );

  const pad = GROUP_PADDING;
  const blocks: Block[] = [];
  for (const zone of topLevelGroups(doc.groups)) {
    const nodes = doc.nodes
      .filter((n) => owners.get(n.id) === zone.id)
      .map((n) => detach(n, zone.id));
    const nested = doc.groups
      .filter((g) => g.id !== zone.id && zoneOf.get(g.id) === zone.id)
      .map((g) => detach(g, zone.id));
    const ids = new Set(nodes.map((n) => n.id));
    const edges = doc.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    const loopRoom = Math.max(0, ...selfLoopRoom({ edges }).values());
    const head = GROUP_HEADER + pad + loopRoom;
    const frame = (width: number, height: number): [string, Rect] => [
      zone.id,
      { x: 0, y: 0, width, height },
    ];

    // A zone with groups inside is laid out like any other, even without nodes: the column
    // layout gives empty groups their rectangles.
    if (nodes.length === 0 && nested.length === 0) {
      const width = EMPTY_GROUP_CONTENT.width + pad * 2;
      const height = head + EMPTY_GROUP_CONTENT.height + pad;
      blocks.push({
        id: zone.id,
        width,
        height,
        head,
        contentHeight: EMPTY_GROUP_CONTENT.height,
        flippable: false,
        nodes: new Map(),
        groups: new Map([frame(width, height)]),
      });
      continue;
    }

    const local = columnLayout({ ...doc, nodes, groups: nested, edges, steps: [] });
    const bounds = enclosingRect([...Object.values(local.nodes), ...Object.values(local.groups)]);
    const width = bounds.width + pad * 2;
    const contentHeight = bounds.height;
    const height = head + contentHeight + pad;
    const place = (r: Rect): Rect => ({ ...r, x: r.x - bounds.x + pad, y: r.y - bounds.y + head });
    blocks.push({
      id: zone.id,
      width,
      height,
      head,
      contentHeight,
      flippable: loopRoom === 0 && nested.length === 0,
      nodes: new Map(Object.entries(local.nodes).map(([id, r]) => [id, place(r)])),
      groups: new Map([
        frame(width, height),
        ...Object.entries(local.groups).map(([id, r]): [string, Rect] => [id, place(r)]),
      ]),
    });
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
    });
  }
  return { blocks, owners };
}

/** Starting point: blocks in the columns of a graph that has one node per block. */
export function initialPositions(
  doc: DavDocument,
  blocks: readonly Block[],
  owners: ReadonlyMap<string, string>,
  columnLayout: ColumnLayout,
): Map<string, { x: number; y: number }> {
  const seen = new Set<string>();
  const edges: DavEdge[] = [];
  for (const e of doc.edges) {
    const from = owners.get(e.from);
    const to = owners.get(e.to);
    if (!from || !to || from === to || seen.has(pairKey(from, to))) continue;
    seen.add(pairKey(from, to));
    edges.push({
      id: `${from}>${to}`,
      explicitId: false,
      from,
      to,
      style: 'solid',
      direction: 'forward',
      visible: true,
    });
  }
  const meta = columnLayout({
    ...doc,
    groups: [],
    edges,
    steps: [],
    nodes: blocks.map((b) => ({ id: b.id, label: '', icon: 'server', visible: true })),
  });
  const xOf = (b: Block) => meta.nodes[b.id]?.x ?? 0;
  const yOf = (b: Block) => meta.nodes[b.id]?.y ?? 0;
  const columns = [...new Set(blocks.map(xOf))]
    .sort((a, b) => a - b)
    .map((x) => blocks.filter((b) => xOf(b) === x).sort((a, b) => yOf(a) - yOf(b)));
  const heightOf = (column: readonly Block[]) =>
    column.reduce((sum, b) => sum + b.height, 0) + (column.length - 1) * ROW_GAP;
  const tallest = Math.max(...columns.map(heightOf));

  const out = new Map<string, { x: number; y: number }>();
  let x = 0;
  for (const column of columns) {
    let y = (tallest - heightOf(column)) / 2;
    for (const b of column) {
      out.set(b.id, { x, y });
      y += b.height + ROW_GAP;
    }
    x += Math.max(...column.map((b) => b.width)) + COLUMN_GAP;
  }
  return out;
}

export function flippedY(block: Block, rect: Rect): number {
  return block.head + block.contentHeight - (rect.y - block.head) - rect.height;
}

/** Zones can come out wider than they were searched at; those to the right step aside. */
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

/** Builds the layout of a diagram from a placement found for its structure. */
export function applyZonePlacement(
  doc: DavDocument,
  placement: ZonePlacement,
  columnLayout: ColumnLayout,
): Layout {
  const placed = buildBlocks(doc, columnLayout).blocks.map(
    (block): Placed => ({ block, ...(placement.get(block.id) ?? { x: 0, y: 0, flip: 0 }) }),
  );
  keepClear(placed);
  return toLayout(placed);
}

export function toLayout(placed: readonly Placed[]): Layout {
  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  const nodes = rectRecord();
  const groups = rectRecord();
  for (const p of placed) {
    const left = Math.round(p.x - minX + ORIGIN.x);
    const top = Math.round(p.y - minY + ORIGIN.y);
    const { block } = p;
    for (const [id, r] of block.nodes) {
      nodes[id] = { ...r, x: left + r.x, y: top + (p.flip ? flippedY(block, r) : r.y) };
    }
    for (const [id, r] of block.groups) {
      groups[id] = { ...r, x: left + r.x, y: top + r.y };
    }
  }
  return { nodes, groups };
}
