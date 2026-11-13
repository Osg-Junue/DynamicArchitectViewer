import { type Rect, rectOverlaps } from '../layout';
import { calloutRect, computePacketCalloutBox } from './callout';
import { expandRect, type Point, pointAt, pointInRect, type Rail, railLength } from './geometry';
import type { Packet } from './resolve';

/**
 * The last pass over a phase's callouts. `separatePhaseCallouts` puts each one above or below
 * its rail, which sends it far away when the rail is steep or lies deep inside zones. Here a
 * callout may take the nearest free spot on any side of its rail instead.
 *
 * A callout moves only when that fixes something: it hides a rail of the step, it sits nearer
 * another packet's rail than its own, or a spot much closer exists. The others stay exactly
 * where the first pass put them.
 */

/** What a callout must keep clear of in one step. */
export interface CalloutSurroundings {
  /**
   * What each visible node keeps to itself, clearance included: the whole cell of a node the
   * step is about, and the station and labels of a dimmed one.
   */
  nodeAreas: readonly Rect[];
  /** Every group. A callout lies wholly inside or wholly outside each of them. */
  zones: readonly Rect[];
  /** Every rail drawn in the step: its edges, and the paths of its packets. */
  rails: readonly Rail[];
}

/** A callout stays where it is unless another spot is at least this much closer. */
const MIN_GAIN = 40;
/** The closest a callout comes to its rail, so that it never sits on the packet. */
const MIN_REACH = 34;
const SEARCH_RADIUS = 440;
const SEARCH_STEP = 10;
const RAIL_CLEARANCE = 8;
const CALLOUT_CLEARANCE = 16;
const ZONE_OUTSIDE_CLEARANCE = 16;
const ZONE_INSIDE_PAD = 16;
/** Room a zone keeps for its name, which a callout inside it stays below. */
const ZONE_HEADER = 40;
/** How much nearer its own rail than any other packet's a callout must be. */
const OWN_RAIL_MARGIN = 24;
const RAIL_SAMPLES = 24;
/** The most two samples of a rail lie apart: a callout is not to slip between them. */
const RAIL_SAMPLE_SPACING = 20;

function samples(path: Rail): Point[] {
  const count = Math.max(RAIL_SAMPLES, Math.ceil(railLength(path) / RAIL_SAMPLE_SPACING));
  return Array.from({ length: count + 1 }, (_, i) => pointAt(path, i / count));
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

function respectsZone(rect: Rect, zone: Rect): boolean {
  if (!rectOverlaps(rect, expandRect(zone, ZONE_OUTSIDE_CLEARANCE))) return true;
  return (
    rect.x >= zone.x + ZONE_INSIDE_PAD &&
    rect.x + rect.width <= zone.x + zone.width - ZONE_INSIDE_PAD &&
    rect.y >= zone.y + ZONE_HEADER &&
    rect.y + rect.height <= zone.y + zone.height - ZONE_INSIDE_PAD
  );
}

/**
 * Where along its rail a callout belongs. Packets that leave one node together share that end
 * of their rails, so their callouts gather towards the other end, where the rails are apart.
 */
function anchorT(packet: Packet, phase: readonly Packet[]): number {
  const others = phase.filter((p) => p !== packet);
  if (others.some((p) => p.from === packet.from)) return 0.7;
  if (others.some((p) => p.to === packet.to)) return 0.3;
  return 0.5;
}

interface Offset {
  dx: number;
  dy: number;
}

/** Every grid offset from the anchor, nearest first; ties in reading order, to stay deterministic. */
function offsetsByReach(width: number, height: number): Array<Offset & { reach: number }> {
  const origin = { x: 0, y: 0 };
  const out: Array<Offset & { reach: number }> = [];
  for (let dy = -SEARCH_RADIUS; dy <= SEARCH_RADIUS; dy += SEARCH_STEP) {
    for (let dx = -SEARCH_RADIUS; dx <= SEARCH_RADIUS; dx += SEARCH_STEP) {
      const r = reach({ x: dx - width / 2, y: dy - height / 2, width, height }, origin);
      if (r >= MIN_REACH) out.push({ dx, dy, reach: r });
    }
  }
  return out.sort((a, b) => a.reach - b.reach || a.dy - b.dy || a.dx - b.dx);
}

export function refinePhaseCallouts(phase: readonly Packet[], around: CalloutSurroundings): void {
  for (const packet of phase) delete packet.calloutAt;
  const railPoints = around.rails.map((rail) => samples(rail));
  const { nodeAreas } = around;

  const entries = phase.flatMap((packet) => {
    const box = computePacketCalloutBox(packet);
    if (!box) return [];
    const rect = calloutRect(box);
    const anchor = pointAt(packet.path, anchorT(packet, phase));
    return [
      {
        packet,
        rect,
        anchor,
        reach: reach(rect, anchor),
        own: samples(packet.path),
        rivals: phase.filter((p) => p !== packet).map((p) => samples(p.path)),
      },
    ];
  });
  // The ones already close keep their place first; the others move around them.
  entries.sort((a, b) => a.reach - b.reach);

  const taken: Rect[] = [];
  for (const { packet, rect, anchor, reach: current, own, rivals } of entries) {
    const ambiguous = (r: Rect): boolean => {
      if (rivals.length === 0) return false;
      const mine = nearest(r, own);
      return rivals.some((points) => nearest(r, points) < mine + OWN_RAIL_MARGIN);
    };
    const hidesRail = railPoints.some((points) => points.some((p) => pointInRect(p, rect)));
    // Nor does it stay across the border of a zone, or closer to one than a callout may come.
    const crowdsZone = around.zones.some((zone) => !respectsZone(rect, zone));
    const mustMove = hidesRail || crowdsZone || ambiguous(rect);
    const limit = mustMove ? Number.POSITIVE_INFINITY : current - MIN_GAIN;

    let moved: Rect | undefined;
    if (limit >= MIN_REACH) {
      for (const offset of offsetsByReach(rect.width, rect.height)) {
        if (offset.reach > limit) break;
        const candidate: Rect = {
          x: anchor.x + offset.dx - rect.width / 2,
          y: anchor.y + offset.dy - rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
        const padded = expandRect(candidate, RAIL_CLEARANCE);
        const spaced = expandRect(candidate, CALLOUT_CLEARANCE);
        if (
          nodeAreas.some((area) => rectOverlaps(candidate, area)) ||
          around.zones.some((zone) => !respectsZone(candidate, zone)) ||
          taken.some((other) => rectOverlaps(spaced, other)) ||
          railPoints.some((points) => points.some((p) => pointInRect(p, padded))) ||
          ambiguous(candidate)
        ) {
          continue;
        }
        moved = candidate;
        break;
      }
    }
    if (moved) packet.calloutAt = { x: moved.x, y: moved.y };
    taken.push(moved ?? rect);
  }
}
