import type { ColorName } from '../model/types';

/** Attribute schema shared by the analyzer (validation) and the edit API (value formatting). */

export type AttrType = 'string' | 'bool' | 'color' | 'stateColor' | 'icon' | 'ident';
export type AttrOwner = 'node' | 'group' | 'edge' | 'state' | 'animate';

export const ATTRIBUTE_SCHEMA: Record<AttrOwner, Readonly<Record<string, AttrType>>> = {
  node: {
    icon: 'icon',
    sub: 'string',
    badge: 'string',
    visible: 'bool',
    color: 'color',
  },
  group: {
    color: 'color',
  },
  edge: {
    id: 'ident',
    visible: 'bool',
    color: 'color',
  },
  state: {
    badge: 'string',
    visible: 'bool',
    color: 'stateColor',
  },
  animate: {
    color: 'color',
    parallel: 'bool',
    desc: 'string',
  },
};

/** Which `state` attributes are meaningful for each target kind. */
export const STATE_ATTRIBUTES_BY_TARGET: Record<'node' | 'group' | 'edge', ReadonlySet<string>> = {
  node: new Set(['badge', 'visible', 'color']),
  group: new Set(['color']),
  edge: new Set(['visible', 'color']),
};

export const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const KEYWORDS: ReadonlySet<string> = new Set([
  'dav',
  'title',
  'group',
  'node',
  'step',
  'desc',
  'focus',
  'state',
  'animate',
  'true',
  'false',
]);

export function isValidIdentifier(id: string): boolean {
  return IDENTIFIER_PATTERN.test(id) && !KEYWORDS.has(id);
}

const COLOR_HUES: ReadonlyArray<readonly [ColorName, number]> = [
  ['red', 0],
  ['orange', 25],
  ['yellow', 48],
  ['green', 150],
  ['teal', 175],
  ['blue', 215],
  ['purple', 275],
  ['pink', 330],
];

/** The color name closest to a `#rgb` / `#rrggbb` value, for migrating to color names. */
export function closestColorName(hex: string): ColorName | undefined {
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return undefined;
  const digits = hex.length === 4 ? hex.slice(1).replace(/./g, '$&$&') : hex.slice(1);
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map(
    (i) => Number.parseInt(digits.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma < 0.12) return 'gray';
  const sector =
    max === r
      ? ((g - b) / chroma + 6) % 6
      : max === g
        ? (b - r) / chroma + 2
        : (r - g) / chroma + 4;
  const hue = sector * 60;
  const distance = (a: number) => Math.min(Math.abs(hue - a), 360 - Math.abs(hue - a));
  return COLOR_HUES.reduce((best, c) => (distance(c[1]) < distance(best[1]) ? c : best))[0];
}
