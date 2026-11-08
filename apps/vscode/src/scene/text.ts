/**
 * Approximate text width without a DOM (deterministic across environments).
 * Full-width characters (CJK, kana, full-width forms) count as one em, others as ~0.58 em.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += isWide(ch) ? 1 : 0.58;
  return em * fontSize;
}

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

/** Wraps text into at most `maxLines` lines that each fit within `maxWidth`. */
export function wrapText(text: string, fontSize: number, maxWidth: number, maxLines = 3): string[] {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return [];

  const tokens: string[] = [];
  let word = '';
  for (const ch of clean) {
    if (ch === ' ' || isWide(ch)) {
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
    if (current && estimateTextWidth(candidate, fontSize) > maxWidth) {
      if (lines.length + 1 >= maxLines) {
        const rest = (current + tokens.slice(i).join('')).trim();
        lines.push(fitText(rest, fontSize, maxWidth));
        return lines;
      }
      lines.push(fitText(current.trimEnd(), fontSize, maxWidth));
      current = tok === ' ' ? '' : tok;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) {
    lines.push(fitText(current.trim(), fontSize, maxWidth));
  }
  return lines;
}

function isWide(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    code >= 0x1f300
  );
}
