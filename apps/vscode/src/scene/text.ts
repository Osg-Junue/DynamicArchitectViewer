import { estimateTextWidth, isWide } from '../model/text';

export { estimateTextWidth };

/** Truncates text with an ellipsis so it fits within maxWidth. */
export function fitText(text: string, fontSize: number, maxWidth: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  let out = '';
  for (const ch of text) {
    if (estimateTextWidth(`${out + ch}…`, fontSize) > maxWidth) break;
    out += ch;
  }
  return `${out}…`;
}

/**
 * Wraps text into at most `maxLines` lines that each fit within `maxWidth`.
 * Line breaks in the text are kept; blank lines are dropped to save the limited lines.
 */
export function wrapText(text: string, fontSize: number, maxWidth: number, maxLines = 3): string[] {
  const clean = text
    .trim()
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[^\S\n]+/g, ' ');
  if (!clean) return [];

  const tokens: string[] = [];
  let word = '';
  for (const ch of clean) {
    if (ch === ' ' || ch === '\n' || isWide(ch)) {
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
    if (tok === '\n' || (current && estimateTextWidth(candidate, fontSize) > maxWidth)) {
      if (lines.length + 1 >= maxLines) {
        const rest = (current + tokens.slice(i).join('')).trim().replace(/\n/g, ' ');
        lines.push(fitText(rest, fontSize, maxWidth));
        return lines;
      }
      lines.push(fitText(current.trimEnd(), fontSize, maxWidth));
      current = tok === ' ' || tok === '\n' ? '' : tok;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) {
    lines.push(fitText(current.trim(), fontSize, maxWidth));
  }
  return lines;
}
