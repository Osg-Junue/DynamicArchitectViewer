import type { Rect } from '../layout';
import { isWide, normalizeCodeIndent } from '../model/text';
import type { CodeBlock } from '../model/types';
import { clamp, type Point, pointAt } from './geometry';
import type { Packet } from './resolve';
import { fitText, type WrapTextOptions, wrapText } from './text';

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
}

const CALLOUT_MAX_TEXT_WIDTH = 360;
export const CALLOUT_LABEL_SIZE = 14;
export const CALLOUT_DESC_SIZE = 13;
export const CALLOUT_LINE_HEIGHT = 18;

export const CALLOUT_CODE_SIZE = 11.5;
export const CALLOUT_CODE_HEAD_SIZE = 11;
export const CALLOUT_CODE_LINE_HEIGHT = 16.5;
export const CALLOUT_CODE_PAD_X = 10;
const CALLOUT_CODE_MAX_LINES = 10;
const CALLOUT_CODE_MAX_TEXT_WIDTH = 380;
const CALLOUT_CODE_HEADER_HEIGHT = 22;

/** Keeps a callout above its endpoint nodes, including their badges and crop marks. */
const CALLOUT_NODE_CLEARANCE = 16;
const CALLOUT_LABEL_CLEARANCE = 6;
const CALLOUT_GAP = 12;
/** Past the clash limit, because landing exactly on it would depend on rounding. */
const CALLOUT_SHIFT_SLACK = 1;

type CalloutTextStyle = 'normal' | 'bold' | 'mono';

/**
 * CJK characters, fullwidth forms, and general punctuation/symbols/arrows (`—`, `…`, `→`, `●`,
 * `①`..`⑳`, `¥`, `·`) render at ~1.0em in UI/CJK fonts even when outside `model/text.ts` `isWide`.
 */
function isCalloutWide(ch: string): boolean {
  if (isWide(ch)) return true;
  const code = ch.codePointAt(0) ?? 0;
  return (
    code === 0x00a5 ||
    code === 0x00b7 ||
    code === 0x00d7 ||
    code === 0x00f7 ||
    (code >= 0x2000 && code <= 0x2bff) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xfe00 && code <= 0xfe6f)
  );
}

function charEm(ch: string, style: CalloutTextStyle): number {
  if (isCalloutWide(ch)) {
    return style === 'normal' ? 1.05 : 1.08;
  }
  if (style === 'mono') {
    return 0.63;
  }
  if (ch === 'W' || ch === 'M' || ch === '@' || ch === '%') {
    return style === 'bold' ? 0.92 : 0.88;
  }
  if ((ch >= 'A' && ch <= 'Z') || ch === '#' || ch === '&') {
    return style === 'bold' ? 0.72 : 0.68;
  }
  return style === 'bold' ? 0.65 : 0.6;
}

/** Conservative DOM-free width estimator so callout text never overflows its bubble or code box. */
export function estimateCalloutTextWidth(
  text: string,
  fontSize: number,
  style: CalloutTextStyle = 'normal',
): number {
  let em = 0;
  for (const ch of text) em += charEm(ch, style);
  return em * fontSize;
}

function fitCalloutText(
  text: string,
  fontSize: number,
  maxWidth: number,
  style: CalloutTextStyle,
): string {
  return fitText(text, fontSize, maxWidth, {
    measure: (s, size) => estimateCalloutTextWidth(s, size, style),
    trimBeforeEllipsis: style !== 'mono',
  });
}

function isBreakableToken(ch: string): boolean {
  return (
    ch === ' ' ||
    ch === '\n' ||
    isWide(ch) ||
    ch === '—' ||
    ch === '→' ||
    ch === '←' ||
    ch === '↔' ||
    ch === '・'
  );
}

const CALLOUT_WRAP_OPTIONS: WrapTextOptions = {
  measure: (s, size) => estimateCalloutTextWidth(s, size, 'normal'),
  isBreakable: isBreakableToken,
  trimBeforeEllipsis: true,
};

function wrapCalloutText(text: string, fontSize: number, maxWidth: number, maxLines = 4): string[] {
  return wrapText(text, fontSize, maxWidth, maxLines, CALLOUT_WRAP_OPTIONS);
}

interface PreparedCodeSpec {
  header: string;
  headerHeight: number;
  lines: string[];
  minBoxW: number;
  height: number;
}

function prepareCodeSpec(code: CodeBlock): PreparedCodeSpec | undefined {
  const normalized = normalizeCodeIndent(code.body, { stripAllOuterBlankLines: true });
  if (!normalized) return undefined;
  const dedented = normalized.split('\n');

  const capped =
    dedented.length > CALLOUT_CODE_MAX_LINES
      ? [...dedented.slice(0, CALLOUT_CODE_MAX_LINES - 1), '…']
      : dedented;
  const lines = capped.map((line) =>
    fitCalloutText(line, CALLOUT_CODE_SIZE, CALLOUT_CODE_MAX_TEXT_WIDTH, 'mono'),
  );

  const lang = code.lang?.trim() ?? '';
  const title = code.title?.trim() ?? '';
  const rawHeader = lang && title ? `${lang} · ${title}` : lang || title;
  const header = rawHeader
    ? fitCalloutText(rawHeader, CALLOUT_CODE_SIZE, CALLOUT_CODE_MAX_TEXT_WIDTH - 28, 'mono')
    : '';
  const headerHeight = header ? CALLOUT_CODE_HEADER_HEIGHT : 0;

  const monoW = (s: string) => estimateCalloutTextWidth(s, CALLOUT_CODE_SIZE, 'mono');
  const codeTextW = Math.max(header ? monoW(`{ } ${header}`) : 0, ...lines.map(monoW)) + 8;
  const minBoxW = codeTextW + CALLOUT_CODE_PAD_X * 2;
  const height = headerHeight + lines.length * CALLOUT_CODE_LINE_HEIGHT + 12;

  return { header, headerHeight, lines, minBoxW, height };
}

/**
 * Computes the stationary speech-bubble box positioned above the packet's edge path.
 * Keeping the bubble body stationary while only its pointer tip tracks the moving dot
 * eliminates eye-tracking fatigue when reading multi-line descriptions and code blocks.
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
  const label = packet.label
    ? fitCalloutText(packet.label, CALLOUT_LABEL_SIZE, CALLOUT_MAX_TEXT_WIDTH, 'bold')
    : '';
  const descLines = packet.description
    ? wrapCalloutText(packet.description, CALLOUT_DESC_SIZE, CALLOUT_MAX_TEXT_WIDTH, 4)
    : [];
  const codeSpec = packet.code ? prepareCodeSpec(packet.code) : undefined;
  if (!label && descLines.length === 0 && !codeSpec) return null;

  const labelW = label ? estimateCalloutTextWidth(label, CALLOUT_LABEL_SIZE, 'bold') : 0;
  const descW = descLines.reduce(
    (m, line) => Math.max(m, estimateCalloutTextWidth(line, CALLOUT_DESC_SIZE, 'normal')),
    0,
  );
  const padX = descLines.length > 0 || codeSpec ? 12 : 10;
  const minW = codeSpec ? 220 : descLines.length > 0 ? 200 : 56;
  const contentW = Math.max(
    label ? labelW + 8 : 0,
    descLines.length > 0 ? descW + 8 : 0,
    codeSpec ? codeSpec.minBoxW : 0,
  );
  const width = Math.max(minW, Math.ceil(contentW + padX * 2));
  const halfW = width / 2;

  let height: number;
  let code: PacketCalloutCodeBox | undefined;
  if (!codeSpec) {
    height =
      descLines.length === 0 ? 30 : (label ? 36 : 14) + descLines.length * CALLOUT_LINE_HEIGHT;
  } else {
    const offsetY =
      descLines.length > 0
        ? (label ? 34 : 12) + descLines.length * CALLOUT_LINE_HEIGHT
        : label
          ? 32
          : 10;
    height = offsetY + codeSpec.height + 10;
    code = {
      header: codeSpec.header,
      headerHeight: codeSpec.headerHeight,
      lines: codeSpec.lines,
      offsetY,
      width: width - padX * 2,
      height: codeSpec.height,
    };
  }

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

  const box: PacketCalloutBox = { cx, halfW, boxTop, boxBottom, padX, label, descLines };
  if (code) box.code = code;
  return box;
}

export const calloutRect = (box: PacketCalloutBox): Rect => ({
  x: box.cx - box.halfW,
  y: box.boxTop,
  width: box.halfW * 2,
  height: box.boxBottom - box.boxTop,
});

/**
 * Builds the path of the stationary annotation box and its leader line, whose end
 * dynamically follows `dot` along the edge path.
 */
export function packetBubblePath(box: PacketCalloutBox, dot: Point): string {
  const { cx, halfW, boxTop, boxBottom } = box;
  const left = cx - halfW;
  const right = cx + halfW;
  const r = 6;
  const maxOffset = Math.max(0, halfW - r - 12);
  const baseX = cx + clamp((dot.x - cx) * 0.25, -maxOffset, maxOffset);
  const dx = dot.x - baseX;
  const dy = Math.max(12, dot.y - boxBottom);
  const dist = Math.hypot(dx, dy);
  const pull = Math.min(7, dist * 0.35);
  const tipX = dot.x - (dx / dist) * pull;
  const tipY = dot.y - (dy / dist) * pull;
  const n = (value: number) => value.toFixed(1);

  return [
    `M ${n(left + r)} ${n(boxTop)}`,
    `H ${n(right - r)}`,
    `Q ${n(right)} ${n(boxTop)} ${n(right)} ${n(boxTop + r)}`,
    `V ${n(boxBottom - r)}`,
    `Q ${n(right)} ${n(boxBottom)} ${n(right - r)} ${n(boxBottom)}`,
    `H ${n(baseX)}`,
    `L ${n(tipX)} ${n(tipY)}`,
    `L ${n(baseX)} ${n(boxBottom)}`,
    `H ${n(left + r)}`,
    `Q ${n(left)} ${n(boxBottom)} ${n(left)} ${n(boxBottom - r)}`,
    `V ${n(boxTop + r)}`,
    `Q ${n(left)} ${n(boxTop)} ${n(left + r)} ${n(boxTop)}`,
    'Z',
  ].join(' ');
}

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
