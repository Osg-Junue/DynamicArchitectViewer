import type { Layout, Rect } from '../layout';
import { ICON_META } from '../model/icons';
import type { DavDocument, Direction, IconName, LineStyle, NodeStatus } from '../model/types';
import { type Bezier, connect, reverse } from './geometry';

export const DEFAULT_FLOW_COLOR = '#3b82f6';
const DEFAULT_EDGE_COLOR = '#475569';

export interface ResolvedNode {
  id: string;
  label: string;
  sub?: string;
  icon: IconName;
  status: NodeStatus;
  badge?: string;
  /** Accent color (explicit or icon default). */
  accent: string;
  rect: Rect;
  visible: boolean;
  focused: boolean;
  dimmed: boolean;
}

export interface ResolvedGroup {
  id: string;
  label: string;
  color?: string;
  rect: Rect;
  depth: number;
  dimmed: boolean;
}

export interface ResolvedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style: LineStyle;
  direction: Direction;
  color: string;
  path: Bezier;
  /** Packets flow along this edge in the current step. */
  active: boolean;
  dimmed: boolean;
}

export interface Packet {
  from: string;
  to: string;
  label?: string;
  color: string;
  style: LineStyle;
  path: Bezier;
}

export interface ResolvedView {
  title: string;
  /** `null` = overview (base state, no focus). */
  stepIndex: number | null;
  stepTitle?: string;
  description?: string;
  groups: ResolvedGroup[];
  nodes: ResolvedNode[];
  edges: ResolvedEdge[];
  /** Sequential phases; packets within a phase play in parallel. */
  phases: Packet[][];
}

/**
 * Resolves what the diagram looks like at a step (spec §5.5).
 * `state` overrides accumulate over steps 1..k; `focus` and `animate` apply to step k only.
 * Pure and deterministic: jumping to any step gives the same result.
 */
export function resolveView(
  doc: DavDocument,
  layout: Layout,
  stepIndex: number | null,
): ResolvedView {
  const step =
    stepIndex !== null && stepIndex >= 0 && stepIndex < doc.steps.length
      ? doc.steps[stepIndex]
      : undefined;
  const index = step ? (stepIndex as number) : null;

  // 1. Accumulate state overrides.
  type Override = Partial<{
    status: NodeStatus;
    badge: string;
    visible: boolean;
    color: string;
  }>;
  const overrides = new Map<string, Override>();
  if (index !== null) {
    for (const s of doc.steps.slice(0, index + 1)) {
      for (const st of s.states) {
        const { target, ...rest } = st;
        overrides.set(target, { ...overrides.get(target), ...rest });
      }
    }
  }

  // 2. Focus set for this step.
  const focus = new Set<string>();
  if (step) {
    for (const id of step.focus) focus.add(id);
    for (const st of step.states) focus.add(st.target);
    for (const a of step.animations) {
      focus.add(a.from);
      focus.add(a.to);
    }
  }
  const groupParent = new Map(doc.groups.map((g) => [g.id, g.parentId]));
  const ancestorsOf = (parentId: string | undefined): string[] => {
    const out: string[] = [];
    for (let g = parentId; g !== undefined; g = groupParent.get(g)) out.push(g);
    return out;
  };
  // A focused group keeps its whole subtree undimmed.
  const inFocusedGroup = (parentId: string | undefined) =>
    ancestorsOf(parentId).some((g) => focus.has(g));
  const filtering = step !== undefined && focus.size > 0;

  // 3. Nodes.
  const animatedEndpoints = new Set(step?.animations.flatMap((a) => [a.from, a.to]) ?? []);
  const nodes: ResolvedNode[] = [];
  for (const n of doc.nodes) {
    const rect = layout.nodes[n.id];
    if (!rect) continue;
    const ov = overrides.get(n.id) ?? {};
    const focused = focus.has(n.id) || inFocusedGroup(n.parentId);
    const node: ResolvedNode = {
      id: n.id,
      label: n.label,
      icon: n.icon,
      status: ov.status ?? n.status,
      accent: ov.color ?? n.color ?? ICON_META[n.icon].accentColor,
      rect,
      visible: animatedEndpoints.has(n.id) || (ov.visible ?? n.visible),
      focused: step !== undefined && focused,
      dimmed: filtering && !focused,
    };
    if (n.sub) node.sub = n.sub;
    const badge = ov.badge ?? n.badge;
    if (badge) node.badge = badge;
    nodes.push(node);
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // 4. Groups (dimmed when nothing inside is focused).
  const nodeParent = new Map(doc.nodes.map((n) => [n.id, n.parentId]));
  const focusedGroups = new Set<string>();
  for (const n of nodes) {
    if (!n.focused) continue;
    for (const g of ancestorsOf(nodeParent.get(n.id))) focusedGroups.add(g);
  }
  for (const id of focus) {
    if (!groupParent.has(id)) continue;
    focusedGroups.add(id);
    for (const g of ancestorsOf(groupParent.get(id))) focusedGroups.add(g);
  }
  const groups: ResolvedGroup[] = doc.groups.flatMap((g) => {
    const rect = layout.groups[g.id];
    if (!rect) return [];
    const ov = overrides.get(g.id) ?? {};
    const group: ResolvedGroup = {
      id: g.id,
      label: g.label,
      rect,
      depth: ancestorsOf(g.parentId).length,
      dimmed: filtering && !focusedGroups.has(g.id),
    };
    const color = ov.color ?? g.color;
    if (color) group.color = color;
    return [group];
  });

  // 5. Animation phases.
  const edgeFor = (from: string, to: string) =>
    doc.edges.find(
      (e) =>
        (e.from === from && e.to === to) ||
        (e.direction === 'bidirectional' && e.from === to && e.to === from),
    );
  const phases: Packet[][] = [];
  const activeEdges = new Map<string, string>();
  for (const a of step?.animations ?? []) {
    const fromNode = nodeById.get(a.from);
    const toNode = nodeById.get(a.to);
    if (!fromNode || !toNode) continue;
    const edge = edgeFor(a.from, a.to);
    const color = a.color ?? DEFAULT_FLOW_COLOR;
    let path = connect(fromNode.rect, toNode.rect);
    if (edge) {
      const fromRect = nodeById.get(edge.from)?.rect;
      const toRect = nodeById.get(edge.to)?.rect;
      if (fromRect && toRect) {
        const edgePath = connect(fromRect, toRect);
        path = edge.from === a.from ? edgePath : reverse(edgePath);
      }
      if (!activeEdges.has(edge.id)) activeEdges.set(edge.id, color);
    }
    const packet: Packet = { from: a.from, to: a.to, color, style: a.style, path };
    if (a.label !== undefined) packet.label = a.label;
    const current = phases[phases.length - 1];
    if (a.parallel && current) current.push(packet);
    else phases.push([packet]);
  }

  // 6. Edges.
  const edges: ResolvedEdge[] = [];
  for (const e of doc.edges) {
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    if (!from || !to) continue;
    const ov = overrides.get(e.id) ?? {};
    const activeColor = activeEdges.get(e.id);
    const visible = activeColor !== undefined || (ov.visible ?? e.visible);
    if (!visible || !from.visible || !to.visible) continue;
    const focused = activeColor !== undefined || focus.has(e.id) || (from.focused && to.focused);
    const edge: ResolvedEdge = {
      id: e.id,
      from: e.from,
      to: e.to,
      style: e.style,
      direction: e.direction,
      color: activeColor ?? ov.color ?? e.color ?? DEFAULT_EDGE_COLOR,
      path: connect(from.rect, to.rect),
      active: activeColor !== undefined,
      dimmed: filtering && !focused,
    };
    if (e.label) edge.label = e.label;
    edges.push(edge);
  }

  const view: ResolvedView = {
    title: doc.title,
    stepIndex: index,
    groups,
    nodes: nodes.filter((n) => n.visible),
    edges,
    phases,
  };
  if (step) {
    view.stepTitle = step.title;
    view.description = step.description;
  }
  return view;
}
