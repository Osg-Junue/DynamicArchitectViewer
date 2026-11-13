/** Edge label metrics, shared by the layout (column spacing) and the renderer. */
export const EDGE_LABEL_FONT_SIZE = 11;
export const EDGE_LABEL_MAX_WIDTH = 180;

/**
 * Approximate text width without a DOM (deterministic across environments).
 * Full-width characters (CJK, kana, full-width forms) count as one em, others as ~0.58 em.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += isWide(ch) ? 1 : 0.58;
  return em * fontSize;
}

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
