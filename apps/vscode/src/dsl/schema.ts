import {
  type COLOR_RESET,
  type ColorName,
  type Direction,
  type IconName,
  KEYWORD_NAMES,
  type LineStyle,
  type NodeMount,
} from '../model/types';

/** Attribute schema: which attributes each statement accepts, and their value types. */

export type AttrType = 'string' | 'bool' | 'color' | 'stateColor' | 'icon' | 'border' | 'mount';
export type AttrOwner = 'node' | 'group' | 'state' | 'animate' | 'static';

export interface AttrValueByType {
  string: string;
  bool: boolean;
  color: ColorName;
  stateColor: ColorName | typeof COLOR_RESET;
  icon: IconName;
  border: LineStyle;
  mount: NodeMount;
}

const SCHEMA = {
  node: {
    icon: 'icon',
    sub: 'string',
    badge: 'string',
    visible: 'bool',
    color: 'color',
    mount: 'mount',
  },
  group: {
    icon: 'icon',
    color: 'color',
    border: 'border',
  },
  state: {
    badge: 'string',
    visible: 'bool',
    color: 'stateColor',
  },
  animate: {
    icon: 'icon',
    color: 'color',
    parallel: 'bool',
    desc: 'string',
    code: 'string',
  },
  static: {
    color: 'color',
  },
} as const satisfies Record<AttrOwner, Readonly<Record<string, AttrType>>>;

export type OwnerAttrs<O extends AttrOwner> = {
  readonly [K in keyof (typeof SCHEMA)[O]]: AttrValueByType[(typeof SCHEMA)[O][K] & AttrType];
};

export const ATTRIBUTE_SCHEMA: Record<AttrOwner, Readonly<Record<string, AttrType>>> = SCHEMA;

/** Which `state` attributes are meaningful for each target kind. */
export const STATE_ATTRIBUTES_BY_TARGET: Record<'node' | 'group', ReadonlySet<string>> = {
  node: new Set(['badge', 'visible', 'color']),
  group: new Set(['color']),
};

export const ARROW_TOKENS = ['-->', '..>', '<->', '<.>'] as const;
type ArrowToken = (typeof ARROW_TOKENS)[number];

const SPECS = {
  '-->': { style: 'solid', direction: 'forward' },
  '..>': { style: 'dashed', direction: 'forward' },
  '<->': { style: 'solid', direction: 'bidirectional' },
  '<.>': { style: 'dashed', direction: 'bidirectional' },
} as const satisfies Record<ArrowToken, { style: LineStyle; direction: Direction }>;

export const ARROW_SPECS: Readonly<Record<string, { style: LineStyle; direction: Direction }>> =
  SPECS;

export const KEYWORDS: ReadonlySet<string> = new Set(KEYWORD_NAMES);
