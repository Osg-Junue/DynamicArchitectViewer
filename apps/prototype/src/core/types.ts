export type NodeIconType =
  | 'server'
  | 'container'
  | 'function'
  | 'database'
  | 'cache'
  | 'queue'
  | 'storage'
  | 'lb'
  | 'firewall'
  | 'cdn'
  | 'cloud'
  | 'router'
  | 'external'
  | 'screen'
  | 'modal'
  | 'browser'
  | 'mobile'
  | 'user';

export type NodeStatus = 'normal' | 'active' | 'muted' | 'warning' | 'error';

export type EdgeStyle = 'solid' | 'dashed';
export type EdgeDirection = 'forward' | 'bidirectional';

export interface DiagramGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasExplicitPos: boolean;
  hasExplicitSize: boolean;
  color?: string;
  line?: number;
}

export interface DiagramNode {
  id: string;
  label: string;
  sub?: string;
  icon: NodeIconType;
  groupId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasExplicitPos: boolean;
  status: NodeStatus;
  badge?: string;
  visible: boolean;
  color?: string;
  line?: number;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: EdgeStyle;
  direction: EdgeDirection;
  color?: string;
  visible: boolean;
  line?: number;
}

export interface StepAnimation {
  from: string;
  to: string;
  edgeId?: string;
  label?: string;
  color?: string;
  style?: EdgeStyle;
  parallel?: boolean;
}

export interface ElementStateOverride {
  targetId: string;
  status?: NodeStatus;
  badge?: string;
  visible?: boolean;
  color?: string;
  label?: string;
  sub?: string;
}

export interface DiagramStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  focusIds: string[];
  states: ElementStateOverride[];
  animations: StepAnimation[];
  line?: number;
}

export interface DiagramParseDiagnostic {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface DiagramModel {
  title: string;
  groups: DiagramGroup[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  steps: DiagramStep[];
  diagnostics: DiagramParseDiagnostic[];
}

export const NODE_DEFAULT_WIDTH = 164;
export const NODE_DEFAULT_HEIGHT = 76;
export const SCREEN_NODE_WIDTH = 188;
export const SCREEN_NODE_HEIGHT = 108;

export function getDefaultNodeSize(icon: NodeIconType): { width: number; height: number } {
  if (icon === 'screen' || icon === 'modal') {
    return { width: SCREEN_NODE_WIDTH, height: SCREEN_NODE_HEIGHT };
  }
  return { width: NODE_DEFAULT_WIDTH, height: NODE_DEFAULT_HEIGHT };
}
