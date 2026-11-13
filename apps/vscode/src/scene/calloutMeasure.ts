import { isWide, normalizeCodeIndent } from '../model/text';
import type { CodeBlock } from '../model/types';
import type { PacketCalloutCodeBox } from './callout';
import { clamp } from './geometry';
import type { Packet } from './resolve';
import { fitText, type WrapTextOptions, wrapText } from './text';

const PHI = (1 + Math.sqrt(5)) / 2;

export const CALLOUT_RADIUS = 10;
export const CALLOUT_CODE_RADIUS = 6;
export const CALLOUT_OUTER_PAD_X = 16;
const CALLOUT_COMPACT_PAD_X = 13;

const CALLOUT_MAX_TEXT_WIDTH = 384;
const CALLOUT_NO_CODE_DESC_MAX_WIDTH = 340;
export const CALLOUT_LABEL_SIZE = 14;
export const CALLOUT_DESC_SIZE = 13;
export const CALLOUT_LINE_HEIGHT = 20;

export const CALLOUT_CODE_SIZE = 11.5;
export const CALLOUT_CODE_HEAD_SIZE = 11;
export const CALLOUT_CODE_LINE_HEIGHT = 17.5;
export const CALLOUT_CODE_PAD_X = 13;
export const CALLOUT_CODE_MAX_LINES = 10;
const CALLOUT_CODE_MAX_TEXT_WIDTH = 404;
export const CALLOUT_CODE_HEADER_HEIGHT = 28;

/** Room on the left of a callout for the number it shares with its stop on the rail. */
export const CALLOUT_NUMBER_ROOM = 24;

/** Keeps a callout clear of its endpoint nodes, including their badges, crop marks, and subtitles. */
export const CALLOUT_NODE_CLEARANCE = 16;
export const CALLOUT_LABEL_CLEARANCE = 6;
export const CALLOUT_GAP = 16;

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

export interface MeasuredCalloutCard {
  halfW: number;
  height: number;
  padX: number;
  label: string;
  descLines: string[];
  code?: PacketCalloutCodeBox;
  /** Width added on the left for the stop number; the content starts after it. */
  numberRoom: number;
}

/** What a callout shows of a packet. */
type CalloutText = Pick<Packet, 'label' | 'description' | 'code' | 'stopLabel'>;

/** What of a callout's text does not fit, and is shown cut off with an ellipsis. */
export interface CalloutCuts {
  label: boolean;
  description: boolean;
  /** How many lines the code has, when that is more than the callout shows; otherwise 0. */
  codeLines: number;
  /** The lines of the code, counted from 1, that are too wide. */
  wideCodeLines: number[];
}

/** Which parts of a packet's label, description and code a callout cuts. */
export function calloutCuts(text: CalloutText): CalloutCuts {
  const card = measureCalloutCard(text);
  const lines = text.code
    ? normalizeCodeIndent(text.code.body, { stripAllOuterBlankLines: true }).split('\n')
    : [];
  const shown = card?.code?.lines ?? [];
  const tooMany = lines.length > CALLOUT_CODE_MAX_LINES;
  return {
    label: Boolean(text.label) && card?.label !== text.label,
    description:
      countEllipses((card?.descLines ?? []).join('')) > countEllipses(text.description ?? ''),
    codeLines: tooMany ? lines.length : 0,
    wideCodeLines: lines.flatMap((line, i) =>
      i < shown.length - (tooMany ? 1 : 0) && shown[i] !== line ? [i + 1] : [],
    ),
  };
}

export function measureCalloutCard(packet: CalloutText): MeasuredCalloutCard | null {
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
  const padX =
    descLines.length > 0 || codeSpec !== undefined ? CALLOUT_OUTER_PAD_X : CALLOUT_COMPACT_PAD_X;
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
  const numberRoom = packet.stopLabel === undefined ? 0 : CALLOUT_NUMBER_ROOM;
  const halfW = (width + numberRoom) / 2;

  const card: MeasuredCalloutCard = {
    halfW,
    height,
    padX,
    label,
    descLines,
    numberRoom,
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
