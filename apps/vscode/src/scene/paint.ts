import { COLOR_NAMES } from '../model/types';

/** Color names resolve to a per-theme token; default colors are tokens already. */
export function paint(color: string): string {
  return (COLOR_NAMES as readonly string[]).includes(color) ? `var(--dav-c-${color})` : color;
}
