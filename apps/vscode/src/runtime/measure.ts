import type { TextMeasure, TextStyle } from '../scene';

/** Text is measured at this size and scaled, so that no rounding at a small size comes in. */
const REFERENCE_SIZE = 100;
/**
 * Kept on top of what is measured: text in an SVG that is zoomed is not drawn to the
 * hundredth of a unit it is measured at.
 */
const ROOM = 1.02;
const CACHE_LIMIT = 4000;

/**
 * Measures text as this browser draws it, in the fonts the player is styled with. `null` where
 * that cannot be done, such as without a canvas; the estimate then stays in use.
 */
export function browserTextMeasure(): TextMeasure | null {
  if (typeof document === 'undefined') return null;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  const root = getComputedStyle(document.documentElement);
  const sans = root.getPropertyValue('--dav-font').trim();
  const mono = root.getPropertyValue('--dav-mono').trim();
  if (!sans || !mono) return null;
  const fonts: Record<TextStyle, string> = {
    normal: `400 ${REFERENCE_SIZE}px ${sans}`,
    bold: `700 ${REFERENCE_SIZE}px ${sans}`,
    mono: `400 ${REFERENCE_SIZE}px ${mono}`,
  };
  // Wrapping asks for the same pieces of text again and again.
  const ems = new Map<string, number>();
  return (text, fontSize, style = 'normal') => {
    const key = `${style}\n${text}`;
    let em = ems.get(key);
    if (em === undefined) {
      context.font = fonts[style];
      em = context.measureText(text).width / REFERENCE_SIZE;
      if (ems.size >= CACHE_LIMIT) ems.clear();
      ems.set(key, em);
    }
    return em * fontSize * ROOM;
  };
}
