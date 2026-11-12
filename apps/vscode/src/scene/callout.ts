import type { Rect } from '../layout';
import {
  CALLOUT_DOT_CLEARANCE,
  CALLOUT_LABEL_CLEARANCE,
  CALLOUT_NODE_CLEARANCE,
  CALLOUT_RADIUS,
  type MeasuredCalloutCard,
  measureCalloutCard,
} from './calloutMeasure';
import { clamp, type Point, pointAt } from './geometry';
import type { Packet } from './resolve';

export {
  CALLOUT_CODE_HEAD_SIZE,
  CALLOUT_CODE_HEADER_HEIGHT,
  CALLOUT_CODE_LINE_HEIGHT,
  CALLOUT_CODE_PAD_X,
  CALLOUT_CODE_RADIUS,
  CALLOUT_CODE_SIZE,
  CALLOUT_DESC_SIZE,
  CALLOUT_DOT_CLEARANCE,
  CALLOUT_GAP,
  CALLOUT_ICON_CLEARANCE,
  CALLOUT_LABEL_SIZE,
  CALLOUT_LINE_HEIGHT,
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
  markerClearance?: number;
}

const DIMMED_OBSTACLE_MAX_LIFT = 280;

export function placeCalloutBox(
  packet: Packet,
  card: MeasuredCalloutCard,
  mid = pointAt(packet.path, 0.5),
): PacketCalloutBox {
  const placement: CalloutPlacement = packet.calloutPlacement ?? 'above';
  const isAbove = placement === 'above';
  const { halfW, height, padX, label, descLines, code, markerClearance } = card;
  const cx = mid.x + (packet.calloutShift ?? 0);

  const ys = [packet.path.p0.y, packet.path.p1.y, packet.path.p2.y, packet.path.p3.y, mid.y];
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
    markerClearance,
  };
  if (code) box.code = code;
  return box;
}

/**
 * Computes the stationary speech-bubble box positioned above or below the packet's edge path.
 * Keeping the bubble body stationary while only its pointer tip tracks the moving dot
 * eliminates eye-tracking fatigue when reading multi-line descriptions and code blocks.
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
  const card = measureCalloutCard(packet);
  if (!card) return null;
  return placeCalloutBox(packet, card);
}

export function calloutRect(box: PacketCalloutBox): Rect {
  return {
    x: box.cx - box.halfW,
    y: box.boxTop,
    width: box.halfW * 2,
    height: box.boxBottom - box.boxTop,
  };
}

/**
 * Builds the path of the stationary annotation box and its leader pointer, whose tip
 * dynamically follows `dot` along the edge path while keeping a constant 13-command
 * clockwise path structure for SMIL `<animate attributeName="d">` interpolation.
 */
export function packetBubblePath(
  box: PacketCalloutBox,
  dot: Point,
  markerClearance = box.markerClearance ?? CALLOUT_DOT_CLEARANCE,
): string {
  const { cx, halfW, boxTop, boxBottom, placement } = box;
  const isBelow = placement === 'below';
  const left = cx - halfW;
  const right = cx + halfW;
  const r = Math.min(CALLOUT_RADIUS, halfW, (boxBottom - boxTop) / 2);
  const n = (value: number) => value.toFixed(1);

  const dy = isBelow ? Math.min(-14, dot.y - boxTop) : Math.max(14, dot.y - boxBottom);
  const rawDist = Math.hypot(dot.x - cx, Math.abs(dy));
  const tailHalf = Math.min(
    clamp(300 / Math.max(50, rawDist), 1.8, 5.5),
    Math.max(0, halfW - r - 6),
  );
  const maxOffset = Math.max(0, halfW - r - tailHalf - 8);
  const baseX = cx + clamp((dot.x - cx) * 0.3, -maxOffset, maxOffset);
  const baseLeft = baseX - tailHalf;
  const baseRight = baseX + tailHalf;
  const dx = dot.x - baseX;
  const dist = Math.hypot(dx, dy);
  const pull = Math.min(markerClearance, dist * 0.42);
  const tipX = dot.x - (dx / dist) * pull;
  const rawTipY = dot.y - (dy / dist) * pull;
  const tipY = isBelow ? Math.min(boxTop - 4, rawTipY) : Math.max(boxBottom + 4, rawTipY);

  if (isBelow) {
    return [
      `M ${n(left + r)} ${n(boxTop)}`,
      `H ${n(baseLeft)}`,
      `L ${n(tipX)} ${n(tipY)}`,
      `L ${n(baseRight)} ${n(boxTop)}`,
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

  return [
    `M ${n(left + r)} ${n(boxTop)}`,
    `H ${n(right - r)}`,
    `Q ${n(right)} ${n(boxTop)} ${n(right)} ${n(boxTop + r)}`,
    `V ${n(boxBottom - r)}`,
    `Q ${n(right)} ${n(boxBottom)} ${n(right - r)} ${n(boxBottom)}`,
    `H ${n(baseRight)}`,
    `L ${n(tipX)} ${n(tipY)}`,
    `L ${n(baseLeft)} ${n(boxBottom)}`,
    `H ${n(left + r)}`,
    `Q ${n(left)} ${n(boxBottom)} ${n(left)} ${n(boxBottom - r)}`,
    `V ${n(boxTop + r)}`,
    `Q ${n(left)} ${n(boxTop)} ${n(left + r)} ${n(boxTop)}`,
    'Z',
  ].join(' ');
}
