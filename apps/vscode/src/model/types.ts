/**
 * Semantic model of a DSL v1 document.
 * Pure data: no DOM, no source positions (those live in the parser's SourceMap).
 */

export const ICON_NAMES = [
  'server',
  'container',
  'function',
  'database',
  'cache',
  'queue',
  'storage',
  'lb',
  'firewall',
  'cdn',
  'cloud',
  'router',
  'external',
  'screen',
  'modal',
  'browser',
  'mobile',
  'user',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

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

/** In a `state`, removes the color set by earlier steps and restores the declared one. */
export const COLOR_RESET = 'none';

export type LineStyle = 'solid' | 'dashed';
export type Direction = 'forward' | 'bidirectional';

export interface Point {
  x: number;
  y: number;
}

export interface DavGroup {
  id: string;
  label: string;
  color?: string;
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
  color?: string;
  /** Enclosing group ID. */
  parentId?: string;
}

export interface DavEdge {
  /** Explicit `[id: ...]` or the implicit `from->to`. */
  id: string;
  explicitId: boolean;
  from: string;
  to: string;
  style: LineStyle;
  direction: Direction;
  label?: string;
  color?: string;
  visible: boolean;
}

export interface StateOverride {
  target: string;
  badge?: string;
  visible?: boolean;
  color?: string;
}

export interface Animation {
  from: string;
  to: string;
  direction: Direction;
  label?: string;
  description?: string;
  color?: string;
  parallel: boolean;
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
}

export interface DavDocument {
  version: number;
  title: string;
  /** Document order; parents always precede their children. */
  groups: DavGroup[];
  nodes: DavNode[];
  edges: DavEdge[];
  steps: DavStep[];
}

export const CURRENT_DSL_VERSION = 1;

export function implicitEdgeId(from: string, to: string): string {
  return `${from}->${to}`;
}
