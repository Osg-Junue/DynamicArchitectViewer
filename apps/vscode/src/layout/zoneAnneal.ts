import type { DavDocument } from '../model/types';
import { countCrossings, properlyCross, type Segment, shareStation } from './links';
import { STATION_CENTER } from './metrics';
import {
  buildBlocks,
  type ColumnLayout,
  flippedY,
  HORIZONTAL_CLEARANCE,
  initialPositions,
  LONG_LINK,
  type Placed,
  pairKey,
  roundTrips,
  toLayout,
  VERTICAL_CLEARANCE,
  type ZonePlacement,
} from './zoneBlocks';

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

interface Pose {
  x: number;
  y: number;
  flip: 0 | 1;
}

interface Anchor {
  p: Placed;
  x: number;
  y: readonly [number, number];
}

const ITERATIONS = 16000;
const SEEDS = [11, 23, 37, 53, 71, 97];
const START_TEMPERATURE = 500;
const END_TEMPERATURE = 1.5;
const ALIGN_REACH = 140;
const ALIGN_TOLERANCE = 30;

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

/** The cost of the whole arrangement. */
function linkCost(links: readonly BlockLink[], placed: readonly Placed[]): number {
  let total = spreadCost(placed);
  for (const [i, s] of links.entries()) {
    updateSegment(s);
    total += shapeCost(s) + throughCost(s, placed);
    for (let j = 0; j < i; j++) {
      const t = links[j];
      if (t) total += crossingCost(s, t);
    }
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
  for (const s of links) {
    if (!touches(s, a, b)) {
      if (runsThrough(s, a)) total += 130;
      if (b && runsThrough(s, b)) total += 130;
      continue;
    }
    updateSegment(s);
  }
  for (const [i, s] of links.entries()) {
    if (!touches(s, a, b)) continue;
    total += shapeCost(s) + throughCost(s, placed);
    for (let j = 0; j < links.length; j++) {
      const t = links[j];
      if (t && j !== i && (j > i || !touches(t, a, b))) total += crossingCost(s, t);
    }
  }
  return total;
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

function applyPose(p: Placed, pose: Pose): void {
  p.x = pose.x;
  p.y = pose.y;
  p.flip = pose.flip;
}

/**
 * Evaluates moving `a` to `nextA` (and optionally `other` to `nextOther`).
 * Returns `null` when clearance fails (leaving state untouched); otherwise leaves the move
 * applied with updated link segments and returns its cost delta plus a `rollback` closure.
 */
function tryMove(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  a: Placed,
  nextA: Pose,
  other?: Placed,
  nextOther?: Pose,
): { change: number; rollback: () => void } | null {
  const prevA: Pose = { x: a.x, y: a.y, flip: a.flip };
  const prevOther: Pose | undefined = other
    ? { x: other.x, y: other.y, flip: other.flip }
    : undefined;
  const setMoved = (moved: boolean) => {
    applyPose(a, moved ? nextA : prevA);
    if (other && nextOther && prevOther) {
      applyPose(other, moved ? nextOther : prevOther);
    }
  };
  setMoved(true);
  const clear = isClear(a, placed) && (!other || isClear(other, placed));
  setMoved(false);
  if (!clear) return null;
  const before = movedCost(links, placed, a, other);
  setMoved(true);
  const change = movedCost(links, placed, a, other) - before;
  return {
    change,
    rollback: () => {
      setMoved(false);
      for (const l of links) if (touches(l, a, other)) updateSegment(l);
    },
  };
}

function anneal(links: readonly BlockLink[], placed: Placed[], random: () => number): void {
  let current = linkCost(links, placed);
  let best = current;
  let bestState: Pose[] = placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
  let temperature = START_TEMPERATURE;
  const ratio = (END_TEMPERATURE / START_TEMPERATURE) ** (1 / ITERATIONS);
  for (let it = 0; it < ITERATIONS; it++) {
    temperature *= ratio;
    const a = placed[Math.floor(random() * placed.length)];
    if (!a) continue;
    let nextA: Pose;
    let other: Placed | undefined;
    let nextOther: Pose | undefined;
    const roll = random();
    if (roll < 0.08 && a.block.flippable) {
      nextA = { x: a.x, y: a.y, flip: a.flip === 0 ? 1 : 0 };
    } else if (roll < 0.2) {
      other = placed[Math.floor(random() * placed.length)];
      if (!other || other === a) continue;
      nextA = { x: other.x, y: other.y, flip: a.flip };
      nextOther = { x: a.x, y: a.y, flip: other.flip };
    } else {
      const span = 80 + 1500 * (temperature / START_TEMPERATURE);
      nextA = {
        x: a.x + (random() - 0.5) * 2 * span,
        y: a.y + (random() - 0.5) * 2 * span,
        flip: a.flip,
      };
    }
    const move = tryMove(links, placed, a, nextA, other, nextOther);
    if (!move) continue;
    if (move.change <= 0 || random() < Math.exp(-move.change / temperature)) {
      current += move.change;
      if (current < best) {
        best = current;
        bestState = placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
      }
    } else {
      move.rollback();
    }
  }
  placed.forEach((p, i) => {
    const saved = bestState[i];
    if (saved) applyPose(p, saved);
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
    const moved = to.x !== a.x || to.y !== a.y;
    if (!moved || Math.abs(to.x - a.x) > ALIGN_REACH || Math.abs(to.y - a.y) > ALIGN_REACH) return;
    const move = tryMove(links, placed, a, { x: to.x, y: to.y, flip: a.flip });
    if (!move) return;
    if (current + move.change <= base + ALIGN_TOLERANCE) {
      current += move.change;
      base = Math.min(base, current);
    } else {
      move.rollback();
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
  const trips = roundTrips(doc);
  const placed: Placed[] = blocks.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
  const anchorOf = new Map<string, Anchor>();
  for (const p of placed) {
    for (const [id, r] of p.block.nodes) {
      anchorOf.set(id, {
        p,
        x: r.x + r.width / 2,
        y: [r.y + STATION_CENTER, flippedY(p.block, r) + STATION_CENTER],
      });
    }
  }
  const links: BlockLink[] = doc.edges.flatMap((e) => {
    const a = anchorOf.get(e.from);
    const b = anchorOf.get(e.to);
    if (!a || !b || a.p === b.p) return [];
    return [
      {
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
      },
    ];
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
