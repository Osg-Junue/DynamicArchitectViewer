import type { DavDocument } from '../model/types';
import { countCrossings, properlyCross, type Segment, shareStation } from './links';
import { type Rect, STATION_CENTER } from './metrics';
import {
  type Block,
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
  /**
   * The ways a straight rail could join the two stations, for each flip of the source and of
   * the target (`source.flip * 2 + target.flip`): bits for a target to the right, to the left,
   * below and above. A way is open when no node of either zone stands on it.
   */
  open: readonly [number, number, number, number];
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
/**
 * Width to height of the canvas an arrangement is fitted into. A preview beside an editor is
 * rarely wider than this, and an arrangement much wider than its canvas is shown small.
 */
const CANVAS_ASPECT = 1.6;
/** Sizes of the steps a zone takes towards its neighbors, largest first. */
const TIGHTEN_STEPS = [128, 64, 32, 16, 8, 4];
const ALIGN_REACH = 140;
const ALIGN_TOLERANCE = 30;
/** The most a link costs for being off a straight line, which is also what one that cannot be straight costs. */
const OFF_STRAIGHT_CAP = 160;
const OFF_STRAIGHT_WEIGHT = 2;
/** How far a zone moves to make a link straight, and how much cost one straight link is worth. */
const STRAIGHTEN_REACH = 120;
const STRAIGHT_WORTH = 120;

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

/**
 * How far the link is from a straight line: the sideways distance between its stations, along a
 * way that is open between them. It gives the search a slope towards arrangements where the
 * stations of a link face each other, which `straighten` then makes exact.
 */
function offStraight(l: BlockLink): number {
  const open = l.open[l.source.flip * 2 + l.target.flip] as number;
  const dx = l.bx - l.ax;
  const dy = l.by - l.ay;
  let off = OFF_STRAIGHT_CAP;
  if ((open & 1 && dx > 0) || (open & 2 && dx < 0)) off = Math.min(off, Math.abs(dy));
  if ((open & 4 && dy > 0) || (open & 8 && dy < 0)) off = Math.min(off, Math.abs(dx));
  return off;
}

function shapeCost(l: BlockLink): number {
  const dx = l.bx - l.ax;
  const length = Math.hypot(dx, l.by - l.ay);
  return (
    offStraight(l) * OFF_STRAIGHT_WEIGHT +
    // Every unit of a link counts, and counts again past a comfortable length. Counting only
    // the part past that length left the search with no reason to bring zones together.
    length * l.weight +
    Math.max(0, length * l.weight - LONG_LINK) +
    (dx < -60 ? 260 - dx * 0.3 : 0)
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
  // The longer side of the canvas the arrangement needs: growing along the other side is
  // free, so the search fills the canvas instead of stretching into a strip.
  return Math.max(right - left, (bottom - top) * CANVAS_ASPECT) * 1.2;
}

/** The cost of the whole arrangement. */
function linkCost(links: readonly BlockLink[], placed: readonly Placed[]): number {
  let total = spreadCost(placed);
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s) continue;
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
  refreshTouching: boolean,
): number {
  let total = spreadCost(placed);
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s) continue;
    if (!touches(s, a, b)) {
      if (runsThrough(s, a)) total += 130;
      if (b && runsThrough(s, b)) total += 130;
      continue;
    }
    if (refreshTouching) updateSegment(s);
  }
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s || !touches(s, a, b)) continue;
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

function refreshTouchingSegments(
  links: readonly BlockLink[],
  a: Placed,
  b: Placed | undefined,
): void {
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    if (l && touches(l, a, b)) updateSegment(l);
  }
}

/**
 * Evaluates moving `a` (and optionally `other`) without per-iteration heap or closure allocations.
 * Returns `Number.NaN` when clearance fails (leaving state and segments untouched); otherwise
 * leaves the move applied with updated link segments and returns its cost delta.
 */
function evaluateMove(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  a: Placed,
  nextAX: number,
  nextAY: number,
  nextAFlip: 0 | 1,
  other?: Placed,
  nextOX = 0,
  nextOY = 0,
  nextOFlip: 0 | 1 = 0,
): number {
  const prevAX = a.x;
  const prevAY = a.y;
  const prevAFlip = a.flip;
  const prevOX = other ? other.x : 0;
  const prevOY = other ? other.y : 0;
  const prevOFlip: 0 | 1 = other ? other.flip : 0;

  a.x = nextAX;
  a.y = nextAY;
  a.flip = nextAFlip;
  if (other) {
    other.x = nextOX;
    other.y = nextOY;
    other.flip = nextOFlip;
  }
  const clear = isClear(a, placed) && (!other || isClear(other, placed));
  a.x = prevAX;
  a.y = prevAY;
  a.flip = prevAFlip;
  if (other) {
    other.x = prevOX;
    other.y = prevOY;
    other.flip = prevOFlip;
  }
  if (!clear) return Number.NaN;

  const before = movedCost(links, placed, a, other, false);
  a.x = nextAX;
  a.y = nextAY;
  a.flip = nextAFlip;
  if (other) {
    other.x = nextOX;
    other.y = nextOY;
    other.flip = nextOFlip;
  }
  return movedCost(links, placed, a, other, true) - before;
}

function anneal(links: readonly BlockLink[], placed: Placed[], random: () => number): void {
  let current = linkCost(links, placed);
  let best = current;
  const bestState: Pose[] = placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
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
    const prevX = a.x;
    const prevY = a.y;
    const moved = to.x !== prevX || to.y !== prevY;
    if (!moved || Math.abs(to.x - prevX) > ALIGN_REACH || Math.abs(to.y - prevY) > ALIGN_REACH) {
      return;
    }
    const change = evaluateMove(links, placed, a, to.x, to.y, a.flip);
    if (Number.isNaN(change)) return;
    if (current + change <= base + ALIGN_TOLERANCE) {
      current += change;
      base = Math.min(base, current);
    } else {
      a.x = prevX;
      a.y = prevY;
      refreshTouchingSegments(links, a, undefined);
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

/**
 * Slides each zone towards the zones it is linked to, for as long as that lowers the cost
 * and keeps the clearances. The search leaves a zone wherever a random move last helped;
 * this closes the gaps it left, so that linked neighbors end up one clearance apart.
 */
function tighten(links: readonly BlockLink[], placed: readonly Placed[]): void {
  for (let round = 0; round < 10; round++) {
    let moved = false;
    for (const a of placed) {
      // Where its links would have no length at all.
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (const l of links) {
        if (l.source === a) {
          sumX += l.bx - l.sourceX;
          sumY += l.by - l.sourceY[a.flip];
          count++;
        } else if (l.target === a) {
          sumX += l.ax - l.targetX;
          sumY += l.ay - l.targetY[a.flip];
          count++;
        }
      }
      if (count === 0) continue;
      const target = { x: sumX / count, y: sumY / count };
      for (const axis of ['x', 'y'] as const) {
        for (const step of TIGHTEN_STEPS) {
          for (;;) {
            const toGo = target[axis] - a[axis];
            if (Math.abs(toGo) < step) break;
            const before = a[axis];
            const next = before + Math.sign(toGo) * step;
            const change = evaluateMove(
              links,
              placed,
              a,
              axis === 'x' ? next : a.x,
              axis === 'y' ? next : a.y,
              a.flip,
            );
            if (Number.isNaN(change)) break;
            if (change < 0) {
              moved = true;
            } else {
              a[axis] = before;
              refreshTouchingSegments(links, a, undefined);
              break;
            }
          }
        }
      }
    }
    if (!moved) break;
  }
}

/**
 * The stations at the ends of the link are level, or one is straight above the other, and
 * nothing stands between them: a rail can join them in one straight line.
 */
function isStraight(l: BlockLink, placed: readonly Placed[]): boolean {
  if (Math.abs(l.ay - l.by) >= 0.5 && Math.abs(l.ax - l.bx) >= 0.5) return false;
  for (const p of placed) {
    if (p !== l.source && p !== l.target) {
      if (runsThrough(l, p)) return false;
      continue;
    }
    for (const [id, r] of p.block.nodes) {
      if (id === l.from || id === l.to) continue;
      const x = p.x + r.x;
      const y = p.y + (p.flip ? flippedY(p.block, r) : r.y);
      if (l.maxX > x && l.minX < x + r.width && l.maxY > y && l.minY < y + r.height) return false;
    }
  }
  return true;
}

function straightLinks(links: readonly BlockLink[], placed: readonly Placed[], a?: Placed): number {
  let count = 0;
  for (const l of links) {
    if ((!a || l.source === a || l.target === a) && isStraight(l, placed)) count++;
  }
  return count;
}

/**
 * Moves zones the little it takes to put the two stations of a link level, or one straight above
 * the other. The search and the sliding leave them a few units apart, which a rail has to make
 * up with a bend. A zone takes the move that straightens the most of its links, as long as the
 * rest of the cost rises by less than those links are worth.
 */
function straighten(links: readonly BlockLink[], placed: readonly Placed[]): void {
  for (const l of links) updateSegment(l);
  for (let round = 0; round < 4; round++) {
    let moved = false;
    for (const a of placed) {
      const homeX = a.x;
      const homeY = a.y;
      const before = straightLinks(links, placed, a);
      const moves: Array<{ x: number; y: number }> = [];
      for (const l of links) {
        if (l.source !== a && l.target !== a) continue;
        const towards = l.source === a ? 1 : -1;
        const dx = (l.bx - l.ax) * towards;
        const dy = (l.by - l.ay) * towards;
        if (dy !== 0 && Math.abs(dy) <= STRAIGHTEN_REACH) moves.push({ x: homeX, y: homeY + dy });
        if (dx !== 0 && Math.abs(dx) <= STRAIGHTEN_REACH) moves.push({ x: homeX + dx, y: homeY });
      }
      let best: { x: number; y: number; gain: number; reach: number } | undefined;
      for (const to of moves) {
        const change = evaluateMove(links, placed, a, to.x, to.y, a.flip);
        if (Number.isNaN(change)) continue;
        const gain = straightLinks(links, placed, a) - before;
        const reach = Math.abs(to.x - homeX) + Math.abs(to.y - homeY);
        if (
          gain > 0 &&
          change <= gain * STRAIGHT_WORTH &&
          (!best || gain > best.gain || (gain === best.gain && reach < best.reach))
        ) {
          best = { ...to, gain, reach };
        }
        a.x = homeX;
        a.y = homeY;
        refreshTouchingSegments(links, a, undefined);
      }
      if (best) {
        a.x = best.x;
        a.y = best.y;
        refreshTouchingSegments(links, a, undefined);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** No other node of the zone stands beside the node on that side: 0 right, 1 left, 2 below, 3 above. */
function isFreeSide(block: Block, id: string, side: number, flip: 0 | 1): boolean {
  const own = block.nodes.get(id);
  if (!own) return false;
  const top = (r: Rect) => (flip ? flippedY(block, r) : r.y);
  const x = own.x + own.width / 2;
  const y = top(own) + STATION_CENTER;
  for (const [other, r] of block.nodes) {
    if (other === id) continue;
    const inRow = y > top(r) && y < top(r) + r.height;
    const inColumn = x > r.x && x < r.x + r.width;
    if (side === 0 && inRow && r.x > own.x) return false;
    if (side === 1 && inRow && r.x < own.x) return false;
    if (side === 2 && inColumn && top(r) > top(own)) return false;
    if (side === 3 && inColumn && top(r) < top(own)) return false;
  }
  return true;
}

function openWays(source: Block, from: string, target: Block, to: string): BlockLink['open'] {
  const ways = (sourceFlip: 0 | 1, targetFlip: 0 | 1) => {
    let bits = 0;
    // A target to the right is met on its left side, and so on.
    for (const [side, facing] of [
      [0, 1],
      [1, 0],
      [2, 3],
      [3, 2],
    ] as const) {
      if (
        isFreeSide(source, from, side, sourceFlip) &&
        isFreeSide(target, to, facing, targetFlip)
      ) {
        bits |= 1 << side;
      }
    }
    return bits;
  };
  return [ways(0, 0), ways(0, 1), ways(1, 0), ways(1, 1)];
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
        open: openWays(a.p.block, e.from, b.p.block, e.to),
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
    tighten(links, placed);
    alignEdges(links, placed);
    // Lining up edges moves zones a little; close what that opened.
    tighten(links, placed);
    // Last, since sliding would undo it.
    straighten(links, placed);
    const score =
      linkCost(links, placed) +
      countCrossings(doc, toLayout(placed)) * 150 -
      straightLinks(links, placed) * STRAIGHT_WORTH;
    if (score < bestScore) {
      bestScore = score;
      bestPlacement = snapshot(placed);
    }
  }
  return bestPlacement;
}
