import type { DavDocument } from '../model/types';
import {
  analyzeFlow,
  countCorridorIntrusions,
  type FlowAnalysis,
  flowPairKey,
  isLateAuxAlert,
  type PrimaryCorridor,
  primaryCorridors,
  type TransitionRole,
} from './flow';
import {
  countCrossings,
  type Link,
  primaryCrossingsOf,
  properlyCross,
  type Segment,
} from './links';
import { enclosingRect, type Layout, ORIGIN, type Rect, STATION_CENTER } from './metrics';
import {
  type Block,
  flippedY,
  HORIZONTAL_CLEARANCE,
  LONG_LINK,
  type Placed,
  toLayout,
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
const STAGE_OVERLAP_COST = 2400;
const LAYER_INTRUSION_COST = 1200;
const RIBBON_MAX_ASPECT = 6.2;
const RAIL_CLEARANCE = 12;

/** What a crossing anywhere in the diagram, inside a zone too, costs an arrangement in the end. */
export const DIAGRAM_CROSSING_COST = 180;
/** How much cost one straight inter-zone link is worth during candidate scoring and straightening. */
export const STRAIGHT_WORTH = 120;
/**
 * What one straight link is worth once a seed's arrangement is scored. A link a few units off
 * level costs its rail two bends, which the cost does not count. At `STRAIGHT_WORTH` 12 of the
 * 26 such links between zones in 22 test diagrams stayed bent, the move that would straighten
 * one raising the rest of the cost by 200 or more. It moves the arrangement after its score is
 * taken, so it does not change which seed wins.
 */
export const CHOSEN_STRAIGHT_WORTH = 300;

export interface FlowContext {
  preserveFlow: boolean;
  wrapped: boolean;
  horizontalClearance: number;
  rowOfBlock?: ReadonlyMap<string, number>;
  zoneStage: ReadonlyMap<string, number>;
  auxiliaryZones: ReadonlySet<string>;
  stagePairs: ReadonlyArray<readonly [string, string]>;
  /** Pendant feedback branches (`za -> zb`) aligned under/above `za` without drifting upstream of `za`. */
  pendantPairs: ReadonlyArray<readonly [string, string]>;
  corridors: readonly PrimaryCorridor[];
  /** Pre-indexed block slots for zero-allocation `flowPenalty` checks. */
  slotOf: ReadonlyMap<string, number>;
  slots: Array<Placed | undefined>;
  placedSlots: Int32Array;
  stagePairIdx: ReadonlyArray<readonly [number, number]>;
  pendantPairIdx: ReadonlyArray<readonly [number, number]>;
  corridorIdx: ReadonlyArray<{
    a: number;
    b: number;
    allowed: ReadonlySet<string>;
    allowedSlots: Uint8Array;
  }>;
}

function isCrossRow(ctx: FlowContext | undefined, aId: string, bId: string): boolean {
  if (!ctx?.wrapped || !ctx.rowOfBlock) return false;
  const ra = ctx.rowOfBlock.get(aId);
  const rb = ctx.rowOfBlock.get(bId);
  return ra !== undefined && rb !== undefined && ra !== rb;
}

/** Builds stage progression and primary-corridor metadata for `zoneScore`. */
export function buildFlowContext(
  flow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
  preserveFlow: boolean,
  wrapped = false,
  rowOfBlock?: ReadonlyMap<string, number>,
  horizontalClearance = HORIZONTAL_CLEARANCE,
): FlowContext {
  const allNbrs = new Map<string, Set<string>>();
  const outPrimary = new Map<string, Set<string>>();
  const returnPairs = new Set<string>();
  const rawStagePairs: Array<readonly [string, string]> = [];
  const seenStagePairs = new Set<string>();

  for (const c of flow.connections) {
    const za = owners.get(c.from) ?? c.from;
    const zb = owners.get(c.to) ?? c.to;
    if (za === zb) continue;
    if (!allNbrs.has(za)) allNbrs.set(za, new Set());
    if (!allNbrs.has(zb)) allNbrs.set(zb, new Set());
    allNbrs.get(za)?.add(zb);
    allNbrs.get(zb)?.add(za);
    if (c.role === 'return') {
      returnPairs.add(`${za}\0${zb}`);
      continue;
    }
    if (c.role !== 'primary') continue;
    if (flow.auxiliaryZones.has(za) || flow.auxiliaryZones.has(zb)) continue;
    if (!outPrimary.has(za)) outPrimary.set(za, new Set());
    outPrimary.get(za)?.add(zb);
    if ((flow.zoneStage.get(za) ?? 0) < (flow.zoneStage.get(zb) ?? 0)) {
      const dirKey = `${za}\0${zb}`;
      if (!seenStagePairs.has(dirKey)) {
        seenStagePairs.add(dirKey);
        rawStagePairs.push([za, zb]);
      }
    }
  }

  // Keep pendant local feedback loops (single neighbor `za`, returns to `za`, no further primary
  // targets while `za` advances elsewhere) free to stack above/below `za` without sliding left of `za`.
  const stagePairs: Array<readonly [string, string]> = [];
  const pendantPairs: Array<readonly [string, string]> = [];
  for (const pair of rawStagePairs) {
    const [za, zb] = pair;
    const isPendantFeedback =
      (allNbrs.get(zb)?.size ?? 0) === 1 &&
      returnPairs.has(`${zb}\0${za}`) &&
      (outPrimary.get(zb)?.size ?? 0) === 0 &&
      (outPrimary.get(za)?.size ?? 0) > 1;
    if (isPendantFeedback) pendantPairs.push(pair);
    else stagePairs.push(pair);
  }

  const corridors = primaryCorridors(flow, owners);
  const blockIds = [...new Set([...flow.zoneStage.keys(), ...owners.values()])];
  const slotOf = new Map<string, number>(blockIds.map((id, i) => [id, i]));
  const indexPairs = (pairs: ReadonlyArray<readonly [string, string]>) =>
    pairs.flatMap(([a, b]) => {
      const ia = slotOf.get(a);
      const ib = slotOf.get(b);
      return ia !== undefined && ib !== undefined ? ([[ia, ib]] as const) : [];
    });
  const corridorIdx = corridors.flatMap(({ a, b, allowed }) => {
    const ia = slotOf.get(a);
    const ib = slotOf.get(b);
    if (ia === undefined || ib === undefined) return [];
    const allowedSlots = new Uint8Array(blockIds.length);
    for (const id of allowed) {
      const sIdx = slotOf.get(id);
      if (sIdx !== undefined) allowedSlots[sIdx] = 1;
    }
    return [{ a: ia, b: ib, allowed, allowedSlots }];
  });

  return {
    preserveFlow,
    wrapped,
    horizontalClearance,
    ...(rowOfBlock ? { rowOfBlock } : {}),
    zoneStage: flow.zoneStage,
    auxiliaryZones: flow.auxiliaryZones,
    stagePairs,
    pendantPairs,
    corridors,
    slotOf,
    slots: new Array<Placed | undefined>(blockIds.length),
    placedSlots: new Int32Array(Math.max(16, blockIds.length)),
    stagePairIdx: indexPairs(stagePairs),
    pendantPairIdx: indexPairs(pendantPairs),
    corridorIdx,
  };
}

/** A link between two blocks; its `Segment` part is refreshed by every cost evaluation. */
export interface BlockLink extends Segment {
  role: TransitionRole;
  /** Touches an auxiliary cross-cutting zone (monitoring, platform, secops). */
  auxTouch: boolean;
  source: Placed;
  target: Placed;
  sourceX: number;
  targetX: number;
  sourceY: readonly [number, number];
  targetY: readonly [number, number];
  /**
   * The ways a straight rail could join the two stations, for each flip of the source and of
   * the target (`source.flip * 2 + target.flip`): bits for a target to the right, to the left,
   * below and above. A way is open when no node of either zone stands on it.
   */
  open: readonly [number, number, number, number];
  sourceFree: readonly [number, number];
  targetFree: readonly [number, number];
  fromIdx: number;
  toIdx: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface Anchor {
  idx: number;
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
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q > 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, ax - left) &&
    clip(dx, right - ax) &&
    clip(-dy, ay - top) &&
    clip(dy, bottom - ay) &&
    t0 + 1e-12 < t1
  );
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

const crossingWeight = (l: BlockLink, preserveFlow: boolean): number =>
  preserveFlow
    ? l.role === 'primary'
      ? 1.2
      : l.role === 'return'
        ? 0.7
        : 0.5
    : l.role === 'primary'
      ? 1
      : l.role === 'return'
        ? 0.85
        : 0.7;

const throughWeight = (l: BlockLink, preserveFlow: boolean): number =>
  preserveFlow
    ? l.role === 'primary'
      ? 1.2
      : l.role === 'return'
        ? 0.75
        : 0.6
    : l.role === 'primary'
      ? 1
      : l.role === 'return'
        ? 0.8
        : 0.75;

function shapeCost(l: BlockLink, preserveFlow: boolean, ctx?: FlowContext): number {
  const dx = l.bx - l.ax;
  const length = Math.hypot(dx, l.by - l.ay);
  if (l.role === 'return') {
    // Return/feedback links flow right-to-left naturally and should not distort forward zones.
    return offStraight(l) * 0.6 + length * 0.15;
  }
  if (l.role === 'static') {
    const lengthScale = l.auxTouch ? 0.35 : 0.05;
    const straightScale = l.auxTouch ? 1.0 : 0.3;
    return offStraight(l) * straightScale + length * lengthScale;
  }
  const backward = isCrossRow(ctx, l.source.block.id, l.target.block.id)
    ? 0
    : preserveFlow
      ? dx <= 0
        ? 2200 + -dx * 4.0
        : dx < 40
          ? (40 - dx) * 10
          : 0
      : dx < -30
        ? 450 + -dx * 0.45
        : dx < 0
          ? 120
          : 0;
  return (
    offStraight(l) * (preserveFlow ? 2.5 : OFF_STRAIGHT_WEIGHT) +
    // Every unit of a link counts, and counts again past a comfortable length. Counting only
    // the part past that length left the search with no reason to bring zones together.
    length +
    Math.max(0, length - LONG_LINK) +
    backward
  );
}

/** How far the link runs up or down beyond what it runs to the right (zero for return/shortcut links). */
function offFlow(l: BlockLink): number {
  if (l.role === 'return') return 0;
  if (l.role === 'static' && !l.auxTouch) return 0;
  const raw = Math.max(0, Math.abs(l.by - l.ay) - Math.max(0, l.bx - l.ax));
  return l.role === 'static' ? raw * 0.25 : raw;
}

function crossingCost(s: BlockLink, t: BlockLink, preserveFlow: boolean): number {
  if (s.maxX < t.minX || t.maxX < s.minX || s.maxY < t.minY || t.maxY < s.minY) return 0;
  const shares =
    s.fromIdx === t.fromIdx ||
    s.fromIdx === t.toIdx ||
    s.toIdx === t.fromIdx ||
    s.toIdx === t.toIdx;
  return !shares && properlyCross(s, t)
    ? CROSSING_COST * Math.min(crossingWeight(s, preserveFlow), crossingWeight(t, preserveFlow))
    : 0;
}

/**
 * What a zone in the way of both ways round with one bend costs a link: about what the bends
 * a rail needs to get round it cost, to which the way round its nearer side is added.
 */
const WALL_COST = 260;
/** How far outside a zone a rail runs round it. */
const WALL_MARGIN = 12;
/** What a zone in one of the two ways with one bend costs: when the straight line runs through it, and when not. */
const ONE_WAY_THROUGH_COST = 160;
const ONE_WAY_COST = 95;

/**
 * What zone `p`, which is at neither end of link `l`, costs it. A rail takes right-angled
 * ways, so a zone can be in its way without the straight line between the stations touching
 * it: of the two ways with one bend, level first or upright first, it can block one or both.
 * Blocking both, it stands between the stations like a wall, and the rail goes round it. The
 * amounts are estimates of what the router then pays, not counted from a route.
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
        ? 2 *
          Math.min(
            Math.min(l.ay, l.by) - top + WALL_MARGIN,
            bottom + WALL_MARGIN - Math.max(l.ay, l.by),
          )
        : 2 *
          Math.min(
            Math.min(l.ax, l.bx) - left + WALL_MARGIN,
            right + WALL_MARGIN - Math.max(l.ax, l.bx),
          );
    return WALL_COST + Math.max(0, detour);
  }
  if (hitsL1 || hitsL2) {
    const through = runsThroughBox(l.ax, l.ay, l.bx, l.by, left, right, top, bottom);
    return through ? ONE_WAY_THROUGH_COST : ONE_WAY_COST;
  }
  return runsThroughBox(l.ax, l.ay, l.bx, l.by, left, right, top, bottom) ? THROUGH_COST : 0;
}

function throughCost(l: BlockLink, placed: readonly Placed[], preserveFlow: boolean): number {
  let total = 0;
  const w = throughWeight(l, preserveFlow);
  for (const p of placed) {
    if (p !== l.source && p !== l.target) total += zoneObstruction(l, p) * w;
  }
  return total;
}

/**
 * Counts how many `(link, intermediate zone)` pairs block BOTH 1-bend L-paths (`hitsL1 && hitsL2`),
 * each of which forces the orthogonal router into a 3-or-4-turn U-detour (`winding`).
 */
export function wallDetourCount(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  ctx?: FlowContext,
): number {
  let walls = 0;
  const pad = 3.5;
  for (const l of links) {
    if (isCrossRow(ctx, l.source.block.id, l.target.block.id)) continue;
    for (const p of placed) {
      if (p === l.source || p === l.target) continue;
      if (
        ctx?.wrapped &&
        ctx.rowOfBlock &&
        isCrossRow(ctx, l.source.block.id, p.block.id) &&
        isCrossRow(ctx, l.target.block.id, p.block.id)
      ) {
        continue;
      }
      const left = p.x - pad;
      const right = p.x + p.block.width + pad;
      const top = p.y - pad;
      const bottom = p.y + p.block.height + pad;
      if (l.maxX <= left || l.minX >= right || l.maxY <= top || l.minY >= bottom) continue;
      const hitsL1 = (l.ay > top && l.ay < bottom) || (l.bx > left && l.bx < right);
      const hitsL2 = (l.ax > left && l.ax < right) || (l.by > top && l.by < bottom);
      if (hitsL1 && hitsL2) walls++;
    }
  }
  return walls;
}

/** Counts primary inter-zone links whose directional exit/entry ports are blocked by sibling nodes. */
export function blockedPrimaryPorts(links: readonly BlockLink[], ctx?: FlowContext): number {
  let count = 0;
  for (const l of links) {
    if (l.role !== 'primary') continue;
    if (isCrossRow(ctx, l.source.block.id, l.target.block.id)) continue;
    const dx = l.bx - l.ax;
    const dy = l.by - l.ay;
    const open = l.open[l.source.flip * 2 + l.target.flip] ?? 0;
    const hOpen = (dx > 16 && (open & 1) !== 0) || (dx < -16 && (open & 2) !== 0);
    const vOpen = (dy > 36 && (open & 4) !== 0) || (dy < -36 && (open & 8) !== 0);
    if (!hOpen && !vOpen) count++;
  }
  return count;
}

/** Share of inter-zone links directed into the forward rightward 45-degree cone (`dx > 0 && dx >= |dy|`). */
export function rightwardShare(links: readonly BlockLink[], ctx?: FlowContext): number {
  let total = 0;
  let right = 0;
  for (const l of links) {
    if (isCrossRow(ctx, l.source.block.id, l.target.block.id)) continue;
    total++;
    const dx = l.bx - l.ax;
    if (dx > 0 && dx >= Math.abs(l.by - l.ay)) right++;
  }
  return total === 0 ? 1 : right / total;
}

export interface RoutingDefects {
  jogs: number;
  portWindings: number;
  primaryPortWindings: number;
  sharedCrossings: number;
  orthoPrimaryCrossings: number;
}

/**
 * Estimates orthogonal routing defects from station free-side masks and block bounding boxes:
 * - `jogs`: separated facing channels whose stations miss straight alignment by `0.5..120px`.
 * - `portWindings` / `primaryPortWindings`: links lacking any unobstructed 0-, 1-, or 2-turn channel.
 * - `sharedCrossings` / `orthoPrimaryCrossings`: polyline crossings on approximate orthogonal routes.
 */
export function estimateRoutingDefects(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  includePartialFacingJogs = false,
): RoutingDefects {
  let jogs = 0;
  let portWindings = 0;
  let primaryPortWindings = 0;

  const corridorClear = (
    l: BlockLink,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): boolean => {
    for (const p of placed) {
      if (p === l.source || p === l.target) continue;
      if (p.x < maxX && p.x + p.block.width > minX && p.y < maxY && p.y + p.block.height > minY) {
        return false;
      }
    }
    return true;
  };

  const polys: Array<ReadonlyArray<readonly [number, number]>> = [];

  for (const l of links) {
    const sf = l.sourceFree[l.source.flip] ?? 0;
    const tf = l.targetFree[l.target.flip] ?? 0;
    const sLeft = l.source.x;
    const sRight = sLeft + l.source.block.width;
    const sTop = l.source.y;
    const sBot = sTop + l.source.block.height;
    const tLeft = l.target.x;
    const tRight = tLeft + l.target.block.width;
    const tTop = l.target.y;
    const tBot = tTop + l.target.block.height;

    const minX = Math.min(l.ax, l.bx);
    const maxX = Math.max(l.ax, l.bx);
    const minY = Math.min(l.ay, l.by);
    const maxY = Math.max(l.ay, l.by);

    const hRight =
      sRight <= tLeft &&
      (sf & 1) !== 0 &&
      (tf & 2) !== 0 &&
      corridorClear(l, sRight, tLeft, minY - 2, maxY + 2);
    const hLeft =
      tRight <= sLeft &&
      (sf & 2) !== 0 &&
      (tf & 1) !== 0 &&
      corridorClear(l, tRight, sLeft, minY - 2, maxY + 2);
    const vDown =
      sBot <= tTop &&
      (sf & 4) !== 0 &&
      (tf & 8) !== 0 &&
      corridorClear(l, minX - 2, maxX + 2, sBot, tTop);
    const vUp =
      tBot <= sTop &&
      (sf & 8) !== 0 &&
      (tf & 4) !== 0 &&
      corridorClear(l, minX - 2, maxX + 2, tBot, sTop);

    const lHV =
      ((l.bx > sRight && (sf & 1) !== 0) || (l.bx < sLeft && (sf & 2) !== 0)) &&
      ((l.ay < tTop && (tf & 8) !== 0) || (l.ay > tBot && (tf & 4) !== 0)) &&
      corridorClear(l, minX, maxX, l.ay - 2, l.ay + 2) &&
      corridorClear(l, l.bx - 2, l.bx + 2, minY, maxY);
    const lVH =
      ((l.by > sBot && (sf & 4) !== 0) || (l.by < sTop && (sf & 8) !== 0)) &&
      ((l.ax < tLeft && (tf & 2) !== 0) || (l.ax > tRight && (tf & 1) !== 0)) &&
      corridorClear(l, l.ax - 2, l.ax + 2, minY, maxY) &&
      corridorClear(l, minX, maxX, l.by - 2, l.by + 2);

    const partialHRight =
      includePartialFacingJogs &&
      !hRight &&
      sRight <= tLeft &&
      ((sf & 1) !== 0 || (tf & 2) !== 0) &&
      corridorClear(l, sRight, tLeft, minY - 2, maxY + 2);
    const partialHLeft =
      includePartialFacingJogs &&
      !hLeft &&
      tRight <= sLeft &&
      ((sf & 2) !== 0 || (tf & 1) !== 0) &&
      corridorClear(l, tRight, sLeft, minY - 2, maxY + 2);

    if (hRight || hLeft || partialHRight || partialHLeft) {
      const apart = Math.abs(l.by - l.ay);
      if (apart >= 0.5 && apart <= 120) jogs++;
      if (hRight || hLeft) {
        if (apart < 0.5) {
          polys.push([
            [l.ax, l.ay],
            [l.bx, l.by],
          ]);
        } else {
          const midX = hRight ? (sRight + tLeft) / 2 : (tRight + sLeft) / 2;
          polys.push([
            [l.ax, l.ay],
            [midX, l.ay],
            [midX, l.by],
            [l.bx, l.by],
          ]);
        }
        continue;
      }
    }
    if (vDown || vUp) {
      const apart = Math.abs(l.bx - l.ax);
      if (apart >= 0.5 && apart <= 120) jogs++;
      if (apart < 0.5) {
        polys.push([
          [l.ax, l.ay],
          [l.bx, l.by],
        ]);
      } else {
        const midY = vDown ? (sBot + tTop) / 2 : (tBot + sTop) / 2;
        polys.push([
          [l.ax, l.ay],
          [l.ax, midY],
          [l.bx, midY],
          [l.bx, l.by],
        ]);
      }
      continue;
    }
    if (lHV) {
      polys.push([
        [l.ax, l.ay],
        [l.bx, l.ay],
        [l.bx, l.by],
      ]);
      continue;
    }
    if (lVH) {
      polys.push([
        [l.ax, l.ay],
        [l.ax, l.by],
        [l.bx, l.by],
      ]);
      continue;
    }

    const cTop =
      (sf & 8) !== 0 &&
      (tf & 8) !== 0 &&
      !(sTop > tTop && l.ax >= tLeft && l.ax <= tRight) &&
      !(tTop > sTop && l.bx >= sLeft && l.bx <= sRight) &&
      corridorClear(l, minX, maxX, Math.min(sTop, tTop) - 16, Math.max(sTop, tTop));
    const cBot =
      (sf & 4) !== 0 &&
      (tf & 4) !== 0 &&
      !(sBot < tBot && l.ax >= tLeft && l.ax <= tRight) &&
      !(tBot < sBot && l.bx >= sLeft && l.bx <= sRight) &&
      corridorClear(l, minX, maxX, Math.min(sBot, tBot), Math.max(sBot, tBot) + 16);
    const cLeft =
      (sf & 2) !== 0 &&
      (tf & 2) !== 0 &&
      !(sLeft > tLeft && l.ay >= tTop && l.ay <= tBot) &&
      !(tLeft > sLeft && l.by >= sTop && l.by <= sBot) &&
      corridorClear(l, Math.min(sLeft, tLeft) - 16, Math.max(sLeft, tLeft), minY, maxY);
    const cRight =
      (sf & 1) !== 0 &&
      (tf & 1) !== 0 &&
      !(sRight < tRight && l.ay >= tTop && l.ay <= tBot) &&
      !(tRight < sRight && l.by >= sTop && l.by <= sBot) &&
      corridorClear(l, Math.min(sRight, tRight), Math.max(sRight, tRight) + 16, minY, maxY);

    if (cTop || cBot) {
      const bridgeY = cTop ? Math.min(sTop, tTop) - 14 : Math.max(sBot, tBot) + 14;
      polys.push([
        [l.ax, l.ay],
        [l.ax, bridgeY],
        [l.bx, bridgeY],
        [l.bx, l.by],
      ]);
    } else if (cLeft || cRight) {
      const bridgeX = cLeft ? Math.min(sLeft, tLeft) - 14 : Math.max(sRight, tRight) + 14;
      polys.push([
        [l.ax, l.ay],
        [bridgeX, l.ay],
        [bridgeX, l.by],
        [l.bx, l.by],
      ]);
    } else {
      portWindings++;
      if (l.role === 'primary') primaryPortWindings++;
      const exitY = l.by < l.ay ? sTop - 14 : sBot + 14;
      const enterX = l.ax < l.bx ? tLeft - 14 : tRight + 14;
      polys.push([
        [l.ax, l.ay],
        [l.ax, exitY],
        [enterX, exitY],
        [enterX, l.by],
        [l.bx, l.by],
      ]);
    }
  }

  let sharedCrossings = 0;
  let orthoPrimaryCrossings = 0;
  const segsProperlyCross = (
    p1: readonly [number, number],
    p2: readonly [number, number],
    q1: readonly [number, number],
    q2: readonly [number, number],
  ): boolean => {
    const s1 = (p2[0] - p1[0]) * (q1[1] - p1[1]) - (p2[1] - p1[1]) * (q1[0] - p1[0]);
    const s2 = (p2[0] - p1[0]) * (q2[1] - p1[1]) - (p2[1] - p1[1]) * (q2[0] - p1[0]);
    if (s1 * s2 >= -1e-6) return false;
    const s3 = (q2[0] - q1[0]) * (p1[1] - q1[1]) - (q2[1] - q1[1]) * (p1[0] - q1[0]);
    const s4 = (q2[0] - q1[0]) * (p2[1] - q1[1]) - (q2[1] - q1[1]) * (p2[0] - q1[0]);
    return s3 * s4 < -1e-6;
  };

  for (let i = 0; i < links.length; i++) {
    const la = links[i];
    const pa = polys[i];
    if (!la || !pa) continue;
    for (let j = i + 1; j < links.length; j++) {
      const lb = links[j];
      const pb = polys[j];
      if (!lb || !pb) continue;
      const shared =
        (la.fromIdx === lb.fromIdx ? 1 : 0) +
        (la.fromIdx === lb.toIdx ? 1 : 0) +
        (la.toIdx === lb.fromIdx ? 1 : 0) +
        (la.toIdx === lb.toIdx ? 1 : 0);
      if (shared === 2) continue;
      if (shared === 0 && (la.role !== 'primary' || lb.role !== 'primary')) continue;
      let hits = 0;
      for (let sa = 0; sa + 1 < pa.length; sa++) {
        const a1 = pa[sa];
        const a2 = pa[sa + 1];
        if (!a1 || !a2) continue;
        for (let sb = 0; sb + 1 < pb.length; sb++) {
          const b1 = pb[sb];
          const b2 = pb[sb + 1];
          if (!b1 || !b2) continue;
          if (segsProperlyCross(a1, a2, b1, b2)) hits++;
        }
      }
      if (hits > 0) {
        if (shared === 1) sharedCrossings += hits;
        else orthoPrimaryCrossings += hits;
      } else if (shared === 1) {
        // Detect spread-rail inversions where two links sharing one station fan out in the same
        // quadrant with the closer-X target turning further vertically than the further-X target.
        const sameFrom = la.fromIdx === lb.fromIdx;
        const ux = sameFrom ? la.ax : la.bx;
        const uy = sameFrom ? la.ay : la.by;
        const v1x = sameFrom ? la.bx : la.ax;
        const v1y = sameFrom ? la.by : la.ay;
        const v2x = sameFrom ? lb.bx : lb.ax;
        const v2y = sameFrom ? lb.by : lb.ay;
        const dx1 = v1x - ux;
        const dx2 = v2x - ux;
        const dy1 = v1y - uy;
        const dy2 = v2y - uy;
        if (dx1 * dx2 > 0 && Math.abs(dx1) > 40 && Math.abs(dx2) > 40 && dy1 * dy2 > 0) {
          if (
            (Math.abs(dx1) + 40 < Math.abs(dx2) && Math.abs(dy1) > Math.abs(dy2) + 24) ||
            (Math.abs(dx2) + 40 < Math.abs(dx1) && Math.abs(dy2) > Math.abs(dy1) + 24)
          ) {
            sharedCrossings++;
          }
        }
      }
    }
  }

  return { jogs, portWindings, primaryPortWindings, sharedCrossings, orthoPrimaryCrossings };
}

/** The width and the height of the rectangle around the whole arrangement. */
export function extent(placed: readonly Placed[]): { width: number; height: number } {
  if (placed.length === 0) return { width: 0, height: 0 };
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
function sizeCost(
  placed: readonly Placed[],
  preserveFlow: boolean,
): { spread: number; offFlowWeight: number } {
  const { width, height } = extent(placed);
  const narrow =
    (OFF_FLOW_NONE_ASPECT - width / Math.max(1, height)) /
    (OFF_FLOW_NONE_ASPECT - OFF_FLOW_FULL_ASPECT);
  const minFlow = preserveFlow ? 0.35 : 0;
  const ribbonExcess = preserveFlow ? Math.max(0, width - height * RIBBON_MAX_ASPECT) * 3.5 : 0;
  return {
    // The longer side of the canvas the arrangement needs: growing along the other side is
    // free, so the search fills the canvas instead of stretching into a strip.
    spread: Math.max(width, height * CANVAS_ASPECT) * 1.2 + ribbonExcess,
    offFlowWeight: OFF_FLOW_WEIGHT * Math.min(1, Math.max(minFlow, narrow)),
  };
}

function flowPenalty(placed: readonly Placed[], ctx?: FlowContext): number {
  if (!ctx?.preserveFlow) return 0;
  const { slots, slotOf, stagePairIdx, pendantPairIdx, corridorIdx } = ctx;
  slots.fill(undefined);
  if (ctx.placedSlots.length < placed.length) {
    ctx.placedSlots = new Int32Array(placed.length);
  }
  const { placedSlots } = ctx;
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i];
    if (!p) {
      placedSlots[i] = -1;
      continue;
    }
    const idx = slotOf.get(p.block.id);
    if (idx !== undefined) {
      slots[idx] = p;
      placedSlots[i] = idx;
    } else {
      placedSlots[i] = -1;
    }
  }

  let penalty = 0;
  for (let i = 0; i < stagePairIdx.length; i++) {
    const pair = stagePairIdx[i];
    if (!pair) continue;
    const u = slots[pair[0]];
    const v = slots[pair[1]];
    if (!u || !v) continue;
    if (isCrossRow(ctx, u.block.id, v.block.id)) continue;
    const overlap = u.x + u.block.width + ctx.horizontalClearance - v.x;
    if (overlap > 0) penalty += STAGE_OVERLAP_COST + overlap * 3.0;
  }
  for (let i = 0; i < pendantPairIdx.length; i++) {
    const pair = pendantPairIdx[i];
    if (!pair) continue;
    const u = slots[pair[0]];
    const v = slots[pair[1]];
    if (!u || !v) continue;
    if (isCrossRow(ctx, u.block.id, v.block.id)) continue;
    const leftDrift = u.x - v.x;
    if (leftDrift > 0) penalty += STAGE_OVERLAP_COST + leftDrift * 3.0;
  }
  for (let i = 0; i < corridorIdx.length; i++) {
    const c = corridorIdx[i];
    if (!c) continue;
    const ra = slots[c.a];
    const rb = slots[c.b];
    if (!ra || !rb) continue;
    if (isCrossRow(ctx, ra.block.id, rb.block.id)) continue;
    const ax = ra.x + ra.block.width / 2;
    const bx = rb.x + rb.block.width / 2;
    const minX = Math.min(ax, bx);
    const maxX = Math.max(ax, bx);
    const bandTop = Math.min(ra.y, rb.y);
    const bandBot = Math.max(ra.y + ra.block.height, rb.y + rb.block.height);
    for (let j = 0; j < placed.length; j++) {
      const rc = placed[j];
      const sIdx = placedSlots[j] ?? -1;
      if (!rc || rc === ra || rc === rb || (sIdx >= 0 && c.allowedSlots[sIdx] === 1)) continue;
      if (isCrossRow(ctx, ra.block.id, rc.block.id) || isCrossRow(ctx, rb.block.id, rc.block.id)) {
        continue;
      }
      const cx = rc.x + rc.block.width / 2;
      if (cx > minX && cx < maxX && rc.y < bandBot && rc.y + rc.block.height > bandTop) {
        penalty += LAYER_INTRUSION_COST;
      }
    }
  }
  return penalty;
}

/** The cost of the whole arrangement. */
export function linkCost(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  ctx?: FlowContext,
): number {
  const preserveFlow = ctx?.preserveFlow ?? false;
  const { spread, offFlowWeight } = sizeCost(placed, preserveFlow);
  let total = spread + flowPenalty(placed, ctx);
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s) continue;
    updateSegment(s);
    total +=
      shapeCost(s, preserveFlow, ctx) +
      offFlow(s) * offFlowWeight +
      throughCost(s, placed, preserveFlow);
    for (let j = 0; j < i; j++) {
      const t = links[j];
      if (t) total += crossingCost(s, t, preserveFlow);
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
  ctx?: FlowContext,
): number {
  const preserveFlow = ctx?.preserveFlow ?? false;
  const { spread, offFlowWeight } = sizeCost(placed, preserveFlow);
  let total = spread + flowPenalty(placed, ctx);
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s) continue;
    if (!touches(s, a, b)) {
      const w = throughWeight(s, preserveFlow);
      total += zoneObstruction(s, a) * w;
      if (b) total += zoneObstruction(s, b) * w;
    } else if (refreshTouching) {
      updateSegment(s);
    }
    total += offFlow(s) * offFlowWeight;
  }
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (!s || !touches(s, a, b)) continue;
    total += shapeCost(s, preserveFlow, ctx) + throughCost(s, placed, preserveFlow);
    for (let j = 0; j < links.length; j++) {
      const t = links[j];
      if (t && j !== i && (j > i || !touches(t, a, b))) total += crossingCost(s, t, preserveFlow);
    }
  }
  return total;
}

export function isClear(
  a: Placed,
  placed: readonly Placed[],
  horizontalClearance = HORIZONTAL_CLEARANCE,
  verticalClearance = VERTICAL_CLEARANCE,
): boolean {
  for (const b of placed) {
    if (b === a) continue;
    if (
      a.x < b.x + b.block.width + horizontalClearance &&
      b.x < a.x + a.block.width + horizontalClearance &&
      a.y < b.y + b.block.height + verticalClearance &&
      b.y < a.y + a.block.height + verticalClearance
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
  ctx?: FlowContext,
  horizontalClearance = HORIZONTAL_CLEARANCE,
  verticalClearance = VERTICAL_CLEARANCE,
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
  const clear =
    isClear(a, placed, horizontalClearance, verticalClearance) &&
    (!other || isClear(other, placed, horizontalClearance, verticalClearance));
  a.x = prevAX;
  a.y = prevAY;
  a.flip = prevAFlip;
  if (other) {
    other.x = prevOX;
    other.y = prevOY;
    other.flip = prevOFlip;
  }
  if (!clear) return Number.NaN;

  const before = movedCost(links, placed, a, other, false, ctx);
  a.x = nextAX;
  a.y = nextAY;
  a.flip = nextAFlip;
  if (other) {
    other.x = nextOX;
    other.y = nextOY;
    other.flip = nextOFlip;
  }
  return movedCost(links, placed, a, other, true, ctx) - before;
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

function freeSideMask(block: Block, id: string, flip: 0 | 1): number {
  let bits = 0;
  for (const side of [0, 1, 2, 3] as const) {
    if (isFreeSide(block, id, side, flip)) bits |= 1 << side;
  }
  return bits;
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
export function buildLinks(
  doc: DavDocument,
  placed: readonly Placed[],
  flow: FlowAnalysis = analyzeFlow(doc),
): BlockLink[] {
  const anchorOf = new Map<string, Anchor>();
  const blockOf = new Map<string, string>();
  let nextIdx = 0;
  for (const p of placed) {
    for (const [id, r] of p.block.nodes) {
      anchorOf.set(id, {
        idx: nextIdx++,
        p,
        x: r.x + r.width / 2,
        y: [r.y + STATION_CENTER, flippedY(p.block, r, id) + STATION_CENTER],
      });
      blockOf.set(id, p.block.id);
    }
  }
  return flow.connections.flatMap((e) => {
    const a = anchorOf.get(e.from);
    const b = anchorOf.get(e.to);
    if (!a || !b || a.p === b.p) return [];
    const auxTouch = flow.auxiliaryZones.has(a.p.block.id) || flow.auxiliaryZones.has(b.p.block.id);
    return [
      {
        role: isLateAuxAlert(e, flow, blockOf) ? 'return' : e.role,
        auxTouch,
        source: a.p,
        target: b.p,
        sourceX: a.x,
        targetX: b.x,
        sourceY: a.y,
        targetY: b.y,
        from: e.from,
        to: e.to,
        fromIdx: a.idx,
        toIdx: b.idx,
        open: openWays(a.p.block, e.from, b.p.block, e.to),
        sourceFree: [freeSideMask(a.p.block, e.from, 0), freeSideMask(a.p.block, e.from, 1)],
        targetFree: [freeSideMask(b.p.block, e.to, 0), freeSideMask(b.p.block, e.to, 1)],
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

/**
 * The stations at the ends of the link are level, or one is straight above the other, and
 * nothing stands between them: a rail can join them in one straight line.
 */
function isStraight(l: BlockLink, placed: readonly Placed[]): boolean {
  if (Math.abs(l.ay - l.by) >= 0.5 && Math.abs(l.ax - l.bx) >= 0.5) return false;
  for (const p of placed) {
    if (p !== l.source && p !== l.target) {
      if (runsThrough(l, p)) return false;
      const pTop = p.y - (p.block.groups.size === 0 ? p.block.loopRoom : 0);
      const pBot = p.y + p.block.height;
      if (
        Math.abs(l.ay - l.by) < 0.5 &&
        l.maxX > p.x - RAIL_CLEARANCE &&
        l.minX < p.x + p.block.width + RAIL_CLEARANCE &&
        l.ay > pTop - RAIL_CLEARANCE &&
        l.ay < pBot + RAIL_CLEARANCE
      ) {
        return false;
      }
      if (
        Math.abs(l.ax - l.bx) < 0.5 &&
        l.maxY > pTop - RAIL_CLEARANCE &&
        l.minY < pBot + RAIL_CLEARANCE &&
        l.ax > p.x - RAIL_CLEARANCE &&
        l.ax < p.x + p.block.width + RAIL_CLEARANCE
      ) {
        return false;
      }
      continue;
    }
    for (const [id, r] of p.block.nodes) {
      if (id === l.from || id === l.to) continue;
      const room = p.block.nodeLoopRoom.get(id) ?? 0;
      const x = p.x + r.x;
      const y = p.y + (p.flip ? flippedY(p.block, r, id) : r.y) - room;
      if (l.maxX > x && l.minX < x + r.width && l.maxY > y && l.minY < y + r.height + room) {
        return false;
      }
    }
  }
  return true;
}

export function straightLinks(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  a?: Placed,
  b?: Placed,
): number {
  let count = 0;
  for (const l of links) {
    if (
      (!a ||
        l.source === a ||
        l.target === a ||
        (b !== undefined && (l.source === b || l.target === b))) &&
      isStraight(l, placed)
    ) {
      count++;
    }
  }
  return count;
}

export function diagramCrossingPenalty(
  doc: DavDocument,
  layout: Layout,
  flow: FlowAnalysis,
  preserveFlow: boolean,
): number {
  const total = countCrossings(doc, layout);
  if (total === 0) return 0;
  if (!preserveFlow) return total * DIAGRAM_CROSSING_COST;
  return total * DIAGRAM_CROSSING_COST + primaryCrossingsOf(flow.connections, layout) * 440;
}

export function countBackwardPrimary(links: readonly BlockLink[], ctx?: FlowContext): number {
  let cnt = 0;
  for (const l of links) {
    if (l.role !== 'primary') continue;
    if (isCrossRow(ctx, l.source.block.id, l.target.block.id)) continue;
    if (l.bx <= l.ax) cnt++;
  }
  return cnt;
}

export interface ArrangementScoreOptions {
  mode?: 'full' | 'staged' | 'intrusion' | 'flip';
  layout?: Layout;
  preserveFlowOverride?: boolean;
  /** Used by `'intrusion'` mode. */
  intrusions?: number;
  /** Used by `'flip'` and `'full'` modes. */
  entryMask?: Uint8Array;
  /** Used by `'full'` mode. */
  columnsCount?: number;
  hasNestedGroups?: boolean;
  allFlippable?: boolean;
  firstAuxIdx?: number;
}

/**
 * Unified arrangement-level objective evaluator consolidating full candidate scoring (`'full'`),
 * staged-pipeline scoring (`'staged'`), corridor-intrusion cleanup (`'intrusion'`), and
 * flip/slack-rank evaluation (`'flip'`).
 */
export function evaluateArrangementScore(
  doc: DavDocument,
  placed: readonly Placed[],
  links: readonly BlockLink[],
  flow: FlowAnalysis,
  flowCtx: FlowContext,
  opts: ArrangementScoreOptions = {},
): number {
  refreshSegments(links);
  const mode = opts.mode ?? 'full';
  const candLayout = opts.layout ?? toLayout(placed);

  if (mode === 'flip') {
    const preserveCrossing = opts.preserveFlowOverride ?? flowCtx.preserveFlow;
    let obj =
      linkCost(links, placed, flowCtx) +
      diagramCrossingPenalty(doc, candLayout, flow, preserveCrossing);
    if (opts.entryMask) {
      for (let i = 0; i < placed.length; i++) {
        if (opts.entryMask[i] === 1 && placed[i]?.flip === 1) obj += 120;
      }
    }
    return obj;
  }

  if (mode === 'intrusion') {
    const ext = extent(placed);
    const a = ext.width / Math.max(1, ext.height);
    const tallAspectPen = a < 1.35 ? (1.35 - a) * 10000 : 0;
    const intrusions = opts.intrusions ?? 0;
    return (
      linkCost(links, placed, flowCtx) +
      diagramCrossingPenalty(doc, candLayout, flow, opts.preserveFlowOverride ?? true) +
      intrusions * 4200 +
      tallAspectPen
    );
  }

  if (mode === 'staged') {
    const ext = extent(placed);
    const asp = ext.width / Math.max(1, ext.height);
    const portraitPen = asp < 1.2 ? (1.2 - asp) * 35000 : 0;
    return (
      linkCost(links, placed, flowCtx) +
      diagramCrossingPenalty(
        doc,
        candLayout,
        flow,
        opts.preserveFlowOverride ?? flowCtx.preserveFlow,
      ) +
      portraitPen -
      straightLinks(links, placed) * STRAIGHT_WORTH
    );
  }

  const layoutBounds = enclosingRect([
    ...Object.values(candLayout.nodes),
    ...Object.values(candLayout.groups),
  ]);
  const layoutAsp = layoutBounds.width / Math.max(1, layoutBounds.height);
  const ext = extent(placed);
  const asp = ext.width / Math.max(1, ext.height);
  const connectedCount = placed.length;
  const minAsp = connectedCount >= 7 ? 1.28 : 1.08;
  const portraitPen =
    flowCtx.preserveFlow && (asp < minAsp || layoutAsp < 1.08)
      ? Math.max(minAsp - asp, 1.08 - layoutAsp) * 35000
      : 0;
  const columnsCount = opts.columnsCount ?? 0;
  const allFlippable = opts.allFlippable ?? false;
  const firstAuxIdx = opts.firstAuxIdx ?? -1;
  const hasNestedGroups = opts.hasNestedGroups ?? false;

  const minWideAsp = columnsCount >= 4 ? 2.28 : 2.05;
  const minNoAuxAsp = columnsCount >= 4 ? 2.48 : 1.85;
  const clampedAsp = Math.max(1.5, layoutAsp);
  const underTwoPen =
    flowCtx.preserveFlow && (allFlippable || firstAuxIdx < 0)
      ? firstAuxIdx >= 0
        ? clampedAsp < minWideAsp
          ? (minWideAsp - clampedAsp) * 20000
          : 0
        : clampedAsp < minNoAuxAsp
          ? (minNoAuxAsp - clampedAsp) * 18000
          : 0
      : 0;
  let entryPen = 0;
  if (opts.entryMask) {
    for (let i = 0; i < placed.length; i++) {
      if (opts.entryMask[i] === 1 && placed[i]?.flip === 1) entryPen += 120;
    }
  }

  let primaryThroughPen = 0;
  if (flowCtx.preserveFlow && firstAuxIdx >= 0 && !hasNestedGroups) {
    for (const l of links) {
      if (isCrossRow(flowCtx, l.source.block.id, l.target.block.id)) continue;
      if (l.role !== 'return') {
        const len = Math.hypot(l.bx - l.ax, l.by - l.ay);
        if (len > 1900) primaryThroughPen += (len - 1900) * 1.5;
      }
      if (l.role !== 'primary') continue;
      for (const p of placed) {
        if (p !== l.source && p !== l.target && runsThrough(l, p)) primaryThroughPen += 120;
      }
    }
  }
  const rShare = flowCtx.preserveFlow ? rightwardShare(links, flowCtx) : 1;
  const lowRightPen =
    flowCtx.preserveFlow && connectedCount <= 6 && rShare < 0.5 ? (0.5 - rShare) * 25000 : 0;
  const needDefects =
    flowCtx.preserveFlow && connectedCount <= 6 && (hasNestedGroups || firstAuxIdx >= 0);
  const defects = needDefects
    ? estimateRoutingDefects(links, placed)
    : {
        jogs: 0,
        portWindings: 0,
        primaryPortWindings: 0,
        sharedCrossings: 0,
        orthoPrimaryCrossings: 0,
      };
  const auxPriCrossExtra =
    flowCtx.preserveFlow && firstAuxIdx >= 0 && connectedCount <= 6
      ? primaryCrossingsOf(flow.connections, candLayout) * 350
      : 0;
  const nestedOrthoPen = hasNestedGroups
    ? defects.orthoPrimaryCrossings * 900 +
      defects.sharedCrossings * 450 +
      defects.jogs * 360 +
      defects.primaryPortWindings * 260
    : defects.portWindings * 200;
  const wallPen = flowCtx.preserveFlow
    ? wallDetourCount(links, placed, flowCtx) * (hasNestedGroups ? 2800 : 800) +
      primaryThroughPen +
      auxPriCrossExtra +
      (firstAuxIdx < 0 ? blockedPrimaryPorts(links, flowCtx) * 430 : 0) +
      lowRightPen +
      nestedOrthoPen
    : 0;

  let stageOverlapExtra = 0;
  if (flowCtx.preserveFlow) {
    const byId = new Map(placed.map((p) => [p.block.id, p]));
    for (const [za, zb] of flowCtx.stagePairs) {
      if (isCrossRow(flowCtx, za, zb)) continue;
      const u = byId.get(za);
      const v = byId.get(zb);
      if (u && v && u.x + u.block.width + HORIZONTAL_CLEARANCE > v.x) {
        stageOverlapExtra += 6000;
      }
    }
    if (connectedCount >= 7) {
      const rectMap = new Map(
        placed.map((p) => [
          p.block.id,
          { x: p.x, y: p.y, width: p.block.width, height: p.block.height },
        ]),
      );
      stageOverlapExtra +=
        countCorridorIntrusions(
          flowCtx.corridors,
          rectMap,
          flowCtx.wrapped ? flowCtx.rowOfBlock : undefined,
        ) *
          4200 +
        primaryCrossingsOf(flow.connections, candLayout) * 420;
    }
  }

  const sparsePen = !flowCtx.preserveFlow
    ? (() => {
        const area = placed.reduce((s, p) => s + p.block.width * p.block.height, 0);
        const fill = area / Math.max(1, ext.width * ext.height);
        return fill < 0.54 ? (0.54 - fill) * 12000 : 0;
      })()
    : 0;

  return (
    linkCost(links, placed, flowCtx) +
    diagramCrossingPenalty(doc, candLayout, flow, flowCtx.preserveFlow) +
    entryPen +
    wallPen +
    sparsePen +
    stageOverlapExtra +
    portraitPen +
    underTwoPen -
    straightLinks(links, placed) * STRAIGHT_WORTH
  );
}

export interface FastCrossingEvaluator {
  readonly segCount: number;
  readonly totalNodes: number;
  syncAndCountCrossings(placed: readonly Placed[]): { totalCross: number; priCross: number };
  countIntrusions(
    placed: readonly Placed[],
    corridors: readonly PrimaryCorridor[],
    rowOfBlock?: ReadonlyMap<string, number>,
  ): number;
}

/**
 * Pre-indexes nodes and segments into typed arrays so coordinate probes avoid
 * `toLayout`/`synthesizedConnections` allocations and precompute intra-zone crossings once.
 */
export function createFastCrossingEvaluator(
  placed: readonly Placed[],
  docLinks: readonly Link[],
  flow: FlowAnalysis,
): FastCrossingEvaluator {
  const nodeToIdx = new Map<string, number>();
  const nodeBlockIdx: number[] = [];
  const nodeRelX: number[] = [];
  const nodeRelY0: number[] = [];
  const nodeRelY1: number[] = [];
  placed.forEach((p, pIdx) => {
    for (const [id, r] of p.block.nodes) {
      nodeToIdx.set(id, nodeBlockIdx.length);
      nodeBlockIdx.push(pIdx);
      nodeRelX.push(r.x + r.width / 2);
      nodeRelY0.push(r.y + STATION_CENTER);
      nodeRelY1.push(flippedY(p.block, r, id) + STATION_CENTER);
    }
  });
  const totalNodes = nodeBlockIdx.length;
  const nBlock = new Int32Array(nodeBlockIdx);
  const nRelX = new Float64Array(nodeRelX);
  const nRelY0 = new Float64Array(nodeRelY0);
  const nRelY1 = new Float64Array(nodeRelY1);
  const blockLeft = new Float64Array(placed.length);
  const blockTop = new Float64Array(placed.length);

  const segUList: number[] = [];
  const segVList: number[] = [];
  const segPriList: number[] = [];
  for (const [from, to] of docLinks) {
    const u = nodeToIdx.get(from);
    const v = nodeToIdx.get(to);
    if (u === undefined || v === undefined) continue;
    segUList.push(u);
    segVList.push(v);
    segPriList.push(flow.byPair.get(flowPairKey(from, to))?.role === 'primary' ? 1 : 0);
  }
  const segCount = segUList.length;
  const segU = new Int32Array(segUList);
  const segV = new Int32Array(segVList);
  const segPri = new Uint8Array(segPriList);
  const sAx = new Float64Array(segCount);
  const sAy = new Float64Array(segCount);
  const sBx = new Float64Array(segCount);
  const sBy = new Float64Array(segCount);
  const sMinX = new Float64Array(segCount);
  const sMaxX = new Float64Array(segCount);
  const sMinY = new Float64Array(segCount);
  const sMaxY = new Float64Array(segCount);

  const syncSegCoords = (curPlaced: readonly Placed[]) => {
    let minPX = Number.POSITIVE_INFINITY;
    let minPY = Number.POSITIVE_INFINITY;
    for (let i = 0; i < curPlaced.length; i++) {
      const p = curPlaced[i];
      if (!p) continue;
      if (p.x < minPX) minPX = p.x;
      if (p.y < minPY) minPY = p.y;
    }
    for (let i = 0; i < curPlaced.length; i++) {
      const p = curPlaced[i];
      if (!p) continue;
      blockLeft[i] = Math.round(p.x - minPX + ORIGIN.x);
      blockTop[i] = Math.round(p.y - minPY + ORIGIN.y);
    }
    for (let m = 0; m < segCount; m++) {
      const u = segU[m] ?? 0;
      const v = segV[m] ?? 0;
      const bu = nBlock[u] ?? 0;
      const bv = nBlock[v] ?? 0;
      const flipU = curPlaced[bu]?.flip === 1;
      const flipV = curPlaced[bv]?.flip === 1;
      const ax = (blockLeft[bu] ?? 0) + (nRelX[u] ?? 0);
      const ay = (blockTop[bu] ?? 0) + ((flipU ? nRelY1[u] : nRelY0[u]) ?? 0);
      const bx = (blockLeft[bv] ?? 0) + (nRelX[v] ?? 0);
      const by = (blockTop[bv] ?? 0) + ((flipV ? nRelY1[v] : nRelY0[v]) ?? 0);
      sAx[m] = ax;
      sAy[m] = ay;
      sBx[m] = bx;
      sBy[m] = by;
      sMinX[m] = Math.min(ax, bx);
      sMaxX[m] = Math.max(ax, bx);
      sMinY[m] = Math.min(ay, by);
      sMaxY[m] = Math.max(ay, by);
    }
  };

  const segsCross = (i: number, j: number): boolean => {
    if (
      (sMaxX[i] ?? 0) <= (sMinX[j] ?? 0) ||
      (sMaxX[j] ?? 0) <= (sMinX[i] ?? 0) ||
      (sMaxY[i] ?? 0) <= (sMinY[j] ?? 0) ||
      (sMaxY[j] ?? 0) <= (sMinY[i] ?? 0)
    ) {
      return false;
    }
    const ax = sAx[i] ?? 0;
    const ay = sAy[i] ?? 0;
    const dx1 = (sBx[i] ?? 0) - ax;
    const dy1 = (sBy[i] ?? 0) - ay;
    const tax = sAx[j] ?? 0;
    const tay = sAy[j] ?? 0;
    const tbx = sBx[j] ?? 0;
    const tby = sBy[j] ?? 0;
    const s1 = dx1 * (tay - ay) - dy1 * (tax - ax);
    const s2 = dx1 * (tby - ay) - dy1 * (tbx - ax);
    if (Math.sign(s1) * Math.sign(s2) >= 0) return false;
    const dx2 = tbx - tax;
    const dy2 = tby - tay;
    const s3 = dx2 * (ay - tay) - dy2 * (ax - tax);
    const s4 = dx2 * ((sBy[i] ?? 0) - tay) - dy2 * ((sBx[i] ?? 0) - tax);
    return Math.sign(s3) * Math.sign(s4) < 0;
  };

  syncSegCoords(placed);
  const hasNested = new Uint8Array(placed.length);
  for (let i = 0; i < placed.length; i++) {
    if ((placed[i]?.block.groups.size ?? 0) > 1) hasNested[i] = 1;
  }
  let intraCross = 0;
  let intraPriCross = 0;
  const pairIList: number[] = [];
  const pairJList: number[] = [];
  const pairBothPriList: number[] = [];
  if (totalNodes >= 4) {
    for (let i = 0; i < segCount; i++) {
      const ui = segU[i] ?? 0;
      const vi = segV[i] ?? 0;
      const bui = nBlock[ui] ?? 0;
      const sameBlockI = bui === (nBlock[vi] ?? 0);
      const priI = segPri[i] === 1;
      for (let j = i + 1; j < segCount; j++) {
        const uj = segU[j] ?? 0;
        const vj = segV[j] ?? 0;
        if (ui === uj || ui === vj || vi === uj || vi === vj) continue;
        const bothPri = priI && segPri[j] === 1;
        if (
          sameBlockI &&
          hasNested[bui] === 0 &&
          bui === (nBlock[uj] ?? 0) &&
          bui === (nBlock[vj] ?? 0)
        ) {
          if (segsCross(i, j)) {
            intraCross++;
            if (bothPri) intraPriCross++;
          }
        } else {
          pairIList.push(i);
          pairJList.push(j);
          pairBothPriList.push(bothPri ? 1 : 0);
        }
      }
    }
  }
  const pairI = new Int32Array(pairIList);
  const pairJ = new Int32Array(pairJList);
  const pairBothPri = new Uint8Array(pairBothPriList);
  const pairLen = pairI.length;

  const rectMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const p of placed) {
    rectMap.set(p.block.id, { x: p.x, y: p.y, width: p.block.width, height: p.block.height });
  }

  return {
    segCount,
    totalNodes,
    syncAndCountCrossings(curPlaced: readonly Placed[]): { totalCross: number; priCross: number } {
      syncSegCoords(curPlaced);
      let totalCross = intraCross;
      let priCross = intraPriCross;
      for (let k = 0; k < pairLen; k++) {
        if (segsCross(pairI[k] ?? 0, pairJ[k] ?? 0)) {
          totalCross++;
          if (pairBothPri[k] === 1) priCross++;
        }
      }
      return { totalCross, priCross };
    },
    countIntrusions(
      curPlaced: readonly Placed[],
      corridors: readonly PrimaryCorridor[],
      rowOfBlock?: ReadonlyMap<string, number>,
    ): number {
      for (const p of curPlaced) {
        const r = rectMap.get(p.block.id);
        if (r) {
          r.x = p.x;
          r.y = p.y;
        }
      }
      return countCorridorIntrusions(corridors, rectMap, rowOfBlock);
    },
  };
}

export function evaluateAnchoredObjective(
  evaluator: FastCrossingEvaluator,
  placed: readonly Placed[],
  links: readonly BlockLink[],
  flowCtx: FlowContext,
  backPriCount: number,
): number {
  const { totalCross, priCross } = evaluator.syncAndCountCrossings(placed);
  const intrusions = evaluator.countIntrusions(
    placed,
    flowCtx.corridors,
    flowCtx.wrapped ? flowCtx.rowOfBlock : undefined,
  );
  const e = extent(placed);
  const a = e.width / Math.max(1, e.height);
  const pPen = a < 1.28 ? (1.28 - a) * 35000 : 0;
  return (
    linkCost(links, placed, flowCtx) * 0.45 +
    totalCross * 420 +
    intrusions * 4200 +
    priCross * 700 +
    backPriCount * 8000 +
    pPen
  );
}
