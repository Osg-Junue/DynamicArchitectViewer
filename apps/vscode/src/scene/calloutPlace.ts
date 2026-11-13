import { type Rect, rectOverlaps } from '../layout';
import { calloutRect, computePacketCalloutBox } from './callout';
import { expandRect, type Point, pointAt, type Rail, railBox, railLength } from './geometry';
import type { Packet } from './resolve';

/**
 * Where the callouts of a phase go: each takes the free place nearest its own rail, a little in
 * favor of the middle of the rail, where its numbered stop is.
 *
 * Two things a callout would rather not do, and does only where that brings it clearly closer:
 * lie across the border of a zone, and use the cell of a node. The strip across the top of a
 * zone is closed altogether, so of a zone's borders only its sides and its bottom are crossed.
 *
 * A callout with no free place within reach sits above the middle of its rail, whatever is
 * there (see `computePacketCalloutBox`). No sample or stress diagram has one.
 */

/** What the callouts of one step have around them. */
export interface CalloutSurroundings {
  /**
   * What no callout covers: the station, badge and labels of every visible node, the strip
   * across the top of every zone, which its name moves along with the camera, and the label of
   * every edge of the step.
   */
  closed: readonly Rect[];
  /**
   * What a callout stays out of when a place nearly as close exists: the whole cell of a node
   * the step is about, and the room around a dimmed node's station and labels.
   */
  cells: readonly Rect[];
  /** Every group. A callout would rather lie wholly inside or wholly outside each of them. */
  zones: readonly Rect[];
  /** Every rail drawn in the step: its edges, and the paths of its packets. */
  rails: readonly Rail[];
}

/** The closest a callout comes to its own rail: the packet passes between them. */
const OWN_RAIL_GAP = 22;
/** The closest a callout comes to any other rail; more than the radius of a numbered stop. */
const RAIL_CLEARANCE = 12;
const CALLOUT_CLEARANCE = 16;
const ZONE_OUTSIDE_CLEARANCE = 16;
const ZONE_INSIDE_PAD = 16;
/** Room a zone keeps for its name, which a callout inside it stays below. */
const ZONE_HEADER = 40;
/** How much nearer its own rail than any other packet's a callout must be. */
const OWN_RAIL_MARGIN = 24;
/** How much closer a place must be to be worth lying across a zone's border. */
const BORDER_COST = 30;
/** How much closer a place must be to be worth using a node's cell. */
const CELL_COST = 12;
/** What a unit of distance from the middle of the rail counts, next to one from the rail. */
const MIDDLE_WEIGHT = 0.2;
/**
 * Next to nothing, for how far the callout's own middle is from the middle of the rail: among
 * places that are otherwise as good, the one centered on the rail's middle is taken.
 */
const CENTER_WEIGHT = 0.01;
/**
 * How far from its rail a place is looked for: nearby first, since that is where most callouts
 * end up, and further out only when nothing nearer is free.
 */
const SEARCH_REACHES = [120, 300, 600];
const SEARCH_STEP = 10;
/** The most two samples of a rail lie apart: a callout is not to slip between them. */
const SAMPLE_SPACING = 10;
/** Callouts of one phase whose edges are this close are set level, if that costs this little. */
const LEVEL_REACH = 30;
const LEVEL_COST = 14;

function samples(rail: Rail): Point[] {
  const count = Math.max(8, Math.ceil(railLength(rail) / SAMPLE_SPACING));
  return Array.from({ length: count + 1 }, (_, i) => pointAt(rail, i / count));
}

/** Distance from a point to a rectangle; zero inside it. */
function reach(rect: Rect, p: Point): number {
  return Math.hypot(
    Math.max(rect.x - p.x, 0, p.x - (rect.x + rect.width)),
    Math.max(rect.y - p.y, 0, p.y - (rect.y + rect.height)),
  );
}

function nearest(rect: Rect, points: readonly Point[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const p of points) best = Math.min(best, reach(rect, p));
  return best;
}

/** Whether two rails run together all the way: the shorter never leaves the side of the longer. */
function alongside(a: readonly Point[], b: readonly Point[]): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every((p) => long.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < OWN_RAIL_MARGIN));
}

/** The callout is clear of the zone, or wholly inside it below its name. */
function respectsZone(rect: Rect, zone: Rect): boolean {
  if (!rectOverlaps(rect, expandRect(zone, ZONE_OUTSIDE_CLEARANCE))) return true;
  return (
    rect.x >= zone.x + ZONE_INSIDE_PAD &&
    rect.x + rect.width <= zone.x + zone.width - ZONE_INSIDE_PAD &&
    rect.y >= zone.y + ZONE_HEADER &&
    rect.y + rect.height <= zone.y + zone.height - ZONE_INSIDE_PAD
  );
}

export function placePhaseCallouts(phase: readonly Packet[], around: CalloutSurroundings): void {
  for (const packet of phase) delete packet.calloutAt;
  const { closed, cells, zones } = around;
  const entries = phase
    .flatMap((packet, index) => {
      const box = computePacketCalloutBox(packet);
      return box ? [{ packet, index, size: calloutRect(box), own: samples(packet.path) }] : [];
    })
    // The shortest rails first: they leave the least choice.
    .sort((a, b) => a.own.length - b.own.length || a.index - b.index);
  const rails = around.rails.map(samples);
  const taken: Rect[] = [];

  for (const { packet, size, own } of entries) {
    // A packet on the same rail, such as a reply in the same phase, is no rival: nothing can be
    // nearer the one than the other. Their callouts only keep clear of each other.
    const rivals = entries
      .filter((e) => e.packet !== packet && !alongside(e.own, own))
      .map((e) => e.own);
    const middle = pointAt(packet.path, 0.5);
    const acrossBorder = (rect: Rect) => zones.some((zone) => !respectsZone(rect, zone));
    const inCell = (rect: Rect) => cells.some((cell) => rectOverlaps(rect, cell));
    const isFree = (rect: Rect): boolean => {
      const padded = expandRect(rect, RAIL_CLEARANCE);
      const spaced = expandRect(rect, CALLOUT_CLEARANCE);
      if (closed.some((area) => rectOverlaps(rect, area))) return false;
      if (taken.some((other) => rectOverlaps(spaced, other))) return false;
      for (const points of rails) {
        for (const p of points) {
          if (
            p.x > padded.x &&
            p.x < padded.x + padded.width &&
            p.y > padded.y &&
            p.y < padded.y + padded.height
          ) {
            return false;
          }
        }
      }
      const mine = nearest(rect, own);
      return (
        mine >= OWN_RAIL_GAP &&
        !rivals.some((points) => nearest(rect, points) < mine + OWN_RAIL_MARGIN)
      );
    };
    /** What a place's distance from the middle of the rail adds to its distance from the rail. */
    const fromMiddle = (rect: Rect): number =>
      reach(rect, middle) * MIDDLE_WEIGHT +
      Math.hypot(rect.x + rect.width / 2 - middle.x, rect.y + rect.height / 2 - middle.y) *
        CENTER_WEIGHT;
    /** How good a place is: its distance, and what it costs to be there. */
    const cost = (rect: Rect): number =>
      nearest(rect, own) +
      fromMiddle(rect) +
      // Above its rail before below it, and either before beside it, when all else is equal.
      (middle.y >= rect.y + rect.height ? 0 : middle.y <= rect.y ? 0.5 : 1) +
      (acrossBorder(rect) ? BORDER_COST : 0) +
      (inCell(rect) ? CELL_COST : 0);

    let best: { rect: Rect; cost: number } | undefined;
    for (const limit of SEARCH_REACHES) {
      const box = expandRect(railBox(packet.path), limit);
      const candidates: Array<{ rect: Rect; base: number }> = [];
      for (let y = box.y - size.height; y <= box.y + box.height; y += SEARCH_STEP) {
        for (let x = box.x - size.width; x <= box.x + box.width; x += SEARCH_STEP) {
          const rect = { x, y, width: size.width, height: size.height };
          const gap = nearest(rect, own);
          if (gap < OWN_RAIL_GAP || gap > limit) continue;
          candidates.push({ rect, base: gap + fromMiddle(rect) });
        }
      }
      // Nearest first; ties in reading order, to stay deterministic.
      candidates.sort((a, b) => a.base - b.base || a.rect.y - b.rect.y || a.rect.x - b.rect.x);
      for (const { rect, base } of candidates) {
        // No place further down the list can cost less than its distance alone.
        if (best && base >= best.cost) break;
        if (!isFree(rect)) continue;
        const total = cost(rect);
        if (!best || total < best.cost) best = { rect, cost: total };
      }
      // A place further out than this reach costs more than the one found.
      if (best && best.cost <= limit) break;
    }

    // Level with a callout of the same phase that is nearly level with it already.
    if (best) {
      const found = best;
      const level = taken
        .flatMap((other) => [other.y, other.y + other.height - size.height])
        .filter((y) => y !== found.rect.y && Math.abs(y - found.rect.y) <= LEVEL_REACH)
        .map((y) => ({ ...found.rect, y }))
        .filter((rect) => isFree(rect) && cost(rect) <= found.cost + LEVEL_COST)
        .sort((a, b) => cost(a) - cost(b))[0];
      if (level) best = { rect: level, cost: cost(level) };
      packet.calloutAt = { x: best.rect.x, y: best.rect.y };
    }
    taken.push(best?.rect ?? size);
  }
}
