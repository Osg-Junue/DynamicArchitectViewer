/** Edge label metrics, shared by the layout (column spacing) and the renderer. */
export const EDGE_LABEL_FONT_SIZE = 11.5;
export const EDGE_LABEL_MAX_WIDTH = 188;

/** How a text is set: at its regular weight, bold, or in the monospaced font of code. */
export type TextStyle = 'normal' | 'bold' | 'mono';

/**
 * How wide a character is taken to be. No font can be measured here, and the text is drawn in
 * whatever the reader's system has, so every width is a figure that holds for the fonts a
 * diagram is likely to be drawn in, and a little more:
 *
 * - A printable ASCII character has the width it has in Segoe UI, at its weight, plus 12%.
 *   That covers San Francisco, Roboto, Ubuntu and Noto Sans; in a font wider than those, such
 *   as DejaVu Sans, a full line runs a few units into the padding beside it.
 * - Monospaced text takes the widest of the usual code fonts, 0.605 em a character.
 * - A CJK character is one em wide in every font and at every weight, and kana, punctuation
 *   and signs are no wider.
 * - An emoji is wider than its em: 1.37 in Segoe UI Emoji.
 * - Any other letter, such as an accented one, counts as a broad small letter.
 */
/** Hundredths of an em for the characters from space to `~`, room included. */
const ASCII_EM: Record<Exclude<TextStyle, 'mono'>, readonly number[]> = {
  // biome-ignore format: a table
  normal: [
    31, 32, 44, 67, 61, 92, 90, 26, 34, 34, 47, 77, 25, 45, 25, 44, 61, 61, 61,
    61, 61, 61, 61, 61, 61, 61, 25, 25, 77, 77, 77, 51, 107, 73, 65, 70, 79, 57,
    55, 77, 80, 30, 40, 65, 53, 101, 84, 85, 63, 85, 67, 60, 59, 77, 70, 105, 67,
    62, 64, 34, 43, 34, 77, 47, 31, 58, 66, 52, 66, 59, 36, 66, 64, 28, 28, 56,
    28, 97, 64, 66, 66, 66, 39, 48, 38, 64, 54, 81, 52, 55, 51, 34, 27, 34, 77,
  ],
  // biome-ignore format: a table
  bold: [
    31, 37, 56, 67, 65, 98, 96, 33, 42, 42, 51, 80, 31, 46, 31, 50, 65, 65, 65,
    65, 65, 65, 65, 65, 65, 65, 31, 31, 80, 80, 80, 50, 107, 79, 72, 70, 83, 60,
    59, 80, 86, 36, 50, 73, 58, 108, 89, 85, 69, 85, 74, 63, 66, 81, 75, 113, 74,
    68, 68, 42, 49, 42, 80, 47, 36, 61, 70, 54, 70, 61, 43, 70, 68, 32, 32, 63,
    32, 103, 68, 69, 70, 70, 45, 50, 44, 68, 61, 90, 62, 61, 54, 42, 37, 42, 80,
  ],
};
const FIRST_ASCII = 0x20;
const LAST_ASCII = 0x7e;
const MONO_EM = 0.605;
const OTHER_EM: Record<TextStyle, number> = { normal: 0.6, bold: 0.65, mono: MONO_EM };
const FULL_WIDTH_EM = 1;
const EMOJI_EM = 1.4;
const FIRST_EMOJI = 0x1f300;

function emOf(ch: string, style: TextStyle): number {
  const code = ch.codePointAt(0) ?? 0;
  if (style !== 'mono' && code >= FIRST_ASCII && code <= LAST_ASCII) {
    return (ASCII_EM[style][code - FIRST_ASCII] as number) / 100;
  }
  if (takesFullWidth(ch)) return code >= FIRST_EMOJI ? EMOJI_EM : FULL_WIDTH_EM;
  return OTHER_EM[style];
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
