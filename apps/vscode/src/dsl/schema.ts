/** Attribute schema: which attributes each statement accepts, and their value types. */

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
