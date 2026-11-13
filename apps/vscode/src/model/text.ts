/** Edge label metrics, shared by the layout (column spacing) and the renderer. */
export const EDGE_LABEL_FONT_SIZE = 11;
export const EDGE_LABEL_MAX_WIDTH = 180;

/** How a text is set: at its regular weight, bold, or in the monospaced font of code. */
export type TextStyle = 'normal' | 'bold' | 'mono';

/**
 * How wide each kind of character is taken to be, in ems. No font can be measured here, and
 * the text is drawn in whatever the reader's system has, so the figures for Latin text leave
 * room: against Segoe UI, a line comes out about 15 to 30% wider than it is drawn, and against
 * Cascadia Code 3%. Capitals count for more than the rest, since a text all in capitals, such
 * as a badge, is a fifth wider than the same letters in lower case.
 */
const EM: Record<TextStyle, { broad: number; capital: number; other: number }> = {
  normal: { broad: 0.88, capital: 0.68, other: 0.6 },
  bold: { broad: 0.92, capital: 0.72, other: 0.65 },
  mono: { broad: 0.605, capital: 0.605, other: 0.605 },
};
/**
 * A CJK character is one em wide in every font and at every weight, and kana, punctuation and
 * signs are no wider: this needs no room added.
 */
const FULL_WIDTH_EM = 1;
/** An emoji is wider than the em it is set in: 1.37 in Segoe UI Emoji. */
const EMOJI_EM = 1.4;
const FIRST_EMOJI = 0x1f300;

/** The widest letters and signs of a proportional font. */
const BROAD = new Set(['W', 'M', '@', '%']);

function emOf(ch: string, style: TextStyle): number {
  if (takesFullWidth(ch)) {
    return (ch.codePointAt(0) ?? 0) >= FIRST_EMOJI ? EMOJI_EM : FULL_WIDTH_EM;
  }
  const em = EM[style];
  if (BROAD.has(ch)) return em.broad;
  if ((ch >= 'A' && ch <= 'Z') || ch === '#' || ch === '&') return em.capital;
  return em.other;
}

/**
 * The width a text is given, without a DOM and the same in every environment. It is the one
 * estimate behind every text of a diagram: what is cut to fit a place, what a box is drawn
 * around, and the room the layout keeps for a label.
 */
export function textWidth(text: string, fontSize: number, style: TextStyle = 'normal'): number {
  let em = 0;
  for (const ch of text) em += emOf(ch, style);
  return em * fontSize;
}

/**
 * Drawn about one em wide: what `isWide` covers, and the punctuation, arrows and signs that
 * the fonts of a CJK system draw at full width too (`—`, `…`, `→`, `●`, `①`, `¥`, `·`).
 */
function takesFullWidth(ch: string): boolean {
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

/** A CJK character, kana or full-width form: a line may break before or after it. */
export function isWide(ch: string): boolean {
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

/**
 * Normalizes line endings (`\r\n?` -> `\n`) and tabs (`\t` -> two spaces), trims trailing
 * spaces per line, and strips the minimum common leading indentation across non-empty lines.
 *
 * By default, single-line input is trimmed and multi-line input drops at most one leading and
 * one trailing blank line (matching raw triple-backtick code fences). With
 * `stripAllOuterBlankLines: true`, all leading and trailing blank lines are removed.
 */
export function normalizeCodeIndent(
  text: string,
  options?: { stripAllOuterBlankLines?: boolean },
): string {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\t/g, '  ');

  if (!options?.stripAllOuterBlankLines && !normalized.includes('\n')) {
    return normalized.trim();
  }

  const lines = normalized.split('\n');
  if (options?.stripAllOuterBlankLines) {
    while (lines.length > 0 && lines[0]?.trim() === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
      lines.pop();
    }
    if (lines.length === 0) return '';
  } else {
    if (lines.length > 0 && lines[0]?.trim() === '') {
      lines.shift();
    }
    if (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
      lines.pop();
    }
  }

  const trimmed = lines.map((line) => line.trimEnd());
  let minIndent = Number.POSITIVE_INFINITY;
  for (const line of trimmed) {
    if (line.length === 0) continue;
    const spaces = /^ */.exec(line)?.[0].length ?? 0;
    if (spaces < minIndent) minIndent = spaces;
  }

  if (!Number.isFinite(minIndent) || minIndent === 0) {
    return trimmed.join('\n');
  }
  return trimmed.map((line) => (line.length > 0 ? line.slice(minIndent) : '')).join('\n');
}

/** Returns the 1-based line number at `offset` (clamped to `[0, text.length]`). */
export function lineAtOffset(text: string, offset: number): number {
  const clamped = Number.isNaN(offset) ? 0 : Math.max(0, Math.min(text.length, Math.trunc(offset)));
  let line = 1;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Appends `value` to `map`'s array bucket for `key` in O(1) amortized time. */
export function pushToMap<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
  } else {
    map.set(key, [value]);
  }
}

/**
 * Makes JSON safe inside a <script> element: `<`, `>` and `&` can never form
 * `</script>` or `<!--`, and line/paragraph separators are escaped. Still valid JSON.
 */
export function escapeJsonForHtml(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
