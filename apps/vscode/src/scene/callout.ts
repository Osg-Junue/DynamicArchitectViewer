import type { Rect } from '../layout';
import { pointAt } from './geometry';
import type { Packet } from './resolve';
import { estimateTextWidth, fitText, wrapText } from './text';

export interface PacketCalloutBox {
  cx: number;
  halfW: number;
  boxTop: number;
  boxBottom: number;
  padX: number;
  label: string;
  descLines: string[];
}

const CALLOUT_MAX_TEXT_WIDTH = 360;
export const CALLOUT_LABEL_SIZE = 14;
export const CALLOUT_DESC_SIZE = 13;
export const CALLOUT_LINE_HEIGHT = 18;
/** Keeps a callout above its endpoint nodes, including their badges and crop marks. */
const CALLOUT_NODE_CLEARANCE = 16;
const CALLOUT_LABEL_CLEARANCE = 6;
const CALLOUT_GAP = 12;
/** Past the clash limit, because landing exactly on it would depend on rounding. */
const CALLOUT_SHIFT_SLACK = 1;

/**
 * Computes the stationary speech-bubble box positioned above the packet's edge path.
 * Keeping the bubble body stationary while only its pointer tip tracks the moving dot
 * eliminates eye-tracking fatigue when reading multi-line descriptions.
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
  const label = packet.label
    ? fitText(packet.label, CALLOUT_LABEL_SIZE, CALLOUT_MAX_TEXT_WIDTH)
    : '';
  const descLines = packet.description
    ? wrapText(packet.description, CALLOUT_DESC_SIZE, CALLOUT_MAX_TEXT_WIDTH, 4)
    : [];
  if (!label && descLines.length === 0) return null;

  const labelW = label ? estimateTextWidth(label, CALLOUT_LABEL_SIZE) : 0;
  const descW = descLines.reduce(
    (m, line) => Math.max(m, estimateTextWidth(line, CALLOUT_DESC_SIZE)),
    0,
  );
  const padX = descLines.length > 0 ? 12 : 10;
  const minW = descLines.length > 0 ? 200 : 56;
  const width = Math.max(minW, Math.ceil(Math.max(labelW, descW) + padX * 2));
  const halfW = width / 2;
  const height =
    descLines.length === 0 ? 30 : (label ? 36 : 14) + descLines.length * CALLOUT_LINE_HEIGHT;

  const mid = pointAt(packet.path, 0.5);
  const minY = Math.min(
    packet.path.p0.y,
    packet.path.p1.y,
    packet.path.p2.y,
    packet.path.p3.y,
    mid.y,
  );
  const cx = mid.x + (packet.calloutShift ?? 0);
  let boxBottom = Math.min(mid.y - 36, minY - 26, packet.clearTop - CALLOUT_NODE_CLEARANCE);
  // Moves up past each zone name in the way, nearest first.
  for (const area of [...packet.labelAreas].sort((a, b) => b.y - a.y)) {
    const overlapsX = cx - halfW < area.x + area.width && cx + halfW > area.x;
    const overlapsY = boxBottom - height < area.y + area.height && boxBottom > area.y;
    if (overlapsX && overlapsY) boxBottom = area.y - CALLOUT_LABEL_CLEARANCE;
  }
  const boxTop = boxBottom - height;

  return { cx, halfW, boxTop, boxBottom, padX, label, descLines };
}

export const calloutRect = (box: PacketCalloutBox): Rect => ({
  x: box.cx - box.halfW,
  y: box.boxTop,
  width: box.halfW * 2,
  height: box.boxBottom - box.boxTop,
});

const calloutsClash = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  a.cx - a.halfW < b.cx + b.halfW + CALLOUT_GAP &&
  a.cx + a.halfW + CALLOUT_GAP > b.cx - b.halfW &&
  a.boxTop < b.boxBottom + CALLOUT_GAP &&
  a.boxBottom + CALLOUT_GAP > b.boxTop;

/**
 * Packets of one phase play together, so their callouts must not cover each other.
 * Places them in declaration order and moves each one that clashes sideways by the
 * smallest distance that clears the others. Beside the rightmost callout is always free.
 */
export function separatePhaseCallouts(phase: readonly Packet[]): void {
  const placed: PacketCalloutBox[] = [];
  for (const packet of phase) {
    const box = computePacketCalloutBox(packet);
    if (!box) continue;
    if (!placed.some((other) => calloutsClash(box, other))) {
      placed.push(box);
      continue;
    }
    const clear = placed
      .flatMap((other) => {
        const reach = other.halfW + CALLOUT_GAP + box.halfW + CALLOUT_SHIFT_SLACK;
        return [other.cx - reach - box.cx, other.cx + reach - box.cx];
      })
      .sort((a, b) => Math.abs(a) - Math.abs(b))
      .map((calloutShift) => ({
        calloutShift,
        moved: computePacketCalloutBox({ ...packet, calloutShift }),
      }))
      .find(({ moved }) => moved && !placed.some((other) => calloutsClash(moved, other)));
    if (!clear?.moved) continue;
    packet.calloutShift = clear.calloutShift;
    placed.push(clear.moved);
  }
}
