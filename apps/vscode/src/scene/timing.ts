import { curveLength } from './geometry';
import type { Packet } from './resolve';

/** Pause after a step's last phase at 1x. */
export const HOLD_MS = 1800;

/** A typical phase at 1x; the actual length of each one depends on what travels how far. */
export const PHASE_MS = 2000;

/** Top average speed of a lone packet, in diagram units per second at 1x. */
const MAX_SPEED = 260;
/** Each further packet of a phase lowers the speed: the eye has to split between them. */
const PARALLEL_SLOWDOWN = 0.3;
/** Coming back on the same rail is harder to follow, so a round trip goes slower. */
const ROUND_TRIP_SPEED = 0.75;
export const MIN_PACKET_MS = 1300;
const MIN_LEG_MS = 1100;
const TURN_PAUSE_MS = 180;
/** The part of a round trip that may go to resting at the far end. */
const MAX_TURN_SHARE = 0.3;

/**
 * Times a phase by how far its packets travel, and returns its duration. There is no upper
 * limit: a very long line takes longer rather than going too fast to follow.
 * Packets leave together; those with less distance arrive first.
 */
export function pacePhase(phase: Packet[]): number {
  const speed = MAX_SPEED / (1 + PARALLEL_SLOWDOWN * (phase.length - 1));
  for (const packet of phase) {
    const length = curveLength(packet.path);
    packet.durationMs = Math.round(
      packet.roundTrip
        ? Math.max(
            MIN_LEG_MS * 2 + TURN_PAUSE_MS,
            ((length * 2) / (speed * ROUND_TRIP_SPEED)) * 1000,
          )
        : Math.max(MIN_PACKET_MS, (length / speed) * 1000),
    );
  }
  return Math.max(...phase.map((packet) => packet.durationMs));
}

const easeSine = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

/** Eased position along a packet's path; a round trip rests briefly at the far end. */
export function travelProgress(t: number, roundTrip: boolean, durationMs: number): number {
  if (!roundTrip) return easeSine(t);
  const rest = Math.min(MAX_TURN_SHARE, TURN_PAUSE_MS / durationMs);
  const leg = (1 - rest) / 2;
  if (t < leg) return easeSine(t / leg);
  if (t < leg + rest) return 1;
  return easeSine((1 - t) / leg);
}
