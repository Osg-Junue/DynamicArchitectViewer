import { estimateTextWidth, isWide } from '../model/text';

export { estimateTextWidth };

export interface FitTextOptions {
  measure?: (text: string, fontSize: number) => number;
  trimBeforeEllipsis?: boolean;
}

export interface WrapTextOptions extends FitTextOptions {
  isBreakable?: (ch: string) => boolean;
}

const defaultIsBreakable = (ch: string): boolean => ch === ' ' || ch === '\n' || isWide(ch);

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

  const tokens: string[] = [];
  let word = '';
  for (const ch of clean) {
    if (isBreakable(ch)) {
      if (word) {
        tokens.push(word);
        word = '';
      }
      tokens.push(ch);
    } else {
      word += ch;
    }
  }
  if (word) tokens.push(word);

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
