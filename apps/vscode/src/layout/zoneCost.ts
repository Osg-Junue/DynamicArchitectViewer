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
/**
 * What an arrangement no wider than high pays for each unit its links run up or down beyond
 * what they run to the right: an upright link then costs twice what a level one of its length
 * does. A diagram is read from left to right, and without this a zone was as well placed above
 * or below the zone it is linked to as beside it. The weight falls to nothing as the
 * arrangement gets twice as wide as high: from there on, going further to the right would
 * stretch it into a strip, and a long flow has to turn back under itself.
 */
const OFF_FLOW_WEIGHT = 1;
const OFF_FLOW_FULL_ASPECT = 1;
const OFF_FLOW_NONE_ASPECT = 2;
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

function runsThroughBox(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  for (let i = 1; i < 7; i++) {
    const x = ax + (dx * i) / 7;
    const y = ay + (dy * i) / 7;
    if (x > left && x < right && y > top && y < bottom) return true;
  }
  return false;
}

export function runsThrough(link: BlockLink, p: Placed): boolean {
  const right = p.x + p.block.width;
  const bottom = p.y + p.block.height;
  if (link.maxX <= p.x || link.minX >= right || link.maxY <= p.y || link.minY >= bottom) {
    return false;
  }
  return runsThroughBox(link.ax, link.ay, link.bx, link.by, p.x, right, p.y, bottom);
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

/** How far the link runs up or down beyond what it runs to the right. */
function offFlow(l: BlockLink): number {
  return Math.max(0, Math.abs(l.by - l.ay) - Math.max(0, l.bx - l.ax));
}

function crossingCost(s: BlockLink, t: BlockLink): number {
  if (s.maxX < t.minX || t.maxX < s.minX || s.maxY < t.minY || t.maxY < s.minY) return 0;
  return !shareStation(s, t) && properlyCross(s, t) ? CROSSING_COST : 0;
}

/**
 * Exact orthogonal barrier cost of intermediate zone `p` on link `l`:
 * When `p` blocks both 1-bend L-paths (horizontal or vertical barrier), any orthogonal route
 * around `p` pays mandatory extra bends plus the shorter perimeter detour (`2 * clearDist`).
 * When at least one 1-bend L-path around `p` stays open, falls back to `runsThrough`.
 */
function zoneObstruction(l: BlockLink, p: Placed): number {
  const left = p.x;
  const right = left + p.block.width;
  const top = p.y;
  const bottom = top + p.block.height;
  if (l.maxX <= left || l.minX >= right || l.maxY <= top || l.minY >= bottom) return 0;

  const ayIn = l.ay > top && l.ay < bottom;
  const byIn = l.by > top && l.by < bottom;
  const axIn = l.ax > left && l.ax < right;
  const bxIn = l.bx > left && l.bx < right;

  const hitsL1 = ayIn || bxIn;
  const hitsL2 = axIn || byIn;

  if (hitsL1 && hitsL2) {
    const detour =
      ayIn && byIn
        ? 2 * Math.min(Math.min(l.ay, l.by) - top + 12, bottom + 12 - Math.max(l.ay, l.by))
        : 2 * Math.min(Math.min(l.ax, l.bx) - left + 12, right + 12 - Math.max(l.ax, l.bx));
    return 260 + Math.max(0, detour) * l.weight;
  }
  if (hitsL1 || hitsL2) {
    return (runsThroughBox(l.ax, l.ay, l.bx, l.by, left, right, top, bottom) ? 160 : 95) * l.weight;
  }
  return runsThroughBox(l.ax, l.ay, l.bx, l.by, left, right, top, bottom) ? THROUGH_COST : 0;
}

function throughCost(l: BlockLink, placed: readonly Placed[]): number {
  let total = 0;
  for (const p of placed) {
    if (p !== l.source && p !== l.target) total += zoneObstruction(l, p);
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

/**
 * What the size of an arrangement costs it, and what each unit its links run off the flow
 * counts in an arrangement of that size.
 */
function sizeCost(placed: readonly Placed[]): { spread: number; offFlowWeight: number } {
  const { width, height } = extent(placed);
  const narrow =
    (OFF_FLOW_NONE_ASPECT - width / Math.max(1, height)) /
    (OFF_FLOW_NONE_ASPECT - OFF_FLOW_FULL_ASPECT);
  return {
    // The longer side of the canvas the arrangement needs: growing along the other side is
    // free, so the search fills the canvas instead of stretching into a strip.
    spread: Math.max(width, height * CANVAS_ASPECT) * 1.2,
    offFlowWeight: OFF_FLOW_WEIGHT * Math.min(1, Math.max(0, narrow)),
  };
}

/** The cost of the whole arrangement. */
export function linkCost(links: readonly BlockLink[], placed: readonly Placed[]): number {
  const { spread, offFlowWeight } = sizeCost(placed);
  let total = spread;
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s) continue;
    updateSegment(s);
    total += shapeCost(s) + offFlow(s) * offFlowWeight + throughCost(s, placed);
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
 * A move can change the size of the arrangement, and with it what running off the flow counts
 * for every link, so that is summed over them all.
 */
function movedCost(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  a: Placed,
  b: Placed | undefined,
  refreshTouching: boolean,
): number {
  const { spread, offFlowWeight } = sizeCost(placed);
  let total = spread;
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s) continue;
    if (!touches(s, a, b)) {
      total += zoneObstruction(s, a);
      if (b) total += zoneObstruction(s, b);
    } else if (refreshTouching) {
      updateSegment(s);
    }
    total += offFlow(s) * offFlowWeight;
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
  const top = (nid: string, r: Rect) => (flip ? flippedY(block, r, nid) : r.y);
  const x = own.x + own.width / 2;
  const ownTop = top(id, own);
  const y = ownTop + STATION_CENTER;
  for (const [other, r] of block.nodes) {
    if (other === id) continue;
    const otherTop = top(other, r);
    const inRow = y > otherTop && y < otherTop + r.height;
    const inColumn = x > r.x && x < r.x + r.width;
    if (side === 0 && inRow && r.x > own.x) return false;
    if (side === 1 && inRow && r.x < own.x) return false;
    if (side === 2 && inColumn && otherTop > ownTop) return false;
    if (side === 3 && inColumn && otherTop < ownTop) return false;
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
        y: [r.y + STATION_CENTER, flippedY(p.block, r, id) + STATION_CENTER],
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
