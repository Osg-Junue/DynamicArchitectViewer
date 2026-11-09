import type { DavDocument, DavEdge, DavNode } from '../model/types';
import type { Layout, Rect } from './index';

/** With fewer top-level zones than this there is nothing to rearrange. */
const MIN_ZONES = 2;

export function hasZonesToPlace(doc: Pick<DavDocument, 'groups'>): boolean {
  return doc.groups.filter((g) => g.parentId === undefined).length >= MIN_ZONES;
}

/** How much the links exceed a comfortable length; a round trip's length counts double. */
export function longLinkExcess(doc: DavDocument, layout: Layout, stationCenter: number): number {
  const trips = roundTrips(doc);
  let excess = 0;
  for (const e of doc.edges) {
    const a = layout.nodes[e.from];
    const b = layout.nodes[e.to];
    if (!a || !b || e.from === e.to) continue;
    const dx = a.x + a.width / 2 - (b.x + b.width / 2);
    const dy = a.y + stationCenter - (b.y + stationCenter);
    const weight = trips.has(pairKey(e.from, e.to)) ? 2 : 1;
    excess += Math.max(0, Math.hypot(dx, dy) * weight - LONG_LINK);
  }
  return excess;
}

export interface ZonedMetrics {
  node: { width: number; height: number };
  stationCenter: number;
  groupPadding: number;
  groupHeader: number;
  selfLoopRoom: number;
  selfLoopExtraRoom: number;
  emptyGroup: { width: number; height: number };
}

type ColumnLayout = (doc: DavDocument) => Layout;
type CountCrossings = (doc: DavDocument, layout: Layout) => number;

const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/** Everything the zoned layout depends on, so unrelated edits can reuse the last result. */
export function structureKey(doc: DavDocument): string {
  return JSON.stringify([
    doc.nodes.map((n) => [n.id, n.parentId ?? '', n.icon]),
    doc.groups.map((g) => [g.id, g.parentId ?? '']),
    doc.edges.map((e) => [e.from, e.to, e.label ?? '']),
    [...roundTrips(doc)].sort(),
  ]);
}

function roundTrips(doc: DavDocument): Set<string> {
  const pairs = new Set<string>();
  for (const step of doc.steps) {
    for (const a of step.animations) {
      if (a.direction === 'bidirectional') pairs.add(pairKey(a.from, a.to));
    }
  }
  return pairs;
}

/** A top-level zone, or a node outside any zone, moved as one rigid piece. */
interface Block {
  id: string;
  width: number;
  height: number;
  head: number;
  contentHeight: number;
  flippable: boolean;
  nodes: Map<string, Rect>;
  groups: Map<string, Rect>;
}

function buildBlocks(doc: DavDocument, columnLayout: ColumnLayout, m: ZonedMetrics) {
  const zoneOf = new Map<string, string>();
  for (const g of doc.groups) {
    zoneOf.set(g.id, g.parentId === undefined ? g.id : (zoneOf.get(g.parentId) ?? g.id));
  }
  const ownerOf = (n: DavNode) =>
    n.parentId === undefined ? n.id : (zoneOf.get(n.parentId) ?? n.id);
  const owners = new Map(doc.nodes.map((n) => [n.id, ownerOf(n)]));

  const blocks: Block[] = [];
  for (const zone of doc.groups) {
    if (zone.parentId !== undefined) continue;
    const pad = m.groupPadding;
    const nodes = doc.nodes
      .filter((n) => owners.get(n.id) === zone.id)
      .map(({ parentId, ...rest }) =>
        parentId === zone.id ? rest : { ...rest, ...(parentId ? { parentId } : {}) },
      );
    const nested = doc.groups
      .filter((g) => g.id !== zone.id && zoneOf.get(g.id) === zone.id)
      .map(({ parentId, ...rest }) =>
        parentId === zone.id ? rest : { ...rest, ...(parentId ? { parentId } : {}) },
      );
    const ids = new Set(nodes.map((n) => n.id));
    const edges = doc.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
    const loops = new Map<string, number>();
    for (const e of edges) {
      if (e.from === e.to) loops.set(e.from, (loops.get(e.from) ?? 0) + 1);
    }
    const mostLoops = Math.max(0, ...loops.values());
    const head =
      m.groupHeader +
      pad +
      (mostLoops > 0 ? m.selfLoopRoom + (mostLoops - 1) * m.selfLoopExtraRoom : 0);

    if (nodes.length === 0) {
      blocks.push({
        id: zone.id,
        width: m.emptyGroup.width + pad * 2,
        height: head + m.emptyGroup.height + pad,
        head,
        contentHeight: m.emptyGroup.height,
        flippable: false,
        nodes: new Map(),
        groups: new Map(),
      });
      continue;
    }

    const local = columnLayout({ ...doc, nodes, groups: nested, edges, steps: [] });
    const rects = [...Object.values(local.nodes), ...Object.values(local.groups)];
    const minX = Math.min(...rects.map((r) => r.x));
    const minY = Math.min(...rects.map((r) => r.y));
    const contentWidth = Math.max(...rects.map((r) => r.x + r.width)) - minX;
    const contentHeight = Math.max(...rects.map((r) => r.y + r.height)) - minY;
    const place = (r: Rect): Rect => ({ ...r, x: r.x - minX + pad, y: r.y - minY + head });
    blocks.push({
      id: zone.id,
      width: contentWidth + pad * 2,
      height: head + contentHeight + pad,
      head,
      contentHeight,
      flippable: mostLoops === 0 && nested.length === 0,
      nodes: new Map(Object.entries(local.nodes).map(([id, r]) => [id, place(r)])),
      groups: new Map(Object.entries(local.groups).map(([id, r]) => [id, place(r)])),
    });
  }
  for (const n of doc.nodes) {
    if (owners.get(n.id) !== n.id) continue;
    const { width, height } = m.node;
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

interface Link {
  a: Placed;
  b: Placed;
  ax: number;
  bx: number;
  ay: readonly [number, number];
  by: readonly [number, number];
  from: string;
  to: string;
  /** A round trip covers the rail twice in its time, so its length counts double. */
  weight: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const ITERATIONS = 16000;
const SEEDS = [11, 23, 37, 53, 71, 97];
const START_TEMPERATURE = 500;
const END_TEMPERATURE = 1.5;
const HORIZONTAL_CLEARANCE = 60;
const VERTICAL_CLEARANCE = 34;
const LONG_LINK = 700;
const ALIGN_REACH = 140;
const ALIGN_TOLERANCE = 30;

function flippedY(block: Block, rect: Rect): number {
  return block.head + block.contentHeight - (rect.y - block.head) - rect.height;
}

function side(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
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

function linkCost(links: readonly Link[], placed: readonly Placed[]): number {
  let total = 0;
  for (const l of links) {
    l.x1 = l.a.x + l.ax;
    l.y1 = l.a.y + l.ay[l.a.flip];
    l.x2 = l.b.x + l.bx;
    l.y2 = l.b.y + l.by[l.b.flip];
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    const length = Math.hypot(dx, dy);
    total += length * 0.06 + Math.max(0, length * l.weight - LONG_LINK);
    if (dx < -60) total += 260 - dx * 0.3;
    for (const p of placed) {
      if (p === l.a || p === l.b) continue;
      for (let i = 1; i < 7; i++) {
        const x = l.x1 + (dx * i) / 7;
        const y = l.y1 + (dy * i) / 7;
        if (x > p.x && x < p.x + p.block.width && y > p.y && y < p.y + p.block.height) {
          total += 130;
          break;
        }
      }
    }
  }
  for (let i = 0; i < links.length; i++) {
    const s = links[i] as Link;
    for (let j = i + 1; j < links.length; j++) {
      const t = links[j] as Link;
      if (s.from === t.from || s.from === t.to || s.to === t.from || s.to === t.to) continue;
      if (
        side(s.x1, s.y1, s.x2, s.y2, t.x1, t.y1) * side(s.x1, s.y1, s.x2, s.y2, t.x2, t.y2) < 0 &&
        side(t.x1, t.y1, t.x2, t.y2, s.x1, s.y1) * side(t.x1, t.y1, t.x2, t.y2, s.x2, s.y2) < 0
      ) {
        total += 250;
      }
    }
  }
  const right = Math.max(...placed.map((p) => p.x + p.block.width));
  const left = Math.min(...placed.map((p) => p.x));
  const bottom = Math.max(...placed.map((p) => p.y + p.block.height));
  const top = Math.min(...placed.map((p) => p.y));
  return total + (right - left + (bottom - top) * 1.4) * 0.6;
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

function anneal(links: readonly Link[], placed: Placed[], random: () => number): void {
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
    const restore = () => {
      a.x = ox;
      a.y = oy;
      a.flip = oflip;
      if (other) {
        other.x = otherX;
        other.y = otherY;
      }
    };
    if (!isClear(a, placed) || (other && !isClear(other, placed))) {
      restore();
      continue;
    }
    const next = linkCost(links, placed);
    if (next <= current || random() < Math.exp((current - next) / temperature)) {
      current = next;
      if (next < best) {
        best = next;
        bestState = placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
      }
    } else {
      restore();
    }
  }
  placed.forEach((p, i) => {
    Object.assign(p, bestState[i]);
  });
}

/** Lines up zone edges where that barely costs anything, so that the result reads as tidy. */
function alignEdges(links: readonly Link[], placed: readonly Placed[]): void {
  let base = linkCost(links, placed);
  for (let round = 0; round < 3; round++) {
    for (const a of placed) {
      for (const b of placed) {
        if (a === b) continue;
        const candidates = [
          { x: a.x, y: b.y },
          { x: a.x, y: b.y + b.block.height - a.block.height },
          { x: a.x, y: b.y + (b.block.height - a.block.height) / 2 },
          { x: b.x, y: a.y },
        ];
        for (const c of candidates) {
          const { x: ox, y: oy } = a;
          if (
            (c.x === ox && c.y === oy) ||
            Math.abs(c.x - ox) > ALIGN_REACH ||
            Math.abs(c.y - oy) > ALIGN_REACH
          ) {
            continue;
          }
          a.x = c.x;
          a.y = c.y;
          const cost = isClear(a, placed) ? linkCost(links, placed) : Number.POSITIVE_INFINITY;
          if (cost <= base + ALIGN_TOLERANCE) {
            base = Math.min(base, cost);
          } else {
            a.x = ox;
            a.y = oy;
          }
        }
      }
    }
  }
}

function toLayout(placed: readonly Placed[], origin: number): Layout {
  const minX = Math.min(...placed.map((p) => p.x));
  const minY = Math.min(...placed.map((p) => p.y));
  const nodes = Object.create(null) as Record<string, Rect>;
  const groups = Object.create(null) as Record<string, Rect>;
  for (const p of placed) {
    const left = Math.round(p.x - minX + origin);
    const top = Math.round(p.y - minY + origin);
    const { block } = p;
    if (block.nodes.size !== 1 || !block.nodes.has(block.id)) {
      groups[block.id] = { x: left, y: top, width: block.width, height: block.height };
    }
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
 * Lays out a large diagram zone by zone: each zone is arranged on its own, then the zones are
 * placed freely by simulated annealing. Shared columns are given up for shorter links between
 * zones. Seeded, so the same diagram always gets the same layout.
 */
export function computeZonedLayout(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  countCrossings: CountCrossings,
  metrics: ZonedMetrics,
  origin: number,
): Layout {
  const { blocks, owners } = buildBlocks(doc, columnLayout, metrics);
  const start = initialPositions(doc, blocks, owners, columnLayout);
  const trips = roundTrips(doc);
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const relative = (id: string) => {
    const owner = owners.get(id) as string;
    const block = blockById.get(owner) as Block;
    const r = block.nodes.get(id) as Rect;
    return {
      block,
      x: r.x + r.width / 2,
      y: [r.y + metrics.stationCenter, flippedY(block, r) + metrics.stationCenter] as const,
    };
  };

  let bestScore = Number.POSITIVE_INFINITY;
  let bestLayout: Layout = { nodes: {}, groups: {} };
  for (const seed of SEEDS) {
    const placed: Placed[] = blocks.map((block) => {
      const at = start.get(block.id) ?? { x: 0, y: 0 };
      return { block, x: at.x, y: at.y, flip: 0 };
    });
    const placedOf = new Map(placed.map((p) => [p.block, p]));
    const links: Link[] = doc.edges
      .filter((e) => owners.get(e.from) !== owners.get(e.to))
      .filter((e) => owners.has(e.from) && owners.has(e.to))
      .map((e) => {
        const a = relative(e.from);
        const b = relative(e.to);
        return {
          a: placedOf.get(a.block) as Placed,
          b: placedOf.get(b.block) as Placed,
          ax: a.x,
          bx: b.x,
          ay: a.y,
          by: b.y,
          from: e.from,
          to: e.to,
          weight: trips.has(pairKey(e.from, e.to)) ? 2 : 1,
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
        };
      });
    anneal(links, placed, seededRandom(seed * 104729));
    alignEdges(links, placed);
    const layout = toLayout(placed, origin);
    const score = linkCost(links, placed) + countCrossings(doc, layout) * 150;
    if (score < bestScore) {
      bestScore = score;
      bestLayout = layout;
    }
  }
  return bestLayout;
}
