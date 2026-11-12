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

/** Keeps a callout above its endpoint nodes, including their badges and crop marks. */
const CALLOUT_NODE_CLEARANCE = 16;
const CALLOUT_LABEL_CLEARANCE = 6;
export const CALLOUT_GAP = 16;
/** Past the clash limit, because landing exactly on it would depend on rounding. */
const CALLOUT_SHIFT_SLACK = 1;
const DIMMED_OBSTACLE_MAX_LIFT = 280;
const PARALLEL_SHELF_TOLERANCE = 48;

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

/**
 * Computes the stationary speech-bubble box positioned above the packet's edge path.
 * Keeping the bubble body stationary while only its pointer tip tracks the moving dot
 * eliminates eye-tracking fatigue when reading multi-line descriptions and code blocks.
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
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

  let code: PacketCalloutCodeBox | undefined;
  if (codeSpec) {
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
  const baseBottom = Math.min(mid.y - 36, minY - 26, packet.clearTop - CALLOUT_NODE_CLEARANCE);
  let boxBottom =
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
  const boxTop = boxBottom - height;

  const box: PacketCalloutBox = {
    cx,
    halfW,
    boxTop,
    boxBottom,
    padX,
    label,
    descLines,
    markerClearance: packet.icon ? 21 : 13,
  };
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
export function packetBubblePath(
  box: PacketCalloutBox,
  dot: Point,
  markerClearance = box.markerClearance ?? 13,
): string {
  const { cx, halfW, boxTop, boxBottom } = box;
  const left = cx - halfW;
  const right = cx + halfW;
  const r = Math.min(CALLOUT_RADIUS, halfW, (boxBottom - boxTop) / 2);
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
  const n = (value: number) => value.toFixed(1);

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

const verticallyOverlaps = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  a.boxTop < b.boxBottom + CALLOUT_GAP && a.boxBottom + CALLOUT_GAP > b.boxTop;

const calloutsClash = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  a.cx - a.halfW < b.cx + b.halfW + CALLOUT_GAP &&
  a.cx + a.halfW + CALLOUT_GAP > b.cx - b.halfW &&
  verticallyOverlaps(a, b);

interface CalloutEntry {
  packet: Packet;
  index: number;
  midX: number;
  tieX: number;
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

/**
 * Packets of one phase play together, so their callouts must not cover each other.
 * Sorts callouts left-to-right by rail midpoint so pointers never cross, separates
 * clashing groups symmetrically around their center of mass via isotonic block merging,
 * and aligns close side-by-side parallel callouts onto a shared baseline shelf.
 */
export function separatePhaseCallouts(phase: readonly Packet[]): void {
  for (const packet of phase) {
    delete packet.calloutShift;
    delete packet.calloutBottom;
  }

  const entries: CalloutEntry[] = [];
  phase.forEach((packet, index) => {
    const box = computePacketCalloutBox(packet);
    if (!box) return;
    const midX = pointAt(packet.path, 0.5).x;
    const tieX = packet.path.p0.x + packet.path.p3.x;
    entries.push({ packet, index, midX, tieX, box });
  });
  if (entries.length < 2) return;

  entries.sort((a, b) => a.midX - b.midX || a.tieX - b.tieX || a.index - b.index);

  for (let pass = 0; pass < 3; pass++) {
    const clusters = partitionVerticalClusters(entries);
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      for (const block of solvePavaCluster(cluster)) {
        block.members.forEach((entry, i) => {
          const shift = block.leftCx + (block.offsets[i] ?? 0) - entry.midX;
          if (Math.abs(shift) > 1e-6) entry.packet.calloutShift = shift;
          else delete entry.packet.calloutShift;
        });
      }
    }
    for (const entry of entries) {
      const next = computePacketCalloutBox(entry.packet);
      if (next) entry.box = next;
    }
    const hasClash = entries.some((a, i) =>
      entries.slice(i + 1).some((b) => calloutsClash(a.box, b.box)),
    );
    if (!hasClash) break;
  }

  for (const cluster of partitionVerticalClusters(entries)) {
    if (cluster.length < 2) continue;
    const minBottom = Math.min(...cluster.map((e) => e.box.boxBottom));
    const shelfGroup = cluster.filter(
      (e) => e.box.boxBottom - minBottom <= PARALLEL_SHELF_TOLERANCE,
    );
    if (shelfGroup.length < 2 || shelfGroup.every((e) => e.box.boxBottom === minBottom)) {
      continue;
    }
    const prevBoxes = new Map(shelfGroup.map((e) => [e, e.box]));
    for (const entry of shelfGroup) {
      entry.packet.calloutBottom = minBottom;
      const next = computePacketCalloutBox(entry.packet);
      if (next) entry.box = next;
    }
    const hasClash = entries.some((a, i) =>
      entries.slice(i + 1).some((b) => calloutsClash(a.box, b.box)),
    );
    if (hasClash) {
      for (const entry of shelfGroup) {
        delete entry.packet.calloutBottom;
        const prev = prevBoxes.get(entry);
        if (prev) entry.box = prev;
      }
    }
  }
}
