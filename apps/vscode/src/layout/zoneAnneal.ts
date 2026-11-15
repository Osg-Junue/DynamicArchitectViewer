import type { DavDocument } from '../model/types';
import { countCrossings } from './links';
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
const SEEDS = [11, 23, 37, 53, 71, 97];
const START_TEMPERATURE = 500;
const END_TEMPERATURE = 1.5;
/** What a crossing anywhere in the diagram, inside a zone too, costs an arrangement in the end. */
const DIAGRAM_CROSSING_COST = 150;

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

function snapshot(placed: readonly Placed[]): ZonePlacement {
  return new Map(placed.map((p) => [p.block.id, { x: p.x, y: p.y, flip: p.flip }]));
}

/**
 * Finds where to put each zone, which has been arranged on its own, by simulated annealing.
 * Shared columns are given up for shorter links between zones. Seeded, so the same diagram
 * always gets the same placement.
 */
export function searchZonePlacement(doc: DavDocument, columnLayout: ColumnLayout): ZonePlacement {
  const { blocks, owners } = buildBlocks(doc, columnLayout);
  const start = initialPositions(doc, blocks, owners, columnLayout);
  const placed: Placed[] = blocks.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
  const links = buildLinks(doc, placed);

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
    tighten(links, placed);
    const tightened = posesOf(placed);
    // Stepping aside is judged by the cost between zones alone, and can cost more in
    // crossings inside them than it saves: the arrangement is finished both ways, and the
    // one with steps aside is taken only where the whole score is lower for it.
    for (const aside of [false, true]) {
      restore(placed, tightened);
      refreshSegments(links);
      compact(links, placed, aside);
      alignEdges(links, placed);
      // Lining up edges moves zones a little; close what that opened.
      tighten(links, placed);
      compact(links, placed, aside);
      // Last, since sliding would undo it.
      straighten(links, placed);
      const score =
        linkCost(links, placed) +
        countCrossings(doc, toLayout(placed)) * DIAGRAM_CROSSING_COST -
        straightLinks(links, placed) * STRAIGHT_WORTH;
      if (score < bestScore) {
        bestScore = score;
        bestPlacement = snapshot(placed);
      }
    }
  }
  return bestPlacement;
}
