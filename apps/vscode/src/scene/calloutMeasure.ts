import { normalizeCodeIndent } from '../model/text';
import type { CodeBlock } from '../model/types';
import type { PacketCalloutCodeBox } from './callout';
import { clamp } from './geometry';
import type { Packet } from './resolve';
import { fitText, textWidth, wrapText } from './text';

const PHI = (1 + Math.sqrt(5)) / 2;

export const CALLOUT_RADIUS = 10;
export const CALLOUT_CODE_RADIUS = 6;
/**
 * The spacing of a callout, top to bottom:
 *
 * - 16 around everything it holds: beside the text and the number, above the heading's
 *   capitals, below the last line and below a code box. A callout of one line is tighter.
 * - The number sits inside that padding, 10 from the text, level with the heading.
 * - The description starts further below the heading than its own lines are apart, so that
 *   the heading reads as a heading.
 * - The code box follows the text at the same distance, so that the three parts are evenly
 *   apart, and inside it the code has as much room above as below.
 */
export const CALLOUT_OUTER_PAD_X = 16;
const CALLOUT_COMPACT_PAD_X = 14;
/** Below a code box, and above one that is all the callout holds. */
const CALLOUT_CODE_OUTER_PAD = 16;

// The widths grow with the type, so that a callout holds as many characters at any size.
const CALLOUT_MAX_TEXT_WIDTH = 414;
const CALLOUT_NO_CODE_DESC_MAX_WIDTH = 366;
/** The narrowest and widest a callout with code makes its text. */
const CALLOUT_CODE_TEXT_WIDTH = { min: 254, max: CALLOUT_MAX_TEXT_WIDTH } as const;
export const CALLOUT_LABEL_SIZE = 15;
export const CALLOUT_DESC_SIZE = 14;
export const CALLOUT_LINE_HEIGHT = 22;
/** A description is cut after this many lines. */
const DESC_MAX_LINES = 4;
/** From the top of a callout to the baseline of its heading. */
export const CALLOUT_LABEL_BASELINE = 27;
/** From the top of a callout to the baseline of its description's first line. */
export const CALLOUT_DESC_BASELINE = { withLabel: 54, bare: 26 } as const;
/** From the baseline of the last line of text to the bottom of the callout. */
const CALLOUT_TEXT_BOTTOM = 18;
/** From the baseline of the last line of text to the code box below it. */
const CALLOUT_CODE_GAP = 15;
/** The height of a callout that is one heading and nothing else. */
export const CALLOUT_ONE_LINE_HEIGHT = 36;

export const CALLOUT_CODE_SIZE = 12.5;
export const CALLOUT_CODE_HEAD_SIZE = 12;
export const CALLOUT_CODE_LINE_HEIGHT = 19;
export const CALLOUT_CODE_PAD_X = 13;
export const CALLOUT_CODE_MAX_LINES = 10;
const CALLOUT_CODE_MAX_TEXT_WIDTH = 440;
export const CALLOUT_CODE_HEADER_HEIGHT = 30;
/** From the top of the code, below any header, to the baseline of its first line. */
export const CALLOUT_CODE_FIRST_BASELINE = 21;
/** From the baseline of the last line of code to the bottom of its box. */
const CALLOUT_CODE_BOTTOM = 15;

export const CALLOUT_NUMBER_RADIUS = 9;
/** Room on the left of a callout for the number it shares with its stop on the rail, and the gap after it. */
export const CALLOUT_NUMBER_ROOM = CALLOUT_NUMBER_RADIUS * 2 + 10;

export const CALLOUT_GAP = 16;

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
    fitText(line, CALLOUT_CODE_SIZE, CALLOUT_CODE_MAX_TEXT_WIDTH, 'mono'),
  );

  const lang = code.lang?.trim() ?? '';
  const title = code.title?.trim() ?? '';
  const rawHeader = lang && title ? `${lang} · ${title}` : lang || title;
  const header = rawHeader
    ? fitText(rawHeader, CALLOUT_CODE_SIZE, CALLOUT_CODE_MAX_TEXT_WIDTH - 28, 'mono')
    : '';
  const headerHeight = header ? CALLOUT_CODE_HEADER_HEIGHT : 0;

  const monoW = (s: string) => textWidth(s, CALLOUT_CODE_SIZE, 'mono');
  const codeTextW = Math.max(header ? monoW(`{ } ${header}`) : 0, ...lines.map(monoW)) + 8;
  const minBoxW = codeTextW + CALLOUT_CODE_PAD_X * 2;
  const height =
    headerHeight +
    CALLOUT_CODE_FIRST_BASELINE +
    (lines.length - 1) * CALLOUT_CODE_LINE_HEIGHT +
    CALLOUT_CODE_BOTTOM;

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
  const lines = wrapText(text, CALLOUT_DESC_SIZE, descMaxW, DESC_MAX_LINES);
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
    const cand = wrapText(text, CALLOUT_DESC_SIZE, midW, DESC_MAX_LINES);
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
    ? fitText(packet.label, CALLOUT_LABEL_SIZE, CALLOUT_MAX_TEXT_WIDTH, 'bold')
    : '';
  const labelW = label ? textWidth(label, CALLOUT_LABEL_SIZE, 'bold') : 0;

  let phiInnerW = 0;
  let descMaxW = CALLOUT_NO_CODE_DESC_MAX_WIDTH;
  if (codeSpec) {
    const { min, max } = CALLOUT_CODE_TEXT_WIDTH;
    const estH =
      (packet.label ? CALLOUT_LABEL_BASELINE + CALLOUT_CODE_GAP : CALLOUT_CODE_OUTER_PAD) +
      (packet.description ? 2 * CALLOUT_LINE_HEIGHT : 0) +
      codeSpec.height +
      CALLOUT_CODE_OUTER_PAD;
    phiInnerW = clamp(Math.round(estH * PHI - 32), min, max);
    descMaxW = clamp(Math.max(phiInnerW, Math.ceil(codeSpec.minBoxW)), min, max);
  }

  const descLines = packet.description
    ? balanceCalloutLines(
        packet.description,
        descMaxW,
        Math.max(
          202,
          labelW + 8,
          codeSpec ? Math.ceil(Math.max(codeSpec.minBoxW, phiInnerW) * 0.82) : 0,
        ),
      )
    : [];
  if (!label && descLines.length === 0 && !codeSpec) return null;

  const descW = descLines.reduce(
    (m, line) => Math.max(m, textWidth(line, CALLOUT_DESC_SIZE, 'normal')),
    0,
  );
  const padX =
    descLines.length > 0 || codeSpec !== undefined ? CALLOUT_OUTER_PAD_X : CALLOUT_COMPACT_PAD_X;
  const contentW = Math.max(
    label ? labelW + 8 : 0,
    descLines.length > 0 ? descW + 8 : 0,
    codeSpec ? codeSpec.minBoxW : 0,
  );

  // The baseline of the last line of text: of the description, or else of the heading.
  const lastBaseline =
    descLines.length > 0
      ? (label ? CALLOUT_DESC_BASELINE.withLabel : CALLOUT_DESC_BASELINE.bare) +
        (descLines.length - 1) * CALLOUT_LINE_HEIGHT
      : label
        ? CALLOUT_LABEL_BASELINE
        : undefined;
  let height: number;
  let offsetY = 0;
  if (!codeSpec) {
    height =
      descLines.length === 0 ? CALLOUT_ONE_LINE_HEIGHT : (lastBaseline ?? 0) + CALLOUT_TEXT_BOTTOM;
  } else {
    offsetY = lastBaseline === undefined ? CALLOUT_CODE_OUTER_PAD : lastBaseline + CALLOUT_CODE_GAP;
    height = offsetY + codeSpec.height + CALLOUT_CODE_OUTER_PAD;
  }

  const phiFloorW = codeSpec ? clamp(Math.round(height * PHI), 236, 396) : 0;
  const minW = codeSpec ? phiFloorW : descLines.length > 0 ? 210 : 60;
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
