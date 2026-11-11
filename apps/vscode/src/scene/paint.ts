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
  codeBg: 'var(--dav-code-bg)',
  codeHeadBg: 'var(--dav-code-head-bg)',
  codeKey: 'var(--dav-code-key)',
  codeStr: 'var(--dav-code-str)',
  codeNum: 'var(--dav-code-num)',
  codeKw: 'var(--dav-code-kw)',
  codePunc: 'var(--dav-code-punc)',
} as const;

/** Color names resolve to a per-theme token; default colors are tokens already. */
export function paint(color: string): string {
  return isColorName(color) ? `var(--dav-c-${color})` : color;
}

/** The emphasized color of a label on a rail whose flow has the given color. */
export function activeLabelFill(flowColor: string): string {
  return flowColor === THEME_COLOR.accent ? THEME_COLOR.accentText : paint(flowColor);
}
