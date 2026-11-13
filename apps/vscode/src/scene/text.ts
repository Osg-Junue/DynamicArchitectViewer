import { estimateTextWidth, isWide } from '../model/text';

export { estimateTextWidth };

/** Sizes of the text a node carries, and how much of its cell's width its labels may take. */
export const NODE_LABEL_SIZE = 14;
export const NODE_SUB_SIZE = 11.5;
export const NODE_TEXT_INSET = 8;
export const BADGE_SIZE = 11;
export const BADGE_MAX_WIDTH = 120;

export interface FitTextOptions {
  measure?: (text: string, fontSize: number) => number;
  trimBeforeEllipsis?: boolean;
}

export interface WrapTextOptions extends FitTextOptions {
  isBreakable?: (ch: string) => boolean;
}

const defaultIsBreakable = (ch: string): boolean => ch === ' ' || ch === '\n' || isWide(ch);

const KINSOKU_OPEN_RE = /^[([{（「『【〈《〔]+$/;
const KINSOKU_TRAILING_OPEN_RE = /^(.+?)([([{（「『【〈《〔]+)$/;
const KINSOKU_CLOSE_RE =
  /^[)\]}）」』】〉》〕。、，．・：；！？…‥ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ]+/;

const isWhitespaceToken = (tok: string): boolean => tok === ' ' || tok === '\n';

/**
 * Enforces CJK/ASCII kinsoku line-breaking rules in three passes:
 * 1. Detach trailing opening brackets from a word (e.g. `WAF(` before `検証`) so they stay with what follows.
 * 2. Attach leading closing punctuation/small kana to the preceding non-whitespace token.
 * 3. Attach opening brackets forward to the next non-whitespace token.
 */
function coalesceKinsokuTokens(raw: readonly string[]): string[] {
  const splitOpen = raw.flatMap((tok, i) => {
    const next = raw[i + 1];
    if (next !== undefined && !isWhitespaceToken(next) && !KINSOKU_OPEN_RE.test(tok)) {
      const match = KINSOKU_TRAILING_OPEN_RE.exec(tok);
      if (match?.[1] && match[2]) return [match[1], match[2]];
    }
    return [tok];
  });

  const afterClose: string[] = [];
  for (const tok of splitOpen) {
    const prev = afterClose[afterClose.length - 1];
    if (
      prev !== undefined &&
      !isWhitespaceToken(prev) &&
      !isWhitespaceToken(tok) &&
      KINSOKU_CLOSE_RE.test(tok)
    ) {
      afterClose[afterClose.length - 1] = prev + tok;
    } else {
      afterClose.push(tok);
    }
  }

  const out: string[] = [];
  let pendingOpen = '';
  for (const tok of afterClose) {
    if (KINSOKU_OPEN_RE.test(tok)) {
      pendingOpen += tok;
      continue;
    }
    if (pendingOpen) {
      if (isWhitespaceToken(tok)) out.push(pendingOpen, tok);
      else out.push(pendingOpen + tok);
      pendingOpen = '';
    } else {
      out.push(tok);
    }
  }
  if (pendingOpen) out.push(pendingOpen);
  return out;
}

/** Truncates text with an ellipsis so it fits within maxWidth. */
export function fitText(
  text: string,
  fontSize: number,
  maxWidth: number,
  options: FitTextOptions = {},
): string {
  const measure = options.measure ?? estimateTextWidth;
  if (measure(text, fontSize) <= maxWidth) return text;
  let out = '';
  for (const ch of text) {
    if (measure(`${out + ch}…`, fontSize) > maxWidth) break;
    out += ch;
  }
  return `${options.trimBeforeEllipsis ? out.trimEnd() : out}…`;
}

/**
 * Wraps text into at most `maxLines` lines that each fit within `maxWidth`.
 * Line breaks in the text are kept; blank lines are dropped to save the limited lines.
 */
export function wrapText(
  text: string,
  fontSize: number,
  maxWidth: number,
  maxLines = 3,
  options: WrapTextOptions = {},
): string[] {
  const clean = text
    .trim()
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[^\S\n]+/g, ' ');
  if (!clean) return [];

  const isBreakable = options.isBreakable ?? defaultIsBreakable;
  const measure = options.measure ?? estimateTextWidth;

  const rawTokens: string[] = [];
  let word = '';
  for (const ch of clean) {
    if (isBreakable(ch)) {
      if (word) {
        rawTokens.push(word);
        word = '';
      }
      rawTokens.push(ch);
    } else {
      word += ch;
    }
  }
  if (word) rawTokens.push(word);
  const tokens = coalesceKinsokuTokens(rawTokens);

  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';
    if (!current && tok === ' ') continue;
    const candidate = current + tok;
    if (tok === '\n' || (current && measure(candidate, fontSize) > maxWidth)) {
      if (lines.length + 1 >= maxLines) {
        const rest = (current + tokens.slice(i).join('')).trim().replace(/\n/g, ' ');
        lines.push(fitText(rest, fontSize, maxWidth, options));
        return lines;
      }
      lines.push(fitText(current.trimEnd(), fontSize, maxWidth, options));
      current = tok === ' ' || tok === '\n' ? '' : tok;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) {
    lines.push(fitText(current.trim(), fontSize, maxWidth, options));
  }
  return lines;
}
