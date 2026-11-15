import type { DavDocument } from '../model/types';
import { properlyCross, type Segment, shareStation } from './links';
import { type Rect, STATION_CENTER } from './metrics';
import {
  type Block,
  flippedY,
  HORIZONTAL_CLEARANCE,
  LONG_LINK,
  type Placed,
  pairKey,
  roundTrips,
  VERTICAL_CLEARANCE,
} from './zoneBlocks';

/**
 * Width to height of the canvas an arrangement is fitted into. A preview beside an editor is
 * rarely wider than this, and an arrangement much wider than its canvas is shown small.
 */
const CANVAS_ASPECT = 1.6;
/** The most a link costs for being off a straight line, which is also what one that cannot be straight costs. */
const OFF_STRAIGHT_CAP = 160;
const OFF_STRAIGHT_WEIGHT = 2;
/** What two links between zones cost for crossing, and one for running through a zone. */
const CROSSING_COST = 250;
const THROUGH_COST = 130;

/** A link between two blocks; its `Segment` part is refreshed by every cost evaluation. */
export interface BlockLink extends Segment {
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

interface Anchor {
  p: Placed;
  x: number;
  y: readonly [number, number];
}

export function runsThrough(link: BlockLink, p: Placed): boolean {
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

export function refreshSegments(links: readonly BlockLink[]): void {
  for (const l of links) updateSegment(l);
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
  return !shareStation(s, t) && properlyCross(s, t) ? CROSSING_COST : 0;
}

function throughCost(l: BlockLink, placed: readonly Placed[]): number {
  let total = 0;
  for (const p of placed) {
    if (p !== l.source && p !== l.target && runsThrough(l, p)) total += THROUGH_COST;
  }
  return total;
}

/** The width and the height of the rectangle around the whole arrangement. */
export function extent(placed: readonly Placed[]): { width: number; height: number } {
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
  return { width: right - left, height: bottom - top };
}

function spreadCost(placed: readonly Placed[]): number {
  const { width, height } = extent(placed);
  // The longer side of the canvas the arrangement needs: growing along the other side is
  // free, so the search fills the canvas instead of stretching into a strip.
  return Math.max(width, height * CANVAS_ASPECT) * 1.2;
}

/** The cost of the whole arrangement. */
export function linkCost(links: readonly BlockLink[], placed: readonly Placed[]): number {
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
      if (runsThrough(s, a)) total += THROUGH_COST;
      if (b && runsThrough(s, b)) total += THROUGH_COST;
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

export function isClear(a: Placed, placed: readonly Placed[]): boolean {
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

export function refreshTouchingSegments(
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
export function evaluateMove(
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

/** The links between the zones placed as `placed`. A link inside one zone moves with it. */
export function buildLinks(doc: DavDocument, placed: readonly Placed[]): BlockLink[] {
  const trips = roundTrips(doc);
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
  return doc.edges.flatMap((e) => {
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
}
