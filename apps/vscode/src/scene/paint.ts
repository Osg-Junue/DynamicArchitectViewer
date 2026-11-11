import { isColorName } from '../model/types';

export const THEME_COLOR = {
  fg: 'var(--dav-fg)',
  bg: 'var(--dav-bg)',
  muted: 'var(--dav-muted)',
  panel: 'var(--dav-panel)',
  border: 'var(--dav-border)',
  borderStrong: 'var(--dav-border-strong)',
  accent: 'var(--dav-accent)',
  accentText: 'var(--dav-accent-text)',
  nodeBg: 'var(--dav-node-bg)',
  edge: 'var(--dav-edge)',
} as const;

/** Color names resolve to a per-theme token; default colors are tokens already. */
export function paint(color: string): string {
  return isColorName(color) ? `var(--dav-c-${color})` : color;
}
