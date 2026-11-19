import type { DavDocument } from '../model/types';
import {
  analyzeFlow,
  type FlowAnalysis,
  flowPairKey,
  type PrimaryCorridor,
  primaryCorridors,
  type TransitionRole,
} from './flow';
import { properlyCross, type Segment } from './links';
import { type Rect, STATION_CENTER } from './metrics';
import {
  type Block,
  flippedY,
  HORIZONTAL_CLEARANCE,
  LONG_LINK,
  type Placed,
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

export interface FlowContext {
  preserveFlow: boolean;
  zoneStage: ReadonlyMap<string, number>;
  auxiliaryZones: ReadonlySet<string>;
  stagePairs: ReadonlyArray<readonly [string, string]>;
  /** Pendant feedback branches (`za -> zb`) aligned under/above `za` without drifting upstream of `za`. */
  pendantPairs: ReadonlyArray<readonly [string, string]>;
  corridors: readonly PrimaryCorridor[];
  /** Pre-indexed block slots for zero-allocation `flowPenalty` checks in `anneal`. */
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

/** Builds stage progression and primary-corridor metadata for `zoneCost`. */
export function buildFlowContext(
  flow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
  preserveFlow: boolean,
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

function shapeCost(l: BlockLink, preserveFlow: boolean): number {
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
  const backward = preserveFlow
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
export function wallDetourCount(links: readonly BlockLink[], placed: readonly Placed[]): number {
  let walls = 0;
  const pad = 3.5;
  for (const l of links) {
    for (const p of placed) {
      if (p === l.source || p === l.target) continue;
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
export function blockedPrimaryPorts(links: readonly BlockLink[]): number {
  let count = 0;
  for (const l of links) {
    if (l.role !== 'primary') continue;
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
export function rightwardShare(links: readonly BlockLink[]): number {
  if (links.length === 0) return 1;
  let right = 0;
  for (const l of links) {
    const dx = l.bx - l.ax;
    if (dx > 0 && dx >= Math.abs(l.by - l.ay)) right++;
  }
  return right / links.length;
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
    const overlap = u.x + u.block.width + HORIZONTAL_CLEARANCE - v.x;
    if (overlap > 0) penalty += STAGE_OVERLAP_COST + overlap * 3.0;
  }
  for (let i = 0; i < pendantPairIdx.length; i++) {
    const pair = pendantPairIdx[i];
    if (!pair) continue;
    const u = slots[pair[0]];
    const v = slots[pair[1]];
    if (!u || !v) continue;
    const leftDrift = u.x - v.x;
    if (leftDrift > 0) penalty += STAGE_OVERLAP_COST + leftDrift * 3.0;
  }
  for (let i = 0; i < corridorIdx.length; i++) {
    const c = corridorIdx[i];
    if (!c) continue;
    const ra = slots[c.a];
    const rb = slots[c.b];
    if (!ra || !rb) continue;
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
      shapeCost(s, preserveFlow) +
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
    total += shapeCost(s, preserveFlow) + throughCost(s, placed, preserveFlow);
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
): boolean {
  for (const b of placed) {
    if (b === a) continue;
    if (
      a.x < b.x + b.block.width + horizontalClearance &&
      b.x < a.x + a.block.width + horizontalClearance &&
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
  ctx?: FlowContext,
  horizontalClearance = HORIZONTAL_CLEARANCE,
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
    isClear(a, placed, horizontalClearance) &&
    (!other || isClear(other, placed, horizontalClearance));
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
  let nextIdx = 0;
  for (const p of placed) {
    for (const [id, r] of p.block.nodes) {
      anchorOf.set(id, {
        idx: nextIdx++,
        p,
        x: r.x + r.width / 2,
        y: [r.y + STATION_CENTER, flippedY(p.block, r, id) + STATION_CENTER],
      });
    }
  }
  return flow.connections.flatMap((e) => {
    const a = anchorOf.get(e.from);
    const b = anchorOf.get(e.to);
    if (!a || !b || a.p === b.p) return [];
    const auxTouch = flow.auxiliaryZones.has(a.p.block.id) || flow.auxiliaryZones.has(b.p.block.id);
    const firstStep = flow.pairFirstStep.get(flowPairKey(e.from, e.to)) ?? 0;
    const isLateAuxAlert =
      e.role === 'primary' &&
      flow.auxiliaryZones.has(a.p.block.id) &&
      !flow.auxiliaryZones.has(b.p.block.id) &&
      firstStep >= 2 &&
      (flow.zoneStage.get(a.p.block.id) ?? 0) >= (flow.zoneStage.get(b.p.block.id) ?? 0);
    return [
      {
        role: isLateAuxAlert ? 'return' : e.role,
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
