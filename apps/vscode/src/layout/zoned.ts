import type { DavDocument, DavEdge } from '../model/types';
import { idPair, zoneOfGroups } from '../model/zones';
import {
  countCrossings,
  linksOf,
  properlyCross,
  type Segment,
  segmentsOf,
  shareStation,
} from './links';
import {
  EMPTY_GROUP_CONTENT,
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
const LONG_LINK = 700;

export function hasZonesToPlace(doc: Pick<DavDocument, 'groups'>): boolean {
  return doc.groups.filter((g) => g.parentId === undefined).length >= MIN_ZONES;
}

const pairKey = (a: string, b: string) => (a < b ? idPair(a, b) : idPair(b, a));

function roundTrips(doc: DavDocument): Set<string> {
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

type ColumnLayout = (doc: DavDocument) => Layout;

/** A top-level zone, or a node outside any zone, moved as one rigid piece. */
interface Block {
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

/** Makes something directly inside a zone top-level, for laying the zone out on its own. */
function detach<T extends { parentId?: string }>(item: T, zoneId: string): T {
  if (item.parentId !== zoneId) return item;
  const { parentId: _parentId, ...rest } = item;
  return rest as T;
}

function buildBlocks(doc: DavDocument, columnLayout: ColumnLayout) {
  const zoneOf = zoneOfGroups(doc.groups);
  const owners = new Map(
    doc.nodes.map((n) => [
      n.id,
      n.parentId === undefined ? n.id : (zoneOf.get(n.parentId) ?? n.id),
    ]),
  );

  const pad = GROUP_PADDING;
  const blocks: Block[] = [];
  for (const zone of doc.groups) {
    if (zone.parentId !== undefined) continue;
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

    if (nodes.length === 0) {
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
    const rects = [...Object.values(local.nodes), ...Object.values(local.groups)];
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const width = Math.max(...rects.map((r) => r.x + r.width)) - minX + pad * 2;
    const contentHeight = Math.max(...rects.map((r) => r.y + r.height)) - minY;
    const height = head + contentHeight + pad;
    const place = (r: Rect): Rect => ({ ...r, x: r.x - minX + pad, y: r.y - minY + head });
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

const COLUMN_GAP = 150;
const ROW_GAP = 44;

/** Starting point: blocks in the columns of a graph that has one node per block. */
function initialPositions(
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

interface Placed {
  block: Block;
  x: number;
  y: number;
  flip: 0 | 1;
}

/** A link between two blocks; its `Segment` part is refreshed by every cost evaluation. */
interface BlockLink extends Segment {
  source: Placed;
  target: Placed;
  sourceX: number;
  targetX: number;
  sourceY: readonly [number, number];
  targetY: readonly [number, number];
  /** A round trip covers the rail twice in its time, so its length counts double. */
  weight: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const ITERATIONS = 16000;
const SEEDS = [11, 23, 37, 53, 71, 97];
const START_TEMPERATURE = 500;
const END_TEMPERATURE = 1.5;
const HORIZONTAL_CLEARANCE = 60;
const VERTICAL_CLEARANCE = 34;
const ALIGN_REACH = 140;
const ALIGN_TOLERANCE = 30;

function flippedY(block: Block, rect: Rect): number {
  return block.head + block.contentHeight - (rect.y - block.head) - rect.height;
}

/** Small seeded generator: the same diagram must always get the same layout. */
function seededRandom(start: number): () => number {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runsThrough(link: BlockLink, p: Placed): boolean {
  const right = p.x + p.block.width;
  const bottom = p.y + p.block.height;
  if (link.maxX <= p.x || link.minX >= right || link.maxY <= p.y || link.minY >= bottom) {
    return false;
  }
  const dx = link.bx - link.ax;
  const dy = link.by - link.ay;
  for (let i = 1; i < 7; i++) {
    const x = link.ax + (dx * i) / 7;
    const y = link.ay + (dy * i) / 7;
    if (x > p.x && x < right && y > p.y && y < bottom) return true;
  }
  return false;
}

function updateSegment(l: BlockLink): void {
  l.ax = l.source.x + l.sourceX;
  l.ay = l.source.y + l.sourceY[l.source.flip];
  l.bx = l.target.x + l.targetX;
  l.by = l.target.y + l.targetY[l.target.flip];
  l.minX = Math.min(l.ax, l.bx);
  l.maxX = Math.max(l.ax, l.bx);
  l.minY = Math.min(l.ay, l.by);
  l.maxY = Math.max(l.ay, l.by);
}

function shapeCost(l: BlockLink): number {
  const dx = l.bx - l.ax;
  const length = Math.hypot(dx, l.by - l.ay);
  return (
    length * 0.06 + Math.max(0, length * l.weight - LONG_LINK) + (dx < -60 ? 260 - dx * 0.3 : 0)
  );
}

function crossingCost(s: BlockLink, t: BlockLink): number {
  if (s.maxX < t.minX || t.maxX < s.minX || s.maxY < t.minY || t.maxY < s.minY) return 0;
  return !shareStation(s, t) && properlyCross(s, t) ? 250 : 0;
}

function throughCost(l: BlockLink, placed: readonly Placed[]): number {
  let total = 0;
  for (const p of placed) {
    if (p !== l.source && p !== l.target && runsThrough(l, p)) total += 130;
  }
  return total;
}

/** The cost of the whole arrangement. */
function linkCost(links: readonly BlockLink[], placed: readonly Placed[]): number {
  let total = spreadCost(placed);
  for (let i = 0; i < links.length; i++) {
    const s = links[i] as BlockLink;
    updateSegment(s);
    total += shapeCost(s) + throughCost(s, placed);
    for (let j = 0; j < i; j++) total += crossingCost(s, links[j] as BlockLink);
  }
  return total;
}

const touches = (l: BlockLink, a: Placed, b: Placed | undefined) =>
  l.source === a || l.target === a || l.source === b || l.target === b;

/**
 * The part of the cost that moving `a` (and `b`) can change. The search compares this before
 * and after a move, which costs far less than evaluating the whole arrangement for every move.
 */
function movedCost(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  a: Placed,
  b: Placed | undefined,
): number {
  let total = spreadCost(placed);
  for (let i = 0; i < links.length; i++) {
    const s = links[i] as BlockLink;
    if (!touches(s, a, b)) {
      if (runsThrough(s, a)) total += 130;
      if (b && runsThrough(s, b)) total += 130;
      continue;
    }
    updateSegment(s);
  }
  for (let i = 0; i < links.length; i++) {
    const s = links[i] as BlockLink;
    if (!touches(s, a, b)) continue;
    total += shapeCost(s) + throughCost(s, placed);
    for (let j = 0; j < links.length; j++) {
      const t = links[j] as BlockLink;
      if (j !== i && (j > i || !touches(t, a, b))) total += crossingCost(s, t);
    }
  }
  return total;
}

/** How much a clear move would change the cost. Leaves the move applied. */
function costChange(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  a: Placed,
  b: Placed | undefined,
  setMoved: (moved: boolean) => void,
): number {
  const before = movedCost(links, placed, a, b);
  setMoved(true);
  return movedCost(links, placed, a, b) - before;
}

function takeBack(
  links: readonly BlockLink[],
  a: Placed,
  b: Placed | undefined,
  setMoved: (moved: boolean) => void,
): void {
  setMoved(false);
  for (const l of links) if (touches(l, a, b)) updateSegment(l);
}

function spreadCost(placed: readonly Placed[]): number {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const p of placed) {
    left = Math.min(left, p.x);
    right = Math.max(right, p.x + p.block.width);
    top = Math.min(top, p.y);
    bottom = Math.max(bottom, p.y + p.block.height);
  }
  return (right - left + (bottom - top) * 1.4) * 0.6;
}

function isClear(a: Placed, placed: readonly Placed[]): boolean {
  for (const b of placed) {
    if (b === a) continue;
    if (
      a.x < b.x + b.block.width + HORIZONTAL_CLEARANCE &&
      b.x < a.x + a.block.width + HORIZONTAL_CLEARANCE &&
      a.y < b.y + b.block.height + VERTICAL_CLEARANCE &&
      b.y < a.y + a.block.height + VERTICAL_CLEARANCE
    ) {
      return false;
    }
  }
  return true;
}

function anneal(links: readonly BlockLink[], placed: Placed[], random: () => number): void {
  let current = linkCost(links, placed);
  let best = current;
  let bestState = placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
  let temperature = START_TEMPERATURE;
  const ratio = (END_TEMPERATURE / START_TEMPERATURE) ** (1 / ITERATIONS);
  for (let it = 0; it < ITERATIONS; it++) {
    temperature *= ratio;
    const a = placed[Math.floor(random() * placed.length)] as Placed;
    const { x: ox, y: oy, flip: oflip } = a;
    let other: Placed | undefined;
    let otherX = 0;
    let otherY = 0;
    const roll = random();
    if (roll < 0.08 && a.block.flippable) {
      a.flip = a.flip === 0 ? 1 : 0;
    } else if (roll < 0.2) {
      other = placed[Math.floor(random() * placed.length)] as Placed;
      if (other === a) continue;
      otherX = other.x;
      otherY = other.y;
      a.x = otherX;
      a.y = otherY;
      other.x = ox;
      other.y = oy;
    } else {
      const span = 80 + 1500 * (temperature / START_TEMPERATURE);
      a.x += (random() - 0.5) * 2 * span;
      a.y += (random() - 0.5) * 2 * span;
    }
    const { x: nx, y: ny, flip: nflip } = a;
    const setMoved = (moved: boolean) => {
      a.x = moved ? nx : ox;
      a.y = moved ? ny : oy;
      a.flip = moved ? nflip : oflip;
      if (other) {
        other.x = moved ? ox : otherX;
        other.y = moved ? oy : otherY;
      }
    };
    const clear = isClear(a, placed) && (!other || isClear(other, placed));
    setMoved(false);
    if (!clear) continue;
    const change = costChange(links, placed, a, other, setMoved);
    if (change <= 0 || random() < Math.exp(-change / temperature)) {
      current += change;
      if (current < best) {
        best = current;
        bestState = placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
      }
    } else {
      takeBack(links, a, other, setMoved);
    }
  }
  placed.forEach((p, i) => {
    Object.assign(p, bestState[i]);
  });
}

function alignmentCandidates(a: Placed, b: Placed): Array<{ x: number; y: number }> {
  return [
    { x: a.x, y: b.y },
    { x: a.x, y: b.y + b.block.height - a.block.height },
    { x: a.x, y: b.y + (b.block.height - a.block.height) / 2 },
    { x: b.x, y: a.y },
  ];
}

/** Lines up zone edges where that barely costs anything, so that the result reads as tidy. */
function alignEdges(links: readonly BlockLink[], placed: readonly Placed[]): void {
  let current = linkCost(links, placed);
  let base = current;
  const tryAlign = (a: Placed, to: { x: number; y: number }) => {
    const { x: ox, y: oy } = a;
    const moved = to.x !== ox || to.y !== oy;
    if (!moved || Math.abs(to.x - ox) > ALIGN_REACH || Math.abs(to.y - oy) > ALIGN_REACH) return;
    const setMoved = (on: boolean) => {
      a.x = on ? to.x : ox;
      a.y = on ? to.y : oy;
    };
    setMoved(true);
    const clear = isClear(a, placed);
    setMoved(false);
    if (!clear) return;
    const change = costChange(links, placed, a, undefined, setMoved);
    if (current + change <= base + ALIGN_TOLERANCE) {
      current += change;
      base = Math.min(base, current);
    } else {
      takeBack(links, a, undefined, setMoved);
    }
  };
  for (let round = 0; round < 3; round++) {
    for (const a of placed) {
      for (const b of placed) {
        if (a === b) continue;
        for (const to of alignmentCandidates(a, b)) tryAlign(a, to);
      }
    }
  }
}

/** Where the search put each zone. It holds no sizes, so it can be applied to resized zones. */
export type ZonePlacement = ReadonlyMap<string, { x: number; y: number; flip: 0 | 1 }>;

function snapshot(placed: readonly Placed[]): ZonePlacement {
  return new Map(placed.map((p) => [p.block.id, { x: p.x, y: p.y, flip: p.flip }]));
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

function toLayout(placed: readonly Placed[]): Layout {
  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  const nodes = rectRecord();
  const groups = rectRecord();
  for (const p of placed) {
    const left = Math.round(p.x - minX + ORIGIN.x);
    const top = Math.round(p.y - minY + ORIGIN.x);
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

/**
 * Finds where to put each zone, which has been arranged on its own, by simulated annealing.
 * Shared columns are given up for shorter links between zones. Seeded, so the same diagram
 * always gets the same placement.
 */
export function searchZonePlacement(doc: DavDocument, columnLayout: ColumnLayout): ZonePlacement {
  const { blocks, owners } = buildBlocks(doc, columnLayout);
  const start = initialPositions(doc, blocks, owners, columnLayout);
  const trips = roundTrips(doc);
  const placed: Placed[] = blocks.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
  const placedOf = new Map(placed.map((p) => [p.block.id, p]));
  const anchor = (id: string) => {
    const p = placedOf.get(owners.get(id) as string) as Placed;
    const r = p.block.nodes.get(id) as Rect;
    return {
      p,
      x: r.x + r.width / 2,
      y: [r.y + STATION_CENTER, flippedY(p.block, r) + STATION_CENTER] as const,
    };
  };
  const links: BlockLink[] = doc.edges
    .filter((e) => owners.get(e.from) !== owners.get(e.to))
    .filter((e) => owners.has(e.from) && owners.has(e.to))
    .map((e) => {
      const a = anchor(e.from);
      const b = anchor(e.to);
      return {
        source: a.p,
        target: b.p,
        sourceX: a.x,
        targetX: b.x,
        sourceY: a.y,
        targetY: b.y,
        from: e.from,
        to: e.to,
        weight: trips.has(pairKey(e.from, e.to)) ? 2 : 1,
        ax: 0,
        ay: 0,
        bx: 0,
        by: 0,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    });

  let bestScore = Number.POSITIVE_INFINITY;
  let bestPlacement: ZonePlacement = new Map();
  for (const seed of SEEDS) {
    for (const p of placed) {
      const at = start.get(p.block.id) ?? { x: 0, y: 0 };
      p.x = at.x;
      p.y = at.y;
      p.flip = 0;
    }
    anneal(links, placed, seededRandom(seed * 104729));
    alignEdges(links, placed);
    const score = linkCost(links, placed) + countCrossings(doc, toLayout(placed)) * 150;
    if (score < bestScore) {
      bestScore = score;
      bestPlacement = snapshot(placed);
    }
  }
  return bestPlacement;
}
