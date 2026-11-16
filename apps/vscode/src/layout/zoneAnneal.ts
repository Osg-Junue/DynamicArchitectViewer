import { pushToMap } from '../model/text';
import type { DavDocument } from '../model/types';
import { parentMap } from '../model/zones';
import { countCrossings, crossingsOf, type Link, linksOf, segmentsOf } from './links';
import { type Layout, type Rect, STATION_CENTER } from './metrics';
import {
  buildBlocks,
  type ColumnLayout,
  initialPositions,
  type Placed,
  toLayout,
  type ZonePlacement,
} from './zoneBlocks';
import {
  type BlockLink,
  buildLinks,
  evaluateMove,
  linkCost,
  refreshSegments,
  refreshTouchingSegments,
} from './zoneCost';
import {
  alignEdges,
  compact,
  STRAIGHT_WORTH,
  straighten,
  straightLinks,
  tighten,
} from './zoneFinish';

const ITERATIONS = 16000;
/** Where the search starts from, one run each: the same diagram must always get the same layout. */
export const SEEDS: readonly number[] = [11, 23, 37, 53, 71, 97];
const START_TEMPERATURE = 500;
const END_TEMPERATURE = 1.5;
/** What a crossing anywhere in the diagram, inside a zone too, costs an arrangement in the end. */
const DIAGRAM_CROSSING_COST = 180;

interface Pose {
  x: number;
  y: number;
  flip: 0 | 1;
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

function posesOf(placed: readonly Placed[]): Pose[] {
  return placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
}

function restore(placed: readonly Placed[], poses: readonly Pose[]): void {
  placed.forEach((p, i) => {
    const pose = poses[i];
    if (!pose) return;
    p.x = pose.x;
    p.y = pose.y;
    p.flip = pose.flip;
  });
}

function anneal(links: readonly BlockLink[], placed: Placed[], random: () => number): void {
  let current = linkCost(links, placed);
  let best = current;
  const bestState = posesOf(placed);
  let temperature = START_TEMPERATURE;
  const ratio = (END_TEMPERATURE / START_TEMPERATURE) ** (1 / ITERATIONS);
  for (let it = 0; it < ITERATIONS; it++) {
    temperature *= ratio;
    const a = placed[Math.floor(random() * placed.length)];
    if (!a) continue;
    const prevAX = a.x;
    const prevAY = a.y;
    const prevAFlip = a.flip;
    let nextAX = prevAX;
    let nextAY = prevAY;
    let nextAFlip: 0 | 1 = prevAFlip;
    let other: Placed | undefined;
    let prevOX = 0;
    let prevOY = 0;
    let prevOFlip: 0 | 1 = 0;
    let nextOX = 0;
    let nextOY = 0;
    let nextOFlip: 0 | 1 = 0;
    const roll = random();
    if (roll < 0.08 && a.block.flippable) {
      nextAFlip = prevAFlip === 0 ? 1 : 0;
    } else if (roll < 0.2) {
      other = placed[Math.floor(random() * placed.length)];
      if (!other || other === a) continue;
      prevOX = other.x;
      prevOY = other.y;
      prevOFlip = other.flip;
      nextAX = prevOX;
      nextAY = prevOY;
      nextOX = prevAX;
      nextOY = prevAY;
      nextOFlip = prevOFlip;
    } else {
      const span = 80 + 1500 * (temperature / START_TEMPERATURE);
      nextAX = prevAX + (random() - 0.5) * 2 * span;
      nextAY = prevAY + (random() - 0.5) * 2 * span;
    }
    const change = evaluateMove(
      links,
      placed,
      a,
      nextAX,
      nextAY,
      nextAFlip,
      other,
      nextOX,
      nextOY,
      nextOFlip,
    );
    if (Number.isNaN(change)) continue;
    if (change <= 0 || random() < Math.exp(-change / temperature)) {
      current += change;
      if (current < best) {
        best = current;
        for (let i = 0; i < placed.length; i++) {
          const p = placed[i];
          const saved = bestState[i];
          if (p && saved) {
            saved.x = p.x;
            saved.y = p.y;
            saved.flip = p.flip;
          }
        }
      }
    } else {
      a.x = prevAX;
      a.y = prevAY;
      a.flip = prevAFlip;
      if (other) {
        other.x = prevOX;
        other.y = prevOY;
        other.flip = prevOFlip;
      }
      refreshTouchingSegments(links, a, other);
    }
  }
  restore(placed, bestState);
  // The segments are those of the last arrangement tried, which is rarely the best one.
  refreshSegments(links);
}

function nodeOrderOf(nodes: ReadonlyMap<string, Rect>): string[] {
  return [...nodes.entries()].sort((a, b) => a[1].y - b[1].y).map(([id]) => id);
}

function snapshot(
  placed: readonly Placed[],
  baseOrders: ReadonlyMap<string, readonly string[]>,
): ZonePlacement {
  return new Map(
    placed.map((p) => {
      const base = baseOrders.get(p.block.id);
      const cur = nodeOrderOf(p.block.nodes);
      const changed =
        base !== undefined &&
        (cur.length !== base.length || cur.some((id, idx) => id !== base[idx]));
      const entry: { x: number; y: number; flip: 0 | 1; order?: readonly string[] } = {
        x: p.x,
        y: p.y,
        flip: p.flip,
      };
      if (changed) entry.order = cur;
      return [p.block.id, entry];
    }),
  );
}

/**
 * Finds where to put each zone, which has been arranged on its own, by simulated annealing.
 * Shared columns are given up for shorter links between zones. Seeded, so the same diagram
 * always gets the same placement.
 */
export function searchZonePlacement(doc: DavDocument, columnLayout: ColumnLayout): ZonePlacement {
  const arrangement = arrange(doc, columnLayout);
  let best = NOTHING_FOUND;
  for (const seed of SEEDS) {
    const found = searchFrom(doc, arrangement, seed);
    // The first of two that are as good, which `bestOfSeeds` has to match.
    if (found.score < best.score) best = found;
  }
  return best.placement;
}

/**
 * The part of `searchZonePlacement` that one seed does. The seeds do not depend on each other,
 * so they can run side by side: `bestOfSeeds` then gives what the whole search would have.
 */
export function searchZonePlacementFrom(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  seed: number,
): SeedPlacement {
  return searchFrom(doc, arrange(doc, columnLayout), seed);
}

/** What the whole search gives, from what each of its seeds found. */
export function bestOfSeeds<T extends { score: number }>(
  found: ReadonlyMap<number, T>,
): T | undefined {
  let best: T | undefined;
  for (const seed of SEEDS) {
    const one = found.get(seed);
    if (one && one.score < (best?.score ?? Number.POSITIVE_INFINITY)) best = one;
  }
  return best;
}

/** The best arrangement found from one seed, and its score: the lower, the better. */
export interface SeedPlacement {
  score: number;
  placement: ZonePlacement;
}

const NOTHING_FOUND: SeedPlacement = { score: Number.POSITIVE_INFINITY, placement: new Map() };

/** What every seed starts from: the zones, where they stand at first, and the links between them. */
interface Arrangement {
  placed: Placed[];
  links: BlockLink[];
  start: ReadonlyMap<string, { x: number; y: number }>;
  nodeParent: ReadonlyMap<string, string | undefined>;
  adj: ReadonlyMap<string, readonly string[]>;
  docLinks: readonly Link[];
  baseOrders: ReadonlyMap<string, readonly string[]>;
}

function arrange(doc: DavDocument, columnLayout: ColumnLayout): Arrangement {
  const { blocks, owners } = buildBlocks(doc, columnLayout);
  const start = initialPositions(doc, blocks, owners, columnLayout);
  const placed: Placed[] = blocks.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
  const adj = new Map<string, string[]>();
  for (const e of doc.edges) {
    if (e.from === e.to) continue;
    pushToMap(adj, e.from, e.to);
    pushToMap(adj, e.to, e.from);
  }
  const baseOrders = new Map(blocks.map((b) => [b.id, nodeOrderOf(b.nodes)]));
  return {
    placed,
    links: buildLinks(doc, placed),
    start,
    nodeParent: parentMap(doc.nodes),
    adj,
    docLinks: linksOf(doc),
    baseOrders,
  };
}

function scoreZoneLayout(docLinks: readonly Link[], layout: Layout) {
  const segs = segmentsOf(docLinks, layout);
  return {
    crossings: crossingsOf(segs),
    deltaY: segs.reduce((sum, s) => sum + Math.abs(s.ay - s.by), 0),
  };
}

/**
 * Reorders nodes sharing a parent group and column within each placed zone using both
 * intra-zone and inter-zone connections, keeping changes only when crossings or link span drop.
 */
function refineZoneNodeOrder(
  placed: readonly Placed[],
  nodeParent: ReadonlyMap<string, string | undefined>,
  adj: ReadonlyMap<string, readonly string[]>,
  docLinks: readonly Link[],
): boolean {
  let curScore = scoreZoneLayout(docLinks, toLayout(placed));
  let anyChanged = false;
  for (let sweep = 0; sweep < 4; sweep++) {
    let changed = false;
    for (const p of placed) {
      if (p.block.nodes.size < 2) continue;
      const layout = toLayout(placed);
      const groups = new Map<string, Array<[string, Rect]>>();
      for (const entry of p.block.nodes.entries()) {
        const [id, r] = entry;
        const key = `${nodeParent.get(id) ?? ''}|${Math.round(r.x)}`;
        const list = groups.get(key);
        if (list) list.push(entry);
        else groups.set(key, [entry]);
      }
      for (const items of groups.values()) {
        if (items.length < 2) continue;
        const partitionIds = new Set(items.map(([id]) => id));
        const curY = (id: string) => (layout.nodes[id]?.y ?? 0) + STATION_CENTER;
        const keyed = items.map(([id, r]) => {
          const vals = (adj.get(id) ?? [])
            .filter((other) => !partitionIds.has(other) && layout.nodes[other] !== undefined)
            .map(curY);
          const target = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : curY(id);
          return { id, r, oldY: r.y, cur: curY(id), target };
        });
        const slotYs = items.map(([, r]) => r.y).sort((a, b) => a - b);
        if (p.flip) slotYs.reverse();
        const sorted = [...keyed].sort((a, b) => a.target - b.target || a.cur - b.cur);
        if (sorted.every((item, idx) => item.oldY === slotYs[idx])) continue;
        sorted.forEach((item, idx) => {
          item.r.y = slotYs[idx] as number;
        });
        const nextScore = scoreZoneLayout(docLinks, toLayout(placed));
        const better =
          nextScore.crossings < curScore.crossings ||
          (nextScore.crossings === curScore.crossings && nextScore.deltaY < curScore.deltaY - 0.5);
        if (better) {
          curScore = nextScore;
          changed = true;
          anyChanged = true;
        } else {
          for (const item of keyed) item.r.y = item.oldY;
        }
      }
    }
    if (!changed) break;
  }
  return anyChanged;
}

function clonePlaced(placed: readonly Placed[], poses: readonly Pose[]): Placed[] {
  return placed.map((p, i) => {
    const pose = poses[i] ?? { x: p.x, y: p.y, flip: p.flip };
    return {
      block: {
        ...p.block,
        nodes: new Map([...p.block.nodes].map(([id, r]) => [id, { ...r }])),
      },
      x: pose.x,
      y: pose.y,
      flip: pose.flip,
    };
  });
}

function searchFrom(
  doc: DavDocument,
  { placed, links, start, nodeParent, adj, docLinks, baseOrders }: Arrangement,
  seed: number,
): SeedPlacement {
  for (const p of placed) {
    const at = start.get(p.block.id) ?? { x: 0, y: 0 };
    p.x = at.x;
    p.y = at.y;
    p.flip = 0;
  }
  anneal(links, placed, seededRandom(seed * 104729));
  tighten(links, placed);
  const tightened = posesOf(placed);
  let best = NOTHING_FOUND;
  // Stepping aside is judged by the cost between zones alone, and can cost more in
  // crossings inside them than it saves: the arrangement is finished both ways, and the
  // one with steps aside is taken only where the whole score is lower for it.
  for (const aside of [false, true]) {
    const trialPlaced = clonePlaced(placed, tightened);
    let trialLinks = buildLinks(doc, trialPlaced);
    refreshSegments(trialLinks);
    compact(trialLinks, trialPlaced, aside);
    alignEdges(trialLinks, trialPlaced);
    // Lining up edges moves zones a little; close what that opened.
    tighten(trialLinks, trialPlaced);
    compact(trialLinks, trialPlaced, aside);
    if (refineZoneNodeOrder(trialPlaced, nodeParent, adj, docLinks)) {
      trialLinks = buildLinks(doc, trialPlaced);
      refreshSegments(trialLinks);
    }
    // Last, since sliding would undo it.
    straighten(trialLinks, trialPlaced);
    const score =
      linkCost(trialLinks, trialPlaced) +
      countCrossings(doc, toLayout(trialPlaced)) * DIAGRAM_CROSSING_COST -
      straightLinks(trialLinks, trialPlaced) * STRAIGHT_WORTH;
    if (score < best.score) best = { score, placement: snapshot(trialPlaced, baseOrders) };
  }
  return best;
}
