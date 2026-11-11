import type { Layout, Rect } from '../layout';
import { estimateTextWidth } from '../model/text';
import {
  COLOR_RESET,
  type CodeBlock,
  type ColorName,
  type DavDocument,
  type DavEdge,
  type DavStep,
  type Direction,
  type IconName,
  type LineStyle,
} from '../model/types';
import { ancestorIds, parentMap, zoneOfNodes } from '../model/zones';
import { separatePhaseCallouts } from './callout';
import { type Bezier, reverse } from './geometry';
import { THEME_COLOR } from './paint';
import { RailRouter } from './rails';
import { PHASE_MS, pacePhase } from './timing';
import { ZONE_LABEL, zoneLabelRoom } from './zones';

export const DEFAULT_FLOW_COLOR = THEME_COLOR.accent;
const DEFAULT_EDGE_COLOR = THEME_COLOR.edge;

export interface ResolvedNode {
  id: string;
  label: string;
  sub?: string;
  icon: IconName;
  badge?: string;
  /** Author-specified color; absent when the station follows the theme. */
  accent?: ColorName;
  rect: Rect;
  visible: boolean;
  focused: boolean;
  dimmed: boolean;
}

export interface ResolvedGroup {
  id: string;
  label: string;
  color?: ColorName;
  rect: Rect;
  depth: number;
  dimmed: boolean;
}

export interface ResolvedEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** The lower of two parallel tracks: its label goes under the rail. */
  labelBelow: boolean;
  style: LineStyle;
  direction: Direction;
  color: string;
  /** Color of the flow overlay; present when `active`. */
  flowColor?: string;
  path: Bezier;
  /** Packets flow along this edge in the current step. */
  active: boolean;
  dimmed: boolean;
}

export interface Packet {
  from: string;
  to: string;
  /** The edge this packet rides, when the diagram has one between its endpoints. */
  edgeId?: string;
  fromLabel: string;
  toLabel: string;
  label?: string;
  description?: string;
  code?: CodeBlock;
  color: string;
  /** What the packet carries; a plain dot when absent. */
  icon?: IconName;
  /** Sideways move of the callout, set when it would cover another one of its phase. */
  calloutShift?: number;
  path: Bezier;
  /** Written as `<->` in the `animate`: the packet goes to the end and comes back. */
  roundTrip: boolean;
  /** Top edge of the two endpoint nodes; the callout stays above it to keep them visible. */
  clearTop: number;
  /** Zone names on the canvas, which the callout must not cover. */
  labelAreas: readonly Rect[];
  /** How long this packet travels at 1x. */
  durationMs: number;
  /** The top-level group each endpoint belongs to, if any. */
  fromZone?: string;
  toZone?: string;
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
  /** Duration of each phase at 1x. */
  phaseDurations: number[];
}

/** Where a zone's name is drawn (see groupLabelElement). */
function zoneLabelArea(group: ResolvedGroup): Rect {
  const { x, y, width } = group.rect;
  return {
    x: x + ZONE_LABEL.inset,
    y: y + 6,
    width: Math.min(estimateTextWidth(group.label, ZONE_LABEL.size), zoneLabelRoom(width)),
    height: ZONE_LABEL.height,
  };
}

/** The flow color of each edge the packets ride; the first packet on an edge decides. */
export function flowColors(packets: readonly Packet[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const { edgeId, color } of packets) {
    if (edgeId !== undefined && !colors.has(edgeId)) colors.set(edgeId, color);
  }
  return colors;
}

type Override = Partial<{
  badge: string;
  visible: boolean;
  color: ColorName;
}>;

/** What every stage of resolving a step needs to know. */
interface StepContext {
  doc: DavDocument;
  layout: Layout;
  step: DavStep | undefined;
  overrides: ReadonlyMap<string, Override>;
  focus: ReadonlySet<string>;
  /** Something is focused, so everything else is dimmed. */
  filtering: boolean;
  groupParent: ReadonlyMap<string, string | undefined>;
  nodeParent: ReadonlyMap<string, string | undefined>;
}

/** `state` applies to its step and all later ones. */
function accumulateOverrides(doc: DavDocument, index: number | null): Map<string, Override> {
  const overrides = new Map<string, Override>();
  if (index === null) return overrides;
  for (const s of doc.steps.slice(0, index + 1)) {
    for (const st of s.states) {
      const { target, color, ...rest } = st;
      const next: Override = { ...overrides.get(target), ...rest };
      if (color === COLOR_RESET) delete next.color;
      else if (color !== undefined) next.color = color;
      overrides.set(target, next);
    }
  }
  return overrides;
}

function focusOf(doc: DavDocument, step: DavStep | undefined): Set<string> {
  const focus = new Set<string>();
  if (!step) return focus;
  for (const id of step.focus) focus.add(id);
  for (const st of step.states) {
    // Hiding something leaves nothing to look at, so it does not draw attention.
    if (st.visible === false) continue;
    focus.add(st.target);
    const edge = doc.edges.find((e) => e.id === st.target);
    if (edge) {
      focus.add(edge.from);
      focus.add(edge.to);
    }
  }
  for (const a of step.animations) {
    focus.add(a.from);
    focus.add(a.to);
  }
  return focus;
}

/** A focused group keeps its whole subtree undimmed. */
function inFocusedGroup(ctx: StepContext, parentId: string | undefined): boolean {
  return ancestorIds(ctx.groupParent, parentId).some((g) => ctx.focus.has(g));
}

function resolveNodes(ctx: StepContext): ResolvedNode[] {
  const { doc, layout, step, overrides, focus, filtering } = ctx;
  const animatedEndpoints = new Set(step?.animations.flatMap((a) => [a.from, a.to]) ?? []);
  return doc.nodes.flatMap((n) => {
    const rect = layout.nodes[n.id];
    if (!rect) return [];
    const ov = overrides.get(n.id) ?? {};
    const focused = focus.has(n.id) || inFocusedGroup(ctx, n.parentId);
    const node: ResolvedNode = {
      id: n.id,
      label: n.label,
      icon: n.icon,
      rect,
      visible: animatedEndpoints.has(n.id) || (ov.visible ?? n.visible),
      focused: step !== undefined && focused,
      dimmed: filtering && !focused,
    };
    const accent = ov.color ?? n.color;
    if (accent) node.accent = accent;
    if (n.sub) node.sub = n.sub;
    const badge = ov.badge ?? n.badge;
    if (badge) node.badge = badge;
    return [node];
  });
}

/** Groups are dimmed when nothing inside them is focused. */
function resolveGroups(ctx: StepContext, nodes: readonly ResolvedNode[]): ResolvedGroup[] {
  const { doc, layout, overrides, focus, filtering, groupParent, nodeParent } = ctx;
  const focusedGroups = new Set<string>();
  for (const n of nodes) {
    if (!n.focused) continue;
    for (const g of ancestorIds(groupParent, nodeParent.get(n.id))) focusedGroups.add(g);
  }
  for (const id of focus) {
    if (!groupParent.has(id)) continue;
    for (const g of ancestorIds(groupParent, id)) focusedGroups.add(g);
  }
  return doc.groups.flatMap((g) => {
    const rect = layout.groups[g.id];
    if (!rect) return [];
    const ov = overrides.get(g.id) ?? {};
    const group: ResolvedGroup = {
      id: g.id,
      label: g.label,
      rect,
      depth: ancestorIds(groupParent, g.parentId).length,
      dimmed: filtering && !focusedGroups.has(g.id) && !inFocusedGroup(ctx, g.parentId),
    };
    const color = ov.color ?? g.color;
    if (color) group.color = color;
    return [group];
  });
}

/** Between parallel edges, a packet prefers one that is on screen. */
function edgeForPacket(ctx: StepContext, from: string, to: string): DavEdge | undefined {
  const candidates = ctx.doc.edges.filter(
    (e) =>
      (e.from === from && e.to === to) ||
      (e.direction === 'bidirectional' && e.from === to && e.to === from),
  );
  return candidates.find((e) => ctx.overrides.get(e.id)?.visible ?? e.visible) ?? candidates[0];
}

interface ResolvedPhases {
  phases: Packet[][];
  phaseDurations: number[];
  /** The flow color of each edge some packet rides in this step. */
  activeEdges: Map<string, string>;
}

function resolvePhases(
  ctx: StepContext,
  nodeById: ReadonlyMap<string, ResolvedNode>,
  rails: RailRouter,
  labelAreas: readonly Rect[],
): ResolvedPhases {
  const zoneOf = zoneOfNodes(ctx.doc);
  const phases: Packet[][] = [];
  for (const a of ctx.step?.animations ?? []) {
    const fromNode = nodeById.get(a.from);
    const toNode = nodeById.get(a.to);
    if (!fromNode || !toNode) continue;
    const edge = edgeForPacket(ctx, a.from, a.to);
    const color = a.color ?? DEFAULT_FLOW_COLOR;
    let path = rails.between(fromNode, toNode);
    if (edge) {
      const edgeFrom = nodeById.get(edge.from);
      const edgeTo = nodeById.get(edge.to);
      if (edgeFrom && edgeTo) {
        const edgePath = rails.ofEdge(edge, edgeFrom, edgeTo);
        path = edge.from === a.from ? edgePath : reverse(edgePath);
      }
    }
    const packet: Packet = {
      from: a.from,
      to: a.to,
      fromLabel: fromNode.label,
      toLabel: toNode.label,
      color,
      path,
      roundTrip: a.direction === 'bidirectional',
      clearTop: Math.min(fromNode.rect.y, toNode.rect.y),
      labelAreas,
      durationMs: PHASE_MS,
    };
    const fromZone = zoneOf.get(a.from);
    const toZone = zoneOf.get(a.to);
    if (fromZone !== undefined) packet.fromZone = fromZone;
    if (toZone !== undefined) packet.toZone = toZone;
    if (edge) packet.edgeId = edge.id;
    if (a.label !== undefined) packet.label = a.label;
    if (a.description !== undefined) packet.description = a.description;
    if (a.code !== undefined && a.code.body.trim().length > 0) packet.code = a.code;
    if (a.icon !== undefined) packet.icon = a.icon;
    const current = phases[phases.length - 1];
    if (a.parallel && current) current.push(packet);
    else phases.push([packet]);
  }
  for (const phase of phases) separatePhaseCallouts(phase);
  return { phases, phaseDurations: phases.map(pacePhase), activeEdges: flowColors(phases.flat()) };
}

function resolveEdges(
  ctx: StepContext,
  nodeById: ReadonlyMap<string, ResolvedNode>,
  rails: RailRouter,
  activeEdges: ReadonlyMap<string, string>,
): ResolvedEdge[] {
  return ctx.doc.edges.flatMap((e) => {
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    if (!from || !to) return [];
    const ov = ctx.overrides.get(e.id) ?? {};
    const activeColor = activeEdges.get(e.id);
    const visible = activeColor !== undefined || (ov.visible ?? e.visible);
    if (!visible || !from.visible || !to.visible) return [];
    const focused =
      activeColor !== undefined || ctx.focus.has(e.id) || (from.focused && to.focused);
    const edge: ResolvedEdge = {
      id: e.id,
      from: e.from,
      to: e.to,
      labelBelow: rails.hasReverseTrack(e.from, e.to) && to.rect.x < from.rect.x,
      style: e.style,
      direction: e.direction,
      color: ov.color ?? e.color ?? DEFAULT_EDGE_COLOR,
      path: rails.ofEdge(e, from, to),
      active: activeColor !== undefined,
      dimmed: ctx.filtering && !focused,
    };
    if (activeColor !== undefined) edge.flowColor = activeColor;
    if (e.label) edge.label = e.label;
    return [edge];
  });
}

/**
 * Resolves what the diagram looks like at a step (spec §4.5).
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
  const index = step !== undefined && stepIndex !== null ? stepIndex : null;
  const focus = focusOf(doc, step);
  const ctx: StepContext = {
    doc,
    layout,
    step,
    overrides: accumulateOverrides(doc, index),
    focus,
    filtering: step !== undefined && focus.size > 0,
    groupParent: parentMap(doc.groups),
    nodeParent: parentMap(doc.nodes),
  };

  const nodes = resolveNodes(ctx);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const groups = resolveGroups(ctx, nodes);
  const rails = new RailRouter(doc, nodes);
  const { phases, phaseDurations, activeEdges } = resolvePhases(
    ctx,
    nodeById,
    rails,
    groups.map(zoneLabelArea),
  );

  const view: ResolvedView = {
    title: doc.title,
    stepIndex: index,
    groups,
    nodes: nodes.filter((n) => n.visible),
    edges: resolveEdges(ctx, nodeById, rails, activeEdges),
    phases,
    phaseDurations,
  };
  if (step) {
    view.stepTitle = step.title;
    view.description = step.description;
  }
  return view;
}
