import { type Rect, rectOverlaps } from '../layout';
import { isWide, normalizeCodeIndent } from '../model/text';
import type { CodeBlock } from '../model/types';
import { clamp, type Point, pointAt } from './geometry';
import type { Packet } from './resolve';
import { fitText, type WrapTextOptions, wrapText } from './text';

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

const PHI = (1 + Math.sqrt(5)) / 2;

export const CALLOUT_RADIUS = 10;
export const CALLOUT_CODE_RADIUS = 6;

const CALLOUT_MAX_TEXT_WIDTH = 384;
const CALLOUT_NO_CODE_DESC_MAX_WIDTH = 340;
export const CALLOUT_LABEL_SIZE = 14;
export const CALLOUT_DESC_SIZE = 13;
export const CALLOUT_LINE_HEIGHT = 20;

export const CALLOUT_CODE_SIZE = 11.5;
export const CALLOUT_CODE_HEAD_SIZE = 11;
export const CALLOUT_CODE_LINE_HEIGHT = 17.5;
export const CALLOUT_CODE_PAD_X = 13;
const CALLOUT_CODE_MAX_LINES = 10;
const CALLOUT_CODE_MAX_TEXT_WIDTH = 404;
export const CALLOUT_CODE_HEADER_HEIGHT = 28;

/** Keeps a callout clear of its endpoint nodes, including their badges, crop marks, and subtitles. */
const CALLOUT_NODE_CLEARANCE = 16;
const CALLOUT_LABEL_CLEARANCE = 6;
export const CALLOUT_GAP = 16;
/** Past the clash limit, because landing exactly on it would depend on rounding. */
const CALLOUT_SHIFT_SLACK = 1;
const DIMMED_OBSTACLE_MAX_LIFT = 280;
const PARALLEL_SHELF_TOLERANCE = 48;

const POCKET_MAX_SHIFT = 155;
const SHIFT_COST_WEIGHT = 0.65;
const LEADER_CROSSING_PENALTY = 120;
const DIMMED_OVERLAP_PENALTY = 240;
const RAIL_OVERLAP_PENALTY = 500;
const RAIL_CLEARANCE_PAD = 14;
const DEFAULT_BELOW_BIAS = 22;
const PREFER_BELOW_ABOVE_BIAS = 14;
const CLASH_PENALTY = 1_000_000;
const RAIL_SAMPLE_TS = [0, 0.25, 0.5, 0.75, 1] as const;

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
    return 0.605;
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
  const height = headerHeight + lines.length * CALLOUT_CODE_LINE_HEIGHT + 14;

  return { header, headerHeight, lines, minBoxW, height };
}

function countEllipses(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (ch === '…') count++;
  }
  return count;
}

function balanceCalloutLines(text: string, descMaxW: number, minBalanceW: number): string[] {
  const lines = wrapCalloutText(text, CALLOUT_DESC_SIZE, descMaxW, 4);
  const k = lines.length;
  if (text.includes('\n') || k < 2) return lines;
  const baseEllipses = countEllipses(text);
  if (countEllipses(lines.join('')) > baseEllipses || minBalanceW >= descMaxW) {
    return lines;
  }
  let best = lines;
  let lo = minBalanceW;
  let hi = descMaxW;
  for (let iter = 0; iter < 8; iter++) {
    const midW = (lo + hi) / 2;
    const cand = wrapCalloutText(text, CALLOUT_DESC_SIZE, midW, 4);
    if (cand.length <= k && countEllipses(cand.join('')) <= baseEllipses) {
      best = cand;
      hi = midW;
    } else {
      lo = midW;
    }
  }
  return best;
}

interface MeasuredCalloutCard {
  halfW: number;
  height: number;
  padX: number;
  label: string;
  descLines: string[];
  code?: PacketCalloutCodeBox;
  markerClearance: number;
}

function measureCalloutCard(packet: Packet): MeasuredCalloutCard | null {
  const codeSpec = packet.code ? prepareCodeSpec(packet.code) : undefined;
  const label = packet.label
    ? fitCalloutText(packet.label, CALLOUT_LABEL_SIZE, CALLOUT_MAX_TEXT_WIDTH, 'bold')
    : '';
  const labelW = label ? estimateCalloutTextWidth(label, CALLOUT_LABEL_SIZE, 'bold') : 0;

  let phiInnerW = 0;
  let descMaxW = CALLOUT_NO_CODE_DESC_MAX_WIDTH;
  if (codeSpec) {
    const estH = (packet.label ? 40 : 14) + (packet.description ? 44 : 0) + codeSpec.height + 14;
    phiInnerW = clamp(Math.round(estH * PHI - 32), 236, 384);
    descMaxW = clamp(Math.max(phiInnerW, Math.ceil(codeSpec.minBoxW)), 236, 384);
  }

  const descLines = packet.description
    ? balanceCalloutLines(
        packet.description,
        descMaxW,
        Math.max(
          188,
          labelW + 8,
          codeSpec ? Math.ceil(Math.max(codeSpec.minBoxW, phiInnerW) * 0.82) : 0,
        ),
      )
    : [];
  if (!label && descLines.length === 0 && !codeSpec) return null;

  const descW = descLines.reduce(
    (m, line) => Math.max(m, estimateCalloutTextWidth(line, CALLOUT_DESC_SIZE, 'normal')),
    0,
  );
  const padX = descLines.length > 0 || codeSpec !== undefined ? 16 : 13;
  const contentW = Math.max(
    label ? labelW + 8 : 0,
    descLines.length > 0 ? descW + 8 : 0,
    codeSpec ? codeSpec.minBoxW : 0,
  );

  let height: number;
  let offsetY = 0;
  if (!codeSpec) {
    height =
      descLines.length === 0 ? 32 : (label ? 40 : 20) + descLines.length * CALLOUT_LINE_HEIGHT;
  } else {
    offsetY =
      descLines.length > 0
        ? (label ? 40 : 20) + descLines.length * CALLOUT_LINE_HEIGHT
        : label
          ? 37
          : 14;
    height = offsetY + codeSpec.height + 14;
  }

  const phiFloorW = codeSpec ? clamp(Math.round(height * PHI), 220, 368) : 0;
  const minW = codeSpec ? phiFloorW : descLines.length > 0 ? 196 : 60;
  const width = Math.max(minW, Math.ceil(contentW + padX * 2));
  const halfW = width / 2;

  const card: MeasuredCalloutCard = {
    halfW,
    height,
    padX,
    label,
    descLines,
    markerClearance: packet.icon ? 21 : 13,
  };
  if (codeSpec) {
    card.code = {
      header: codeSpec.header,
      headerHeight: codeSpec.headerHeight,
      lines: codeSpec.lines,
      offsetY,
      width: width - padX * 2,
      height: codeSpec.height,
    };
  }
  return card;
}

function placeCalloutBox(
  packet: Packet,
  card: MeasuredCalloutCard,
  mid = pointAt(packet.path, 0.5),
): PacketCalloutBox {
  const placement: CalloutPlacement = packet.calloutPlacement ?? 'above';
  const { halfW, height, padX, label, descLines, code, markerClearance } = card;
  const cx = mid.x + (packet.calloutShift ?? 0);

  let boxTop: number;
  let boxBottom: number;

  if (placement === 'above') {
    const minY = Math.min(
      packet.path.p0.y,
      packet.path.p1.y,
      packet.path.p2.y,
      packet.path.p3.y,
      mid.y,
    );
    const baseBottom = Math.min(mid.y - 36, minY - 26, packet.clearTop - CALLOUT_NODE_CLEARANCE);
    boxBottom =
      packet.calloutBottom !== undefined ? Math.min(baseBottom, packet.calloutBottom) : baseBottom;

    const obstacles = [
      ...packet.labelAreas.map((area) => ({ area, hard: true })),
      ...(packet.dimmedNodeAreas ?? []).map((area) => ({ area, hard: false })),
    ].sort((a, b) => b.area.y - a.area.y);

    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (const { area, hard } of obstacles) {
        const overlapsX = cx - halfW < area.x + area.width && cx + halfW > area.x;
        const overlapsY = boxBottom - height < area.y + area.height && boxBottom > area.y;
        if (!overlapsX || !overlapsY) continue;
        const lifted = area.y - CALLOUT_LABEL_CLEARANCE;
        if (!hard && baseBottom - lifted > DIMMED_OBSTACLE_MAX_LIFT) continue;
        if (lifted < boxBottom) {
          boxBottom = lifted;
          moved = true;
        }
      }
      if (!moved) break;
    }
    boxTop = boxBottom - height;
  } else {
    const maxY = Math.max(
      packet.path.p0.y,
      packet.path.p1.y,
      packet.path.p2.y,
      packet.path.p3.y,
      mid.y,
    );
    const clearBottom = packet.clearBottom ?? maxY;
    const baseTop = Math.max(mid.y + 38, maxY + 26, clearBottom + CALLOUT_NODE_CLEARANCE);
    boxTop = packet.calloutTop !== undefined ? Math.max(baseTop, packet.calloutTop) : baseTop;

    const obstacles = [
      ...packet.labelAreas.map((area) => ({ area, hard: true })),
      ...(packet.dimmedNodeAreas ?? []).map((area) => ({ area, hard: false })),
    ].sort((a, b) => a.area.y + a.area.height - (b.area.y + b.area.height));

    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      for (const { area, hard } of obstacles) {
        const overlapsX = cx - halfW < area.x + area.width && cx + halfW > area.x;
        const overlapsY = boxTop < area.y + area.height && boxTop + height > area.y;
        if (!overlapsX || !overlapsY) continue;
        const pushed = area.y + area.height + CALLOUT_LABEL_CLEARANCE;
        if (!hard && pushed - baseTop > DIMMED_OBSTACLE_MAX_LIFT) continue;
        if (pushed > boxTop) {
          boxTop = pushed;
          moved = true;
        }
      }
      if (!moved) break;
    }
    boxBottom = boxTop + height;
  }

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

export const calloutRect = (box: PacketCalloutBox): Rect => ({
  x: box.cx - box.halfW,
  y: box.boxTop,
  width: box.halfW * 2,
  height: box.boxBottom - box.boxTop,
});

/**
 * Builds the path of the stationary annotation box and its leader pointer, whose tip
 * dynamically follows `dot` along the edge path while keeping a constant 13-command
 * clockwise path structure for SMIL `<animate attributeName="d">` interpolation.
 */
export function packetBubblePath(
  box: PacketCalloutBox,
  dot: Point,
  markerClearance = box.markerClearance ?? 13,
): string {
  const { cx, halfW, boxTop, boxBottom, placement } = box;
  const left = cx - halfW;
  const right = cx + halfW;
  const r = Math.min(CALLOUT_RADIUS, halfW, (boxBottom - boxTop) / 2);
  const n = (value: number) => value.toFixed(1);

  if (placement === 'below') {
    const dy = Math.min(-14, dot.y - boxTop);
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
    const tipY = Math.min(boxTop - 4, dot.y - (dy / dist) * pull);

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

  const dy = Math.max(14, dot.y - boxBottom);
  const rawDist = Math.hypot(dot.x - cx, dy);
  const tailHalf = Math.min(
    clamp(300 / Math.max(50, rawDist), 1.8, 5.5),
    Math.max(0, halfW - r - 6),
  );
  const maxOffset = Math.max(0, halfW - r - tailHalf - 8);
  const baseX = cx + clamp((dot.x - cx) * 0.3, -maxOffset, maxOffset);
  const baseRight = baseX + tailHalf;
  const baseLeft = baseX - tailHalf;
  const dx = dot.x - baseX;
  const dist = Math.hypot(dx, dy);
  const pull = Math.min(markerClearance, dist * 0.42);
  const tipX = dot.x - (dx / dist) * pull;
  const tipY = Math.max(boxBottom + 4, dot.y - (dy / dist) * pull);

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

const expandRect = (r: Rect, pad: number): Rect => ({
  x: r.x - pad,
  y: r.y - pad,
  width: r.width + pad * 2,
  height: r.height + pad * 2,
});

const pointInRect = (p: Point, r: Rect): boolean =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

function segmentIntersectsRect(a: Point, b: Point, r: Rect): boolean {
  if (r.width <= 0 || r.height <= 0) return false;
  let tMin = 0;
  let tMax = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > tMax) return false;
      if (t > tMin) tMin = t;
    } else {
      if (t < tMin) return false;
      if (t < tMax) tMax = t;
    }
    return true;
  };

  return (
    clip(-dx, a.x - r.x) &&
    clip(dx, r.x + r.width - a.x) &&
    clip(-dy, a.y - r.y) &&
    clip(dy, r.y + r.height - a.y) &&
    tMin <= tMax
  );
}

function countRailOverlaps(box: PacketCalloutBox, otherRailSamples: readonly Point[]): number {
  if (otherRailSamples.length === 0) return 0;
  const padded = expandRect(calloutRect(box), RAIL_CLEARANCE_PAD);
  let hits = 0;
  for (const sample of otherRailSamples) {
    if (pointInRect(sample, padded)) hits++;
  }
  return hits;
}

function countDimmedOverlaps(packet: Packet, box: PacketCalloutBox): number {
  const areas = packet.dimmedNodeAreas;
  if (!areas || areas.length === 0) return 0;
  const rect = calloutRect(box);
  let hits = 0;
  for (const area of areas) {
    if (rectOverlaps(rect, area)) hits++;
  }
  return hits;
}

function scoreCallout(
  packet: Packet,
  box: PacketCalloutBox,
  mid: Point,
  otherRailSamples: readonly Point[],
): number {
  const anchorY = box.placement === 'above' ? box.boxBottom : box.boxTop;
  const verticalDist = Math.abs(anchorY - mid.y);
  const shiftCost = Math.abs(box.cx - mid.x) * SHIFT_COST_WEIGHT;

  const anchor: Point = { x: box.cx, y: anchorY };
  let leaderCrossings = 0;
  const crossedCores = new Set<Rect>();
  for (const core of packet.nodeCores ?? []) {
    if (segmentIntersectsRect(anchor, mid, core)) {
      crossedCores.add(core);
      leaderCrossings++;
    }
  }
  if (packet.otherNodeCores && packet.otherNodeCores.length > 0) {
    const p20 = pointAt(packet.path, 0.2);
    const p80 = pointAt(packet.path, 0.8);
    for (const core of packet.otherNodeCores) {
      if (crossedCores.has(core)) continue;
      if (segmentIntersectsRect(anchor, p20, core) || segmentIntersectsRect(anchor, p80, core)) {
        crossedCores.add(core);
        leaderCrossings++;
      }
    }
  }

  const dimmedBodyOverlaps = countDimmedOverlaps(packet, box);
  const railOverlaps = countRailOverlaps(box, otherRailSamples);

  const placementBias =
    box.placement === 'below'
      ? packet.preferBelow
        ? 0
        : DEFAULT_BELOW_BIAS
      : packet.preferBelow
        ? PREFER_BELOW_ABOVE_BIAS
        : 0;

  return (
    verticalDist +
    shiftCost +
    leaderCrossings * LEADER_CROSSING_PENALTY +
    dimmedBodyOverlaps * DIMMED_OVERLAP_PENALTY +
    railOverlaps * RAIL_OVERLAP_PENALTY +
    placementBias
  );
}

function setPacketShift(packet: Packet, shift: number): void {
  if (Math.abs(shift) > 1e-6) packet.calloutShift = shift;
  else delete packet.calloutShift;
}

interface SoloCandidate {
  placement: CalloutPlacement;
  shift: number;
  box: PacketCalloutBox;
  score: number;
}

function bestPocketCandidate(
  packet: Packet,
  card: MeasuredCalloutCard,
  placement: CalloutPlacement,
  mid: Point,
  otherRailSamples: readonly Point[],
): SoloCandidate {
  const shifts: number[] = [0];
  for (const area of packet.labelAreas) {
    const overlapsHoriz = mid.x - card.halfW < area.x + area.width && mid.x + card.halfW > area.x;
    if (!overlapsHoriz) continue;
    const leftShift = area.x - CALLOUT_LABEL_CLEARANCE - card.halfW - mid.x;
    if (Math.abs(leftShift) <= POCKET_MAX_SHIFT) shifts.push(leftShift);
    const rightShift = area.x + area.width + CALLOUT_LABEL_CLEARANCE + card.halfW - mid.x;
    if (Math.abs(rightShift) <= POCKET_MAX_SHIFT) shifts.push(rightShift);
  }

  packet.calloutPlacement = placement;
  delete packet.calloutBottom;
  delete packet.calloutTop;

  let best: SoloCandidate | undefined;
  for (const shift of shifts) {
    setPacketShift(packet, shift);
    const box = placeCalloutBox(packet, card, mid);
    const score = scoreCallout(packet, box, mid, otherRailSamples);
    if (
      !best ||
      score < best.score - 1e-6 ||
      (Math.abs(score - best.score) <= 1e-6 && Math.abs(shift) < Math.abs(best.shift))
    ) {
      best = { placement, shift, box, score };
    }
  }

  delete packet.calloutShift;
  if (!best) {
    const fallbackBox = placeCalloutBox(packet, card, mid);
    return {
      placement,
      shift: 0,
      box: fallbackBox,
      score: scoreCallout(packet, fallbackBox, mid, otherRailSamples),
    };
  }
  return best;
}

const verticallyOverlaps = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  a.boxTop < b.boxBottom + CALLOUT_GAP && a.boxBottom + CALLOUT_GAP > b.boxTop;

const calloutsClash = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  a.cx - a.halfW < b.cx + b.halfW + CALLOUT_GAP &&
  a.cx + a.halfW + CALLOUT_GAP > b.cx - b.halfW &&
  verticallyOverlaps(a, b);

interface CalloutEntry {
  packet: Packet;
  card: MeasuredCalloutCard;
  index: number;
  mid: Point;
  midX: number;
  tieX: number;
  otherRailSamples: Point[];
  soloAbove: SoloCandidate;
  soloBelow?: SoloCandidate;
  soloShift: number;
  box: PacketCalloutBox;
}

interface PavaBlock {
  members: CalloutEntry[];
  offsets: number[];
  leftCx: number;
  leftEdge: number;
  rightEdge: number;
}

function partitionVerticalClusters(entries: readonly CalloutEntry[]): CalloutEntry[][] {
  const visited = new Set<number>();
  const clusters: CalloutEntry[][] = [];
  for (let i = 0; i < entries.length; i++) {
    if (visited.has(i)) continue;
    const queue = [i];
    visited.add(i);
    const indices: number[] = [];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === undefined) continue;
      indices.push(cur);
      const curEntry = entries[cur];
      if (!curEntry) continue;
      for (let j = 0; j < entries.length; j++) {
        if (visited.has(j)) continue;
        const otherEntry = entries[j];
        if (otherEntry && verticallyOverlaps(curEntry.box, otherEntry.box)) {
          visited.add(j);
          queue.push(j);
        }
      }
    }
    indices.sort((a, b) => a - b);
    clusters.push(indices.flatMap((idx) => entries[idx] ?? []));
  }
  return clusters;
}

function buildPavaBlock(members: CalloutEntry[]): PavaBlock {
  const first = members[0];
  const last = members[members.length - 1];
  if (!first || !last) {
    return { members: [], offsets: [], leftCx: 0, leftEdge: 0, rightEdge: 0 };
  }
  if (members.length === 1) {
    const leftCx = first.midX + first.soloShift;
    return {
      members,
      offsets: [0],
      leftCx,
      leftEdge: leftCx - first.box.halfW,
      rightEdge: leftCx + first.box.halfW,
    };
  }
  const sep = CALLOUT_GAP + CALLOUT_SHIFT_SLACK;
  const offsets: number[] = [0];
  for (let i = 1; i < members.length; i++) {
    const prev = members[i - 1];
    const cur = members[i];
    const prevOff = offsets[i - 1] ?? 0;
    offsets.push(prevOff + (prev?.box.halfW ?? 0) + sep + (cur?.box.halfW ?? 0));
  }
  let sumDiff = 0;
  for (let i = 0; i < members.length; i++) {
    sumDiff += (members[i]?.midX ?? 0) - (offsets[i] ?? 0);
  }
  const leftCx = sumDiff / members.length;
  const lastOffset = offsets[offsets.length - 1] ?? 0;
  return {
    members,
    offsets,
    leftCx,
    leftEdge: leftCx - first.box.halfW,
    rightEdge: leftCx + lastOffset + last.box.halfW,
  };
}

function solvePavaCluster(cluster: readonly CalloutEntry[]): PavaBlock[] {
  const sep = CALLOUT_GAP + CALLOUT_SHIFT_SLACK;
  const stack: PavaBlock[] = [];
  for (const entry of cluster) {
    stack.push(buildPavaBlock([entry]));
    while (stack.length >= 2) {
      const right = stack[stack.length - 1];
      const left = stack[stack.length - 2];
      if (!left || !right || left.rightEdge + sep <= right.leftEdge) break;
      stack.pop();
      stack.pop();
      stack.push(buildPavaBlock([...left.members, ...right.members]));
    }
  }
  return stack;
}

function countClashes(entries: readonly CalloutEntry[]): number {
  let count = 0;
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!a) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (b && calloutsClash(a.box, b.box)) count++;
    }
  }
  return count;
}

function separateSubsetByPava(subset: readonly CalloutEntry[]): void {
  if (subset.length < 2) return;
  for (let pass = 0; pass < 3; pass++) {
    const clusters = partitionVerticalClusters(subset);
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      for (const block of solvePavaCluster(cluster)) {
        block.members.forEach((entry, i) => {
          const shift = block.leftCx + (block.offsets[i] ?? 0) - entry.midX;
          setPacketShift(entry.packet, shift);
        });
      }
    }
    for (const entry of subset) {
      entry.box = placeCalloutBox(entry.packet, entry.card, entry.mid);
    }
    if (countClashes(subset) === 0) break;
  }
}

function enumeratePlacementAssignments(entries: readonly CalloutEntry[]): CalloutPlacement[][] {
  if (entries.length > 5) {
    return [
      entries.map((e) =>
        e.soloBelow && e.soloBelow.score < e.soloAbove.score ? 'below' : 'above',
      ),
    ];
  }
  const results: CalloutPlacement[][] = [[]];
  for (const entry of entries) {
    const options: readonly CalloutPlacement[] = entry.soloBelow ? ['above', 'below'] : ['above'];
    const next: CalloutPlacement[][] = [];
    for (const prefix of results) {
      for (const opt of options) {
        next.push([...prefix, opt]);
      }
    }
    results.splice(0, results.length, ...next);
  }
  return results;
}

function alignShelf(allEntries: readonly CalloutEntry[], placement: CalloutPlacement): void {
  const sideEntries = allEntries.filter((e) => e.box.placement === placement);
  for (const cluster of partitionVerticalClusters(sideEntries)) {
    if (cluster.length < 2) continue;

    if (placement === 'above') {
      const minBottom = Math.min(...cluster.map((e) => e.box.boxBottom));
      const shelfGroup = cluster.filter(
        (e) => e.box.boxBottom - minBottom <= PARALLEL_SHELF_TOLERANCE,
      );
      if (shelfGroup.length < 2 || shelfGroup.every((e) => e.box.boxBottom === minBottom)) {
        continue;
      }
      const prevRailHits = shelfGroup.reduce(
        (sum, e) => sum + countRailOverlaps(e.box, e.otherRailSamples),
        0,
      );
      const prevDimmedHits = shelfGroup.reduce(
        (sum, e) => sum + countDimmedOverlaps(e.packet, e.box),
        0,
      );
      const prevBoxes = new Map(shelfGroup.map((e) => [e, e.box]));
      for (const entry of shelfGroup) {
        entry.packet.calloutBottom = minBottom;
        entry.box = placeCalloutBox(entry.packet, entry.card, entry.mid);
      }
      const nextRailHits = shelfGroup.reduce(
        (sum, e) => sum + countRailOverlaps(e.box, e.otherRailSamples),
        0,
      );
      const nextDimmedHits = shelfGroup.reduce(
        (sum, e) => sum + countDimmedOverlaps(e.packet, e.box),
        0,
      );
      if (
        countClashes(allEntries) > 0 ||
        nextRailHits > prevRailHits ||
        nextDimmedHits > prevDimmedHits
      ) {
        for (const entry of shelfGroup) {
          delete entry.packet.calloutBottom;
          const prev = prevBoxes.get(entry);
          if (prev) entry.box = prev;
        }
      }
    } else {
      const maxTop = Math.max(...cluster.map((e) => e.box.boxTop));
      const shelfGroup = cluster.filter((e) => maxTop - e.box.boxTop <= PARALLEL_SHELF_TOLERANCE);
      if (shelfGroup.length < 2 || shelfGroup.every((e) => e.box.boxTop === maxTop)) {
        continue;
      }
      const prevRailHits = shelfGroup.reduce(
        (sum, e) => sum + countRailOverlaps(e.box, e.otherRailSamples),
        0,
      );
      const prevDimmedHits = shelfGroup.reduce(
        (sum, e) => sum + countDimmedOverlaps(e.packet, e.box),
        0,
      );
      const prevBoxes = new Map(shelfGroup.map((e) => [e, e.box]));
      for (const entry of shelfGroup) {
        entry.packet.calloutTop = maxTop;
        entry.box = placeCalloutBox(entry.packet, entry.card, entry.mid);
      }
      const nextRailHits = shelfGroup.reduce(
        (sum, e) => sum + countRailOverlaps(e.box, e.otherRailSamples),
        0,
      );
      const nextDimmedHits = shelfGroup.reduce(
        (sum, e) => sum + countDimmedOverlaps(e.packet, e.box),
        0,
      );
      if (
        countClashes(allEntries) > 0 ||
        nextRailHits > prevRailHits ||
        nextDimmedHits > prevDimmedHits
      ) {
        for (const entry of shelfGroup) {
          delete entry.packet.calloutTop;
          const prev = prevBoxes.get(entry);
          if (prev) entry.box = prev;
        }
      }
    }
  }
}

/**
 * Optimizes placement (`'above'` vs `'below'`), obstacle-side pocket nudges, symmetric
 * `mid.x`-ordered PAVA separation, and shared shelf alignment for all callouts in a phase.
 */
export function separatePhaseCallouts(phase: readonly Packet[]): void {
  for (const packet of phase) {
    delete packet.calloutShift;
    delete packet.calloutPlacement;
    delete packet.calloutBottom;
    delete packet.calloutTop;
  }
  if (phase.length === 0) return;

  const railSamplesByIndex = phase.map((packet) =>
    RAIL_SAMPLE_TS.map((t) => pointAt(packet.path, t)),
  );

  const entries: CalloutEntry[] = [];
  phase.forEach((packet, index) => {
    const card = measureCalloutCard(packet);
    if (!card) return;
    const mid = pointAt(packet.path, 0.5);
    const otherRailSamples = railSamplesByIndex.flatMap((samples, j) =>
      j === index ? [] : samples,
    );
    const soloAbove = bestPocketCandidate(packet, card, 'above', mid, otherRailSamples);
    const soloBelow =
      packet.clearBottom !== undefined
        ? bestPocketCandidate(packet, card, 'below', mid, otherRailSamples)
        : undefined;
    delete packet.calloutPlacement;
    delete packet.calloutShift;
    const entry: CalloutEntry = {
      packet,
      card,
      index,
      mid,
      midX: mid.x,
      tieX: packet.path.p0.x + packet.path.p3.x,
      otherRailSamples,
      soloAbove,
      soloShift: soloAbove.shift,
      box: soloAbove.box,
    };
    if (soloBelow) entry.soloBelow = soloBelow;
    entries.push(entry);
  });

  if (entries.length === 0) return;

  if (entries.length === 1) {
    const only = entries[0];
    if (!only) return;
    const best =
      only.soloBelow && only.soloBelow.score < only.soloAbove.score - 1e-6
        ? only.soloBelow
        : only.soloAbove;
    if (only.packet.clearBottom !== undefined || best.placement === 'below') {
      only.packet.calloutPlacement = best.placement;
    }
    setPacketShift(only.packet, best.shift);
    return;
  }

  entries.sort((a, b) => a.midX - b.midX || a.tieX - b.tieX || a.index - b.index);

  const assignments = enumeratePlacementAssignments(entries);
  let bestCost = Number.POSITIVE_INFINITY;
  let bestState:
    | ReadonlyArray<{ placement: CalloutPlacement; shift: number; box: PacketCalloutBox }>
    | undefined;

  for (const assignment of assignments) {
    entries.forEach((entry, i) => {
      const placement = assignment[i] ?? 'above';
      const solo =
        placement === 'below' && entry.soloBelow !== undefined ? entry.soloBelow : entry.soloAbove;
      entry.packet.calloutPlacement = placement;
      delete entry.packet.calloutBottom;
      delete entry.packet.calloutTop;
      entry.soloShift = solo.shift;
      setPacketShift(entry.packet, solo.shift);
      entry.box = solo.box;
    });

    const aboveSubset = entries.filter((e) => e.packet.calloutPlacement === 'above');
    const belowSubset = entries.filter((e) => e.packet.calloutPlacement === 'below');
    separateSubsetByPava(aboveSubset);
    separateSubsetByPava(belowSubset);

    if (countClashes(entries) > 0) {
      for (const entry of entries) {
        entry.soloShift = entry.packet.calloutShift ?? 0;
      }
      separateSubsetByPava(entries);
    }

    const totalScore = entries.reduce(
      (sum, e) => sum + scoreCallout(e.packet, e.box, e.mid, e.otherRailSamples),
      0,
    );
    const cost = totalScore + countClashes(entries) * CLASH_PENALTY;
    if (cost < bestCost - 1e-6) {
      bestCost = cost;
      bestState = entries.map((e) => ({
        placement: e.packet.calloutPlacement ?? 'above',
        shift: e.packet.calloutShift ?? 0,
        box: e.box,
      }));
    }
  }

  if (bestState) {
    entries.forEach((entry, i) => {
      const saved = bestState[i];
      if (!saved) return;
      if (entry.packet.clearBottom !== undefined || saved.placement === 'below') {
        entry.packet.calloutPlacement = saved.placement;
      } else {
        delete entry.packet.calloutPlacement;
      }
      delete entry.packet.calloutBottom;
      delete entry.packet.calloutTop;
      setPacketShift(entry.packet, saved.shift);
      entry.box = saved.box;
    });
  }

  alignShelf(entries, 'above');
  alignShelf(entries, 'below');
}
