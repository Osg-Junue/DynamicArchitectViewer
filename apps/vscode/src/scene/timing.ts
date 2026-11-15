import { type Point, pointAt, railLength } from './geometry';
import type { Packet, ResolvedView } from './resolve';

/** Pause after a step's last phase at 1x. */
export const HOLD_MS = 1800;

/** A typical phase at 1x; the actual length of each one depends on what travels how far. */
export const PHASE_MS = 2000;

/** Top average speed of a lone packet, in screen pixels per second at 1x. */
const MAX_SPEED = 320;
/** Each further packet of a phase lowers the speed: the eye has to split between them. */
const PARALLEL_SLOWDOWN = 0.3;
export const MIN_PACKET_MS = 1000;
/** A leg of a round trip may be shorter than a packet one way: its rail is known by then. */
const MIN_LEG_MS = 800;
const TURN_PAUSE_MS = 150;
/** The part of a round trip that may go to resting at the far end. */
const MAX_TURN_SHARE = 0.3;
/** The shares of its time a packet takes to reach its cruising speed and to come to rest. */
const LAUNCH = 0.15;
const LANDING = 0.3;
/** The cruising speed, as a multiple of the average: 1.29, where a sine ease peaks at 1.57. */
const CRUISE = 1 / (1 - (LAUNCH + LANDING) / 2);

/**
 * Times a phase by how far its packets travel on screen, where the diagram is drawn at `zoom`,
 * and returns its duration. There is no upper limit: a very long line takes longer rather than
 * going too fast to follow. Packets leave together; those with less distance arrive first.
 */
export function pacePhase(phase: Packet[], zoom = 1): number {
  const speed = MAX_SPEED / zoom / (1 + PARALLEL_SLOWDOWN * (phase.length - 1));
  for (const packet of phase) {
    const length = railLength(packet.path);
    packet.durationMs = Math.round(
      packet.roundTrip
        ? Math.max(MIN_LEG_MS, (length / speed) * 1000) * 2 + TURN_PAUSE_MS
        : Math.max(MIN_PACKET_MS, (length / speed) * 1000),
    );
  }
  return Math.max(...phase.map((packet) => packet.durationMs));
}

/**
 * The zoom to time a phase at when the reader looks at it at `chosen`, where the camera would
 * show it at `automatic`. A closer view slows the packets by half as much as it enlarges them,
 * on a scale of ratios: at four times the zoom they take twice as long, and move twice as fast
 * on screen. Slowing them all the way made a diagram zoomed in by hand play very slowly. A view
 * further out leaves the pace as it is.
 */
export function pacingZoom(automatic: number, chosen: number): number {
  return chosen > automatic ? Math.sqrt(automatic * chosen) : automatic;
}

/**
 * Times a view's phases from `from` on, each at the zoom the camera shows it at, in order:
 * `zooms[0]` is the zoom of phase `from`. A phase without a zoom is timed at 1.
 */
export function paceView(view: ResolvedView, zooms: readonly number[], from = 0): void {
  for (let i = from; i < view.phases.length; i++) {
    const zoom = zooms[i - from] ?? 1;
    view.phaseDurations[i] = pacePhase(view.phases[i] ?? [], zoom > 0 ? zoom : 1);
  }
}

/**
 * How far a packet has come at `u` of its time: it gets up to speed quickly, keeps one speed for
 * most of the way and slows down longer than it took to start, so that the eye sees where it
 * stops. Keeping one speed makes the fastest moment slower than an ease that never stops
 * changing speed, so the same distance is as easy to follow in less time.
 */
function ease(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < LAUNCH) return (CRUISE * u * u) / (2 * LAUNCH);
  if (u > 1 - LANDING) return 1 - (CRUISE * (1 - u) * (1 - u)) / (2 * LANDING);
  return CRUISE * (u - LAUNCH / 2);
}

/** Eased position along a packet's path; a round trip rests briefly at the far end. */
function travelProgress(t: number, roundTrip: boolean, durationMs: number): number {
  if (!roundTrip) return ease(t);
  const rest = Math.min(MAX_TURN_SHARE, TURN_PAUSE_MS / durationMs);
  const leg = (1 - rest) / 2;
  if (t < leg) return ease(t / leg);
  if (t < leg + rest) return 1;
  // The way back starts and stops like the way out.
  return 1 - ease(1 - (1 - t) / leg);
}

/** How far along its rail a packet is at `t` of its time, as a share of the rail's length. */
export function packetShare(packet: Packet, t: number): number {
  return travelProgress(t, packet.roundTrip, packet.durationMs);
}

export function packetPosition(packet: Packet, t: number): Point {
  return pointAt(packet.path, packetShare(packet, t));
}
