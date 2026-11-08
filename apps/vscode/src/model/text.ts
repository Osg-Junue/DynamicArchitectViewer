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
