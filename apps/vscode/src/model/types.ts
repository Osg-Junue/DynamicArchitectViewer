/**
 * Semantic model of a DSL v2 document.
 * Pure data: no DOM, no source positions (those live in the parser's SourceMap).
 */

export const ICON_NAMES = [
  'server',
  'container',
  'function',
  'runtime',
  'database',
  'cache',
  'queue',
  'storage',
  'lb',
  'firewall',
  'cdn',
  'cloud',
  'building',
  'router',
  'hub',
  'wifi',
  'external',
  'auth',
  'ai',
  'api',
  'mail',
  'monitor',
  'schedule',
  'search',
  'logic',
  'webhook',
  'payment',
  'key',
  'dns',
  'shield',
  'stream',
  'event',
  'nat',
  'registry',
  'warehouse',
  'vault',
  'audit',
  'screen',
  'modal',
  'browser',
  'desktop',
  'mobile',
  'terminal',
  'device',
  'printer',
  'chat',
  'sheet',
  'file',
  'user',
  'users',
  'bot',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

export function isIconName(v: string): v is IconName {
  return (ICON_NAMES as readonly string[]).includes(v);
}

/** The DSL's color names. Each renders as a color tuned for the active theme. */
export const COLOR_NAMES = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'gray',
] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

export function isColorName(v: string): v is ColorName {
  return (COLOR_NAMES as readonly string[]).includes(v);
}

/** In a `state`, removes a color for that step, clearing any declared color as well. */
export const COLOR_RESET = 'none';

/** Reserved words of the DSL, which cannot be used as element identifiers. */
export const KEYWORD_NAMES = [
  'title',
  'group',
  'node',
  'step',
  'desc',
  'focus',
  'state',
  'animate',
  'static',
  'true',
  'false',
] as const;

export const BORDER_STYLES = ['solid', 'dashed'] as const;
export type LineStyle = (typeof BORDER_STYLES)[number];
export function isLineStyle(v: string): v is LineStyle {
  return (BORDER_STYLES as readonly string[]).includes(v);
}

export const MOUNT_MODES = ['border'] as const;
export type NodeMount = (typeof MOUNT_MODES)[number];
export function isNodeMount(v: string): v is NodeMount {
  return (MOUNT_MODES as readonly string[]).includes(v);
}

export type Direction = 'forward' | 'bidirectional';
export type DavLocale = 'ja' | 'en';

export interface Point {
  x: number;
  y: number;
}

export interface DavGroup {
  id: string;
  label: string;
  color?: ColorName;
  /** Border stroke style (`solid` by default). */
  border?: LineStyle;
  /** Enclosing group ID (nested groups). */
  parentId?: string;
}

export interface DavNode {
  id: string;
  label: string;
  icon: IconName;
  sub?: string;
  badge?: string;
  visible: boolean;
  color?: ColorName;
  /** Mounts the node onto its parent group's boundary (`border`). */
  mount?: NodeMount;
  /** Enclosing group ID. */
  parentId?: string;
}

export interface StateOverride {
  target: string;
  badge?: string;
  visible?: boolean;
  color?: ColorName | typeof COLOR_RESET;
}

export interface CodeBlock {
  lang?: string;
  title?: string;
  body: string;
}

export interface Animation {
  from: string;
  to: string;
  style: LineStyle;
  direction: Direction;
  label?: string;
  description?: string;
  code?: CodeBlock;
  color?: ColorName;
  /** What the packet carries; a plain dot when absent. */
  icon?: IconName;
  parallel: boolean;
}

export interface StaticLink {
  from: string;
  to: string;
  style: LineStyle;
  direction: Direction;
  label?: string;
  color?: ColorName;
}

export interface DavStep {
  /** Zero-based position in the document. */
  index: number;
  title: string;
  /** `desc` statements joined with newlines. */
  description: string;
  focus: string[];
  states: StateOverride[];
  animations: Animation[];
  statics: StaticLink[];
}

export interface DavDocument {
  title: string;
  /** Document order; parents always precede their children. */
  groups: DavGroup[];
  nodes: DavNode[];
  steps: DavStep[];
}

/** Synthesized connection across all steps (one entry per unordered pair or self-loop). */
export interface DavConnection {
  id: string;
  from: string;
  to: string;
  style: LineStyle;
  direction: Direction;
  /** True when at least one `animate` statement traverses this connection. */
  animated: boolean;
}

export function implicitEdgeId(from: string, to: string): string {
  return `${from}->${to}`;
}
