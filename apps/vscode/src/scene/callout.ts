import type { Rect } from '../layout';
import {
  CALLOUT_LABEL_CLEARANCE,
  CALLOUT_NODE_CLEARANCE,
  CALLOUT_RADIUS,
  type MeasuredCalloutCard,
  measureCalloutCard,
} from './calloutMeasure';
import { pointAt, railBox } from './geometry';
import type { Packet } from './resolve';

export {
  CALLOUT_CODE_HEAD_SIZE,
  CALLOUT_CODE_HEADER_HEIGHT,
  CALLOUT_CODE_LINE_HEIGHT,
  CALLOUT_CODE_PAD_X,
  CALLOUT_CODE_RADIUS,
  CALLOUT_CODE_SIZE,
  CALLOUT_DESC_SIZE,
  CALLOUT_GAP,
  CALLOUT_LABEL_SIZE,
  CALLOUT_LINE_HEIGHT,
  CALLOUT_NUMBER_ROOM,
  CALLOUT_OUTER_PAD_X,
  CALLOUT_RADIUS,
  estimateCalloutTextWidth,
} from './calloutMeasure';
export { separatePhaseCallouts } from './calloutSolver';

export type CalloutPlacement = 'above' | 'below';

export interface PacketCalloutCodeBox {
  header: string;
  headerHeight: number;
  lines: string[];
  offsetY: number;
  width: number;
  height: number;
}

export interface PacketCalloutBox {
  cx: number;
  halfW: number;
  boxTop: number;
  boxBottom: number;
  padX: number;
  placement: CalloutPlacement;
  label: string;
  descLines: string[];
  code?: PacketCalloutCodeBox;
  /** Width at the left that holds the stop number; the text and code start after it. */
  numberRoom: number;
  /** The number shared with the packet's stop on its rail, such as `2` or `5a`. */
  number?: string;
}

const DIMMED_OBSTACLE_MAX_LIFT = 280;

export function placeCalloutBox(
  packet: Packet,
  card: MeasuredCalloutCard,
  mid = pointAt(packet.path, 0.5),
): PacketCalloutBox {
  const placement: CalloutPlacement = packet.calloutPlacement ?? 'above';
  const isAbove = placement === 'above';
  const { halfW, height, padX, label, descLines, code, numberRoom } = card;
  const cx = mid.x + (packet.calloutShift ?? 0);

  const reach = railBox(packet.path);
  const ys = [reach.y, reach.y + reach.height, mid.y];
  let baseAnchor: number;
  let anchor: number;
  if (isAbove) {
    const minY = Math.min(...ys);
    baseAnchor = Math.min(mid.y - 36, minY - 26, packet.clearTop - CALLOUT_NODE_CLEARANCE);
    anchor =
      packet.calloutBottom !== undefined ? Math.min(baseAnchor, packet.calloutBottom) : baseAnchor;
  } else {
    const maxY = Math.max(...ys);
    const clearBottom = packet.clearBottom ?? maxY;
    baseAnchor = Math.max(mid.y + 38, maxY + 26, clearBottom + CALLOUT_NODE_CLEARANCE);
    anchor = packet.calloutTop !== undefined ? Math.max(baseAnchor, packet.calloutTop) : baseAnchor;
  }

  const obstacles = [
    ...packet.labelAreas.map((area) => ({ area, hard: true })),
    ...(packet.dimmedNodeAreas ?? []).map((area) => ({ area, hard: false })),
  ].sort((a, b) =>
    isAbove ? b.area.y - a.area.y : a.area.y + a.area.height - (b.area.y + b.area.height),
  );

  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const { area, hard } of obstacles) {
      const top = isAbove ? anchor - height : anchor;
      const bottom = isAbove ? anchor : anchor + height;
      const overlapsX = cx - halfW < area.x + area.width && cx + halfW > area.x;
      const overlapsY = top < area.y + area.height && bottom > area.y;
      if (!overlapsX || !overlapsY) continue;
      const next = isAbove
        ? area.y - CALLOUT_LABEL_CLEARANCE
        : area.y + area.height + CALLOUT_LABEL_CLEARANCE;
      const lift = isAbove ? baseAnchor - next : next - baseAnchor;
      if (!hard && lift > DIMMED_OBSTACLE_MAX_LIFT) continue;
      if (isAbove ? next < anchor : next > anchor) {
        anchor = next;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const boxTop = isAbove ? anchor - height : anchor;
  const boxBottom = isAbove ? anchor : anchor + height;
  const box: PacketCalloutBox = {
    cx,
    halfW,
    boxTop,
    boxBottom,
    padX,
    placement,
    label,
    descLines,
    numberRoom,
  };
  if (code) box.code = code;
  if (packet.stopLabel !== undefined) box.number = packet.stopLabel;
  return box;
}

/**
 * The box of a packet's callout. It stays still while the packet moves, so that a description
 * or a code block can be read without following anything.
 *
 * `separatePhaseCallouts` puts it above or below the rail; `placePhaseCallouts` then finds it
 * the free place nearest its rail, on any side (`calloutAt`).
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
  const card = measureCalloutCard(packet);
  if (!card) return null;
  const box = placeCalloutBox(packet, card);
  const at = packet.calloutAt;
  if (!at) return box;
  const height = box.boxBottom - box.boxTop;
  return { ...box, cx: at.x + box.halfW, boxTop: at.y, boxBottom: at.y + height };
}

export function calloutRect(box: PacketCalloutBox): Rect {
  return {
    x: box.cx - box.halfW,
    y: box.boxTop,
    width: box.halfW * 2,
    height: box.boxBottom - box.boxTop,
  };
}

/** The outline of a callout: a rounded box. Nothing ties it to the packet but its number. */
export function calloutOutline(box: PacketCalloutBox): string {
  const { cx, halfW, boxTop, boxBottom } = box;
  const left = cx - halfW;
  const right = cx + halfW;
  const r = Math.min(CALLOUT_RADIUS, halfW, (boxBottom - boxTop) / 2);
  const n = (value: number) => value.toFixed(1);
  return [
    `M ${n(left + r)} ${n(boxTop)}`,
    `H ${n(right - r)}`,
    `Q ${n(right)} ${n(boxTop)} ${n(right)} ${n(boxTop + r)}`,
    `V ${n(boxBottom - r)}`,
    `Q ${n(right)} ${n(boxBottom)} ${n(right - r)} ${n(boxBottom)}`,
    `H ${n(left + r)}`,
    `Q ${n(left)} ${n(boxBottom)} ${n(left)} ${n(boxBottom - r)}`,
    `V ${n(boxTop + r)}`,
    `Q ${n(left)} ${n(boxTop)} ${n(left + r)} ${n(boxTop)}`,
    'Z',
  ].join(' ');
}
