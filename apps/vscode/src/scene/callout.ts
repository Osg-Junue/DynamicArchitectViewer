import type { Rect } from '../layout';
import { CALLOUT_RADIUS, measureCalloutCard } from './calloutMeasure';
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
  CALLOUT_HEAD,
  CALLOUT_LABEL_SIZE,
  CALLOUT_LINE_HEIGHT,
  CALLOUT_NUMBER_ROOM,
  CALLOUT_ONE_LINE_HEIGHT,
  CALLOUT_OUTER_PAD_X,
  CALLOUT_RADIUS,
} from './calloutMeasure';

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
  label: string;
  descLines: string[];
  code?: PacketCalloutCodeBox;
  /** Width at the left that holds the stop number; the text and code start after it. */
  numberRoom: number;
  /** The number shared with the packet's stop on its rail, such as `2` or `5a`. */
  number?: string;
}

/** How far above its rail a callout sits that was found no place of its own. */
const UNPLACED_GAP = 26;

/**
 * The box of a packet's callout. It stays still while the packet moves, so that a description
 * or a code block can be read without following anything.
 *
 * `placePhaseCallouts` finds it the free place nearest its rail, on any side (`calloutAt`).
 * Where a step is too crowded to have one, it sits above the middle of its rail.
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
  const card = measureCalloutCard(packet);
  if (!card) return null;
  const { halfW, height, padX, label, descLines, code, numberRoom } = card;
  const at = packet.calloutAt ?? {
    x: pointAt(packet.path, 0.5).x - halfW,
    y: railBox(packet.path).y - UNPLACED_GAP - height,
  };
  const box: PacketCalloutBox = {
    cx: at.x + halfW,
    halfW,
    boxTop: at.y,
    boxBottom: at.y + height,
    padX,
    label,
    descLines,
    numberRoom,
  };
  if (code) box.code = code;
  if (packet.stopLabel !== undefined) box.number = packet.stopLabel;
  return box;
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
