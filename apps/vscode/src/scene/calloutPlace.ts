import { type Rect, rectOverlaps } from '../layout';
import { calloutRect, computePacketCalloutBox } from './callout';
import { expandRect, type Point, pointAt, type Rail, railBox, railLength } from './geometry';
import {
  type Bounds,
  boundsOfPoints,
  nearestRun,
  type Runs,
  reach,
  reachBounds,
  runsEnter,
  runsOf,
} from './railSamples';
import type { Packet } from './resolve';

/**
 * Where the callouts of a phase go: each takes the free place nearest its own rail, a little in
 * favor of the middle of the rail, where its numbered stop is.
 *
 * Three things a callout would rather not do, and does only where that brings it clearly closer:
 * lie across the border of a zone, use the cell of a node, and, least of all, be nearer another
 * line of the step than its own. A zone's name is closed altogether, but not the rest of the
 * strip it is written in.
 *
 * A callout with no free place within reach sits above the middle of its rail, whatever is
 * there (see `computePacketCalloutBox`). No sample or stress diagram has one.
 */

/** What the callouts of one step have around them. */
export interface CalloutSurroundings {
  /**
   * What no callout covers: the badge of every visible node, the station and labels of every
   * node the step is about, the name of every zone, and the label of every edge of the step.
   */
  closed: readonly Rect[];
  /**
   * What a callout stays out of when a place nearly as close exists: the whole cell of a node
   * the step is about.
   */
  cells: readonly Rect[];
  /**
   * Every group that is not dimmed. A callout would rather lie wholly inside or wholly outside
   * each of them.
   */
  zones: readonly Rect[];
  /**
   * Station and label bodies of dimmed nodes: a callout may cover them when forced, but prefers
   * adjacent free space when available.
   */
  dimmedBodies?: readonly Rect[];
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
/** How much nearer its own rail than any other packet's a callout must be. */
const OWN_RAIL_MARGIN = 24;
/** How much closer a place must be to be worth lying across a zone's border. */
const BORDER_COST = 12;
/**
 * What being nearer another line of the step than its own costs a place: a callout sits by
 * another line only where every place that is not costs more than this more, its distance from
 * the rail counted with what it pays for borders and cells. Counted as a cost rather than as a
 * rule, it takes one search, where a rule would take a second one after the first found nothing.
 */
const BY_OTHER_LINE_COST = 200;
/** How much closer a place must be to be worth using a node's cell. */
const CELL_COST = 12;
/** Soft penalty for covering a dimmed node when adjacent free space exists. */
const DIMMED_NODE_COST = 40;
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

/** Whether two rails run together all the way: the shorter never leaves the side of the longer. */
function alongside(a: readonly Point[], b: readonly Point[]): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.every((p) => long.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < OWN_RAIL_MARGIN));
}

/** The callout is clear of the zone, or wholly inside it. */
function respectsZone(rect: Rect, zone: Rect): boolean {
  if (!rectOverlaps(rect, expandRect(zone, ZONE_OUTSIDE_CLEARANCE))) return true;
  return (
    rect.x >= zone.x + ZONE_INSIDE_PAD &&
    rect.x + rect.width <= zone.x + zone.width - ZONE_INSIDE_PAD &&
    rect.y >= zone.y + ZONE_INSIDE_PAD &&
    rect.y + rect.height <= zone.y + zone.height - ZONE_INSIDE_PAD
  );
}

export function placePhaseCallouts(phase: readonly Packet[], around: CalloutSurroundings): void {
  for (const packet of phase) delete packet.calloutAt;
  const { closed, cells, zones, dimmedBodies = [] } = around;
  // Each rail sampled once, so that a packet's samples are the same array wherever they are used.
  const sampled = new Map<Rail, Point[]>();
  const sampleOf = (rail: Rail): Point[] => {
    let points = sampled.get(rail);
    if (!points) {
      points = samples(rail);
      sampled.set(rail, points);
    }
    return points;
  };
  const entries = phase
    .flatMap((packet, index) => {
      const box = computePacketCalloutBox(packet);
      return box ? [{ packet, index, size: calloutRect(box), own: sampleOf(packet.path) }] : [];
    })
    // The shortest rails first: they leave the least choice.
    .sort((a, b) => a.own.length - b.own.length || a.index - b.index);
  const rails = around.rails.map(sampleOf);
  // The bounds and the runs of each rail's samples, worked out once.
  const railBounds = new Map<readonly Point[], Bounds>();
  const boundsOfRail = (points: readonly Point[]): Bounds => {
    let bounds = railBounds.get(points);
    if (!bounds) {
      bounds = boundsOfPoints(points);
      railBounds.set(points, bounds);
    }
    return bounds;
  };
  const railRuns = new Map<readonly Point[], Runs>();
  const runsOfRail = (points: readonly Point[]): Runs => {
    let runs = railRuns.get(points);
    if (!runs) {
      runs = runsOf(points);
      railRuns.set(points, runs);
    }
    return runs;
  };
  const taken: Rect[] = [];

  for (const { packet, size, own } of entries) {
    // A packet on the same rail, such as a reply in the same phase, is no rival: nothing can be
    // nearer the one than the other. Their callouts only keep clear of each other.
    const rivals = entries
      .filter((e) => e.packet !== packet && !alongside(e.own, own))
      .map((e) => e.own);
    // Nor is any other line of the step to be nearer than its own, so that a callout is not
    // read as describing the line it happens to sit by, unless no place that is not is near.
    const others = rails.filter((points) => !alongside(points, own) && !rivals.includes(points));
    const ownRuns = runsOfRail(own);
    const middle = pointAt(packet.path, 0.5);
    const acrossBorder = (rect: Rect) => zones.some((zone) => !respectsZone(rect, zone));
    const inCell = (rect: Rect) => cells.some((cell) => rectOverlaps(rect, cell));
    const overDimmed = (rect: Rect) => dimmedBodies.some((body) => rectOverlaps(rect, body));
    /**
     * Whether a place is free: `apart` when it keeps every rule, `byOther` when it is free but
     * nearer another line of the step than its own, and `undefined` when it is not free.
     */
    const freedom = (rect: Rect): 'apart' | 'byOther' | undefined => {
      const padded = expandRect(rect, RAIL_CLEARANCE);
      const spaced = expandRect(rect, CALLOUT_CLEARANCE);
      if (closed.some((area) => rectOverlaps(rect, area))) return undefined;
      if (taken.some((other) => rectOverlaps(spaced, other))) return undefined;
      if (rails.some((points) => runsEnter(padded, runsOfRail(points)))) return undefined;
      const mine = nearestRun(rect, ownRuns);
      if (mine < OWN_RAIL_GAP) return undefined;
      /** Whether a rail comes nearer the place than `than`; its box is asked first. */
      const nearer = (points: readonly Point[], than: number): boolean =>
        reachBounds(rect, boundsOfRail(points)) < than &&
        nearestRun(rect, runsOfRail(points)) < than;
      if (rivals.some((points) => nearer(points, mine + OWN_RAIL_MARGIN))) return undefined;
      return others.some((points) => nearer(points, mine)) ? 'byOther' : 'apart';
    };
    /** What a place's distance from the middle of the rail adds to its distance from the rail. */
    const fromMiddle = (rect: Rect): number =>
      reach(rect, middle) * MIDDLE_WEIGHT +
      Math.hypot(rect.x + rect.width / 2 - middle.x, rect.y + rect.height / 2 - middle.y) *
        CENTER_WEIGHT;
    /** How good a place is: its distance, and what it costs to be there. */
    const cost = (rect: Rect): number =>
      nearestRun(rect, ownRuns) +
      fromMiddle(rect) +
      // Above its rail before below it, and either before beside it, when all else is equal.
      (middle.y >= rect.y + rect.height ? 0 : middle.y <= rect.y ? 0.5 : 1) +
      (acrossBorder(rect) ? BORDER_COST : 0) +
      (inCell(rect) ? CELL_COST : 0) +
      (overDimmed(rect) ? DIMMED_NODE_COST : 0);

    // A place nearer another line than its own is taken only when the best that is not would
    // be further away by more than BY_OTHER_LINE_COST.
    let best: { rect: Rect; cost: number } | undefined;
    let apart = true;
    const ownBounds = boundsOfRail(own);
    /**
     * Places this near the rail were looked at in a nearer reach already, or cost more than the
     * best place found then: either way none of them is better than the best.
     */
    let searched = 0;
    for (const limit of SEARCH_REACHES) {
      // A place no nearer than the best one costs is no better, whatever else it costs.
      const within = best ? Math.min(limit, best.cost) : limit;
      const tooFar = (gap: number): boolean =>
        gap > within || (best !== undefined && gap >= best.cost);
      const box = expandRect(railBox(packet.path), limit);
      const candidates: Array<{ rect: Rect; base: number }> = [];
      for (let y = box.y - size.height; y <= box.y + box.height; y += SEARCH_STEP) {
        for (let x = box.x - size.width; x <= box.x + box.width; x += SEARCH_STEP) {
          const rect = { x, y, width: size.width, height: size.height };
          // No nearer the rail than to the bounds of its samples, which is quicker to tell.
          if (tooFar(reachBounds(rect, ownBounds))) continue;
          const gap = nearestRun(rect, ownRuns);
          if (gap < OWN_RAIL_GAP || gap <= searched || tooFar(gap)) continue;
          candidates.push({ rect, base: gap + fromMiddle(rect) });
        }
      }
      searched = limit;
      // Nearest first; ties in reading order, to stay deterministic.
      candidates.sort((a, b) => a.base - b.base || a.rect.y - b.rect.y || a.rect.x - b.rect.x);
      for (const { rect, base } of candidates) {
        // No place further down the list can cost less than its distance alone.
        if (best && base >= best.cost) break;
        const free = freedom(rect);
        if (!free) continue;
        const total = cost(rect) + (free === 'byOther' ? BY_OTHER_LINE_COST : 0);
        if (!best || total < best.cost) {
          best = { rect, cost: total };
          apart = free === 'apart';
        }
      }
      // A place further out than this reach costs more than the one found.
      if (best && best.cost <= limit) break;
    }
    /** Free by the rules the place found keeps. */
    const isFree = (rect: Rect): boolean => {
      const free = freedom(rect);
      return free === 'apart' || (free === 'byOther' && !apart);
    };

    // Level with a callout of the same phase that is nearly level with it already.
    if (best) {
      const found = best;
      const level = taken
        .flatMap((other) => [other.y, other.y + other.height - size.height])
        .filter((y) => y !== found.rect.y && Math.abs(y - found.rect.y) <= LEVEL_REACH)
        .map((y) => ({ ...found.rect, y }))
        .filter((rect) => isFree(rect) && cost(rect) <= cost(found.rect) + LEVEL_COST)
        .sort((a, b) => cost(a) - cost(b))[0];
      if (level) best = { rect: level, cost: cost(level) };
      packet.calloutAt = { x: best.rect.x, y: best.rect.y };
    }
    taken.push(best?.rect ?? size);
  }
}
