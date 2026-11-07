/** Attribute schema shared by the analyzer (validation) and the edit API (value formatting). */

export type AttrType = 'string' | 'bool' | 'color' | 'icon' | 'status' | 'ident';
export type AttrOwner = 'node' | 'group' | 'edge' | 'state' | 'animate';

export const ATTRIBUTE_SCHEMA: Record<AttrOwner, Readonly<Record<string, AttrType>>> = {
  node: {
    icon: 'icon',
    sub: 'string',
    status: 'status',
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
    status: 'status',
    badge: 'string',
    visible: 'bool',
    color: 'color',
    label: 'string',
    sub: 'string',
  },
  animate: {
    color: 'color',
    parallel: 'bool',
  },
};

/** Which `state` attributes are meaningful for each target kind. */
export const STATE_ATTRIBUTES_BY_TARGET: Record<'node' | 'group' | 'edge', ReadonlySet<string>> = {
  node: new Set(['status', 'badge', 'visible', 'color', 'label', 'sub']),
  group: new Set(['color', 'label']),
  edge: new Set(['visible', 'color', 'label']),
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

export function isValidColor(raw: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw);
}
