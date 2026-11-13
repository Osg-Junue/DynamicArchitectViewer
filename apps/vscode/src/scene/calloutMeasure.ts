import { normalizeCodeIndent } from '../model/text';
import type { CodeBlock } from '../model/types';
import type { PacketCalloutCodeBox } from './callout';
import type { Packet } from './resolve';
import { fitText, type TextMeasure, textWidth, wrapText } from './text';

/**
 * How the text of a callout is measured. Without a browser that is the estimate, which has to
 * leave room for fonts it cannot see. A player in a browser hands in a real measurement, so
 * that a callout is exactly as wide as its text in the font it is drawn in.
 */
let measure: TextMeasure = textWidth;

/** Measures the text of callouts with `by` from here on; with the estimate again when `null`. */
export function measureCalloutsWith(by: TextMeasure | null): void {
  measure = by ?? textWidth;
}

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
/** The narrowest a callout with code is. */
const CALLOUT_CODE_MIN_WIDTH = 180;
export const CALLOUT_LABEL_SIZE = 15;
export const CALLOUT_DESC_SIZE = 14;
export const CALLOUT_LINE_HEIGHT = 22;
/**
 * Added to the width a text is estimated to take, beside the padding around it: the estimate
 * already leaves room, so this only keeps a rounding from touching.
 */
const TEXT_SLACK = 2;
const CODE_SLACK = 4;
/** A description is cut after this many lines. */
const DESC_MAX_LINES = 4;
/** The lines of a description are not evened out to less than this. */
const DESC_MIN_WIDTH = 202;
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
    fitText(line, CALLOUT_CODE_SIZE, CALLOUT_CODE_MAX_TEXT_WIDTH, 'mono', measure),
  );

  const lang = code.lang?.trim() ?? '';
  const title = code.title?.trim() ?? '';
  const rawHeader = lang && title ? `${lang} · ${title}` : lang || title;
  const header = rawHeader
    ? fitText(rawHeader, CALLOUT_CODE_SIZE, CALLOUT_CODE_MAX_TEXT_WIDTH - 28, 'mono', measure)
    : '';
  const headerHeight = header ? CALLOUT_CODE_HEADER_HEIGHT : 0;

  const monoW = (s: string) => measure(s, CALLOUT_CODE_SIZE, 'mono');
  const codeTextW = Math.max(header ? monoW(`{ } ${header}`) : 0, ...lines.map(monoW)) + CODE_SLACK;
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

/**
 * The description in as few lines as fit within `maxW`, each line then made as short as that
 * number of lines allows, down to `minW`: the lines come out evenly long, and none ends early.
 */
function balanceCalloutLines(text: string, maxW: number, minW: number): string[] {
  const lines = wrapText(text, CALLOUT_DESC_SIZE, maxW, DESC_MAX_LINES, 'normal', measure);
  const k = lines.length;
  if (text.includes('\n') || k < 2) return lines;
  const baseEllipses = countEllipses(text);
  if (countEllipses(lines.join('')) > baseEllipses || minW >= maxW) {
    return lines;
  }
  let best = lines;
  let lo = minW;
  let hi = maxW;
  for (let iter = 0; iter < 8; iter++) {
    const midW = (lo + hi) / 2;
    const cand = wrapText(text, CALLOUT_DESC_SIZE, midW, DESC_MAX_LINES, 'normal', measure);
    if (cand.length <= k && countEllipses(cand.join('')) <= baseEllipses) {
      best = cand;
      hi = midW;
    } else {
      lo = midW;
    }
  }
  return best;
}

/** A last line shorter than this share of the width is not left on its own. */
const ORPHAN = 0.25;

/**
 * The description as it is set in a callout whose text is `width` wide: its lines as long as
 * they can be. Where that leaves a few words alone on the last line, the lines above give some
 * up, as long as that takes no line more.
 */
function fillLines(text: string, width: number): string[] {
  const lines = wrapText(text, CALLOUT_DESC_SIZE, width, DESC_MAX_LINES, 'normal', measure);
  if (lines.length < 2 || text.includes('\n')) return lines;
  const alone = (set: readonly string[]): boolean =>
    measure(set[set.length - 1] ?? '', CALLOUT_DESC_SIZE, 'normal') < ORPHAN * width;
  if (!alone(lines)) return lines;
  const baseEllipses = countEllipses(text);
  for (let w = width - 6; w >= Math.max(DESC_MIN_WIDTH, width * 0.55); w -= 6) {
    const narrower = wrapText(text, CALLOUT_DESC_SIZE, w, DESC_MAX_LINES, 'normal', measure);
    if (narrower.length !== lines.length || countEllipses(narrower.join('')) > baseEllipses) break;
    if (!alone(narrower)) return narrower;
  }
  return lines;
}

const widestOf = (lines: readonly string[]): number =>
  lines.reduce((m, line) => Math.max(m, measure(line, CALLOUT_DESC_SIZE, 'normal')), 0);

/** From the top of a callout to its code, and its whole height. */
function cardHeight(
  hasLabel: boolean,
  descLineCount: number,
  codeHeight: number | undefined,
): { offsetY: number; height: number } {
  // The baseline of the last line of text: of the description, or else of the heading.
  const lastBaseline =
    descLineCount > 0
      ? (hasLabel ? CALLOUT_DESC_BASELINE.withLabel : CALLOUT_DESC_BASELINE.bare) +
        (descLineCount - 1) * CALLOUT_LINE_HEIGHT
      : hasLabel
        ? CALLOUT_LABEL_BASELINE
        : undefined;
  if (codeHeight === undefined) {
    return {
      offsetY: 0,
      height:
        descLineCount === 0 ? CALLOUT_ONE_LINE_HEIGHT : (lastBaseline ?? 0) + CALLOUT_TEXT_BOTTOM,
    };
  }
  const offsetY =
    lastBaseline === undefined ? CALLOUT_CODE_OUTER_PAD : lastBaseline + CALLOUT_CODE_GAP;
  return { offsetY, height: offsetY + codeHeight + CALLOUT_CODE_OUTER_PAD };
}

export interface MeasuredCalloutCard {
  halfW: number;
  height: number;
  padX: number;
  label: string;
  descLines: string[];
  code?: PacketCalloutCodeBox;
  /** Room before the heading for the stop number; the heading starts after it. */
  numberRoom: number;
  /** How far in the description and the code start: the same room, when there is no heading. */
  bodyIndent: number;
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

/**
 * What a callout holds and how large it is. A callout is as wide as what it holds: nothing
 * widens it but its heading, its code and the lines of its description.
 *
 * The description is the one part that can be shaped. It takes as few lines as fit in the
 * widest a callout may be, so that a sentence is not broken where a little more width keeps
 * it whole.
 */
export function measureCalloutCard(packet: CalloutText): MeasuredCalloutCard | null {
  const codeSpec = packet.code ? prepareCodeSpec(packet.code) : undefined;
  const label = packet.label
    ? fitText(packet.label, CALLOUT_LABEL_SIZE, CALLOUT_MAX_TEXT_WIDTH, 'bold', measure)
    : '';
  const labelW = label ? measure(label, CALLOUT_LABEL_SIZE, 'bold') : 0;
  const numberRoom = packet.stopLabel === undefined ? 0 : CALLOUT_NUMBER_ROOM;
  // The number stands before the heading, and what follows starts below the number. Without
  // a heading it stands before the first line, and all lines start after it.
  const bodyIndent = label ? 0 : numberRoom;
  const headW = label ? numberRoom + labelW + TEXT_SLACK : 0;
  /** What cannot be made narrower: the heading with its number, and the code. */
  const fixedW = Math.max(headW, codeSpec ? codeSpec.minBoxW : 0);
  const padX =
    packet.description || codeSpec !== undefined ? CALLOUT_OUTER_PAD_X : CALLOUT_COMPACT_PAD_X;
  const widthFor = (descLines: readonly string[]): number =>
    Math.max(
      codeSpec ? CALLOUT_CODE_MIN_WIDTH : descLines.length > 0 ? 210 : 60,
      Math.ceil(
        Math.max(fixedW, descLines.length > 0 ? widestOf(descLines) + TEXT_SLACK : 0) + padX * 2,
      ),
    ) + bodyIndent;

  let descLines: string[] = [];
  if (packet.description) {
    // As few lines as fit in the widest a callout may be: a description that fits on one line
    // gets one, even where that makes the callout wider than its code. Several lines are
    // evened out, so that the callout is no wider than they need...
    const maxW = Math.max(CALLOUT_MAX_TEXT_WIDTH, fixedW - TEXT_SLACK);
    descLines = balanceCalloutLines(packet.description, maxW, DESC_MIN_WIDTH);
    // ...and where the heading or the code is wider than those lines, they take that room.
    descLines = fillLines(
      packet.description,
      Math.max(fixedW, widestOf(descLines) + TEXT_SLACK) - TEXT_SLACK,
    );
  }
  if (!label && descLines.length === 0 && !codeSpec) return null;

  const { offsetY, height } = cardHeight(label !== '', descLines.length, codeSpec?.height);
  const width = widthFor(descLines);
  const card: MeasuredCalloutCard = {
    halfW: width / 2,
    height,
    padX,
    label,
    descLines,
    numberRoom,
    bodyIndent,
  };
  if (codeSpec) {
    card.code = {
      header: codeSpec.header,
      headerHeight: codeSpec.headerHeight,
      lines: codeSpec.lines,
      offsetY,
      width: width - bodyIndent - padX * 2,
      height: codeSpec.height,
    };
  }
  return card;
}
