import type { Layout, Rect } from '../layout';
import {
  connectionColors,
  connectionIdMap,
  connectionLabels,
  stepConnections,
  synthesizedConnections,
  unorderedPairKey,
} from '../model/connections';
import { isBlank } from '../model/text';
import {
  COLOR_RESET,
  type CodeBlock,
  type ColorName,
  type DavDocument,
  type DavStep,
  type Direction,
  type IconName,
  type LineStyle,
} from '../model/types';
import { ancestorIds, parentMap, zoneOfNodes } from '../model/zones';
import { placePhaseCallouts } from './calloutPlace';
import { expandRect, type Point, type Rail } from './geometry';
import { THEME_COLOR } from './paint';
import {
  badgeArea,
  type EdgeLabelSpot,
  edgeLabelArea,
  nodeBody,
  RailRouter,
  stopPlacements,
  zoneNameArea,
} from './rails';
import { PHASE_MS, pacePhases } from './timing';

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
  border?: LineStyle;
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
  /** Color of the flow overlay; present when `active`. */
  flowColor?: string;
  path: Rail;
  /** Where the label is written; present for `static` links with labels in a step. */
  labelAt?: EdgeLabelSpot;
  /** Packets flow along this edge in the current step. */
  active: boolean;
}

export interface Packet {
  from: string;
  to: string;
  /** The synthesized connection ID this packet rides. */
  edgeId?: string;
  fromLabel: string;
  toLabel: string;
  label?: string;
  description?: string;
  code?: CodeBlock;
  color: string;
  /** What the packet carries; a plain dot when absent. */
  icon?: IconName;
  /** Top-left corner of the callout, where `placePhaseCallouts` found it a place. */
  calloutAt?: Point;
  /**
   * The number on this packet's stop and callout: its phase, with a letter when the phase runs
   * several packets (`5a`, `5b`). Absent in a step with a single phase, which draws no stops.
   */
  stopLabel?: string;
  path: Rail;
  /** Written as `<->` or `<.>` in the `animate`: the packet goes to the end and comes back. */
  roundTrip: boolean;
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

/** Kept around what is drawn of a node: its station, its badge and its labels. */
const CALLOUT_NODE_CLEARANCE = 4;
/** Kept around a zone's name. */
const CALLOUT_ZONE_NAME_CLEARANCE = 8;
/** Kept around the cell of a node a step is about. */
const CALLOUT_NODE_CELL_CLEARANCE = 6;

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
  color: ColorName | typeof COLOR_RESET;
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

/** In v2, `state` applies to its own step only (never accumulates from earlier steps). */
function stepOverrides(step: DavStep | undefined): Map<string, Override> {
  const overrides = new Map<string, Override>();
  if (!step) return overrides;
  for (const st of step.states) {
    overrides.set(st.target, { ...overrides.get(st.target), ...st });
  }
  return overrides;
}

function focusOf(step: DavStep | undefined): Set<string> {
  const focus = new Set<string>();
  if (!step) return focus;
  for (const id of step.focus) focus.add(id);
  for (const st of step.states) {
    // Hiding something leaves nothing to look at, so it does not draw attention.
    if (st.visible === false) continue;
    focus.add(st.target);
  }
  for (const a of step.animations) {
    focus.add(a.from);
    focus.add(a.to);
  }
  for (const s of step.statics) {
    focus.add(s.from);
    focus.add(s.to);
  }
  return focus;
}

/** A focused group keeps its whole subtree undimmed. */
function inFocusedGroup(ctx: StepContext, parentId: string | undefined): boolean {
  return ancestorIds(ctx.groupParent, parentId).some((g) => ctx.focus.has(g));
}

function resolveNodes(ctx: StepContext): ResolvedNode[] {
  const { doc, layout, step, overrides, focus, filtering } = ctx;
  const stepEndpoints = new Set([
    ...(step?.animations.flatMap((a) => [a.from, a.to]) ?? []),
    ...(step?.statics.flatMap((s) => [s.from, s.to]) ?? []),
  ]);
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
      visible: stepEndpoints.has(n.id) || (ov.visible ?? n.visible),
      focused: step !== undefined && focused,
      dimmed: filtering && !focused,
    };
    const accent = ov.color === COLOR_RESET ? undefined : (ov.color ?? n.color);
    if (accent) node.accent = accent;
    if (n.sub) node.sub = n.sub;
    const badge = ov.badge !== undefined ? ov.badge : n.badge;
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
    const color = ov.color === COLOR_RESET ? undefined : (ov.color ?? g.color);
    if (color) group.color = color;
    if (g.border) group.border = g.border;
    return [group];
  });
}

function createPhasePackets(
  ctx: StepContext,
  nodeById: ReadonlyMap<string, ResolvedNode>,
  rails: RailRouter,
  canonicalIds: ReadonlyMap<string, string>,
): Packet[][] {
  const zoneOf = zoneOfNodes(ctx.doc);
  const phases: Packet[][] = [];
  for (const a of ctx.step?.animations ?? []) {
    const fromNode = nodeById.get(a.from);
    const toNode = nodeById.get(a.to);
    if (!fromNode || !toNode) continue;

    const edgeId = canonicalIds.get(unorderedPairKey(a.from, a.to));
    const packet: Packet = {
      from: a.from,
      to: a.to,
      fromLabel: fromNode.label,
      toLabel: toNode.label,
      color: a.color ?? DEFAULT_FLOW_COLOR,
      path: rails.railOf(fromNode, toNode),
      roundTrip: a.direction === 'bidirectional',
      durationMs: PHASE_MS,
    };
    const fromZone = zoneOf.get(a.from);
    const toZone = zoneOf.get(a.to);
    if (fromZone !== undefined) packet.fromZone = fromZone;
    if (toZone !== undefined) packet.toZone = toZone;
    if (edgeId !== undefined) packet.edgeId = edgeId;
    if (a.label !== undefined) packet.label = a.label;
    if (a.description !== undefined) packet.description = a.description;
    if (a.code !== undefined && !isBlank(a.code.body)) packet.code = a.code;
    if (a.icon !== undefined) packet.icon = a.icon;

    const current = phases[phases.length - 1];
    if (a.parallel && current) current.push(packet);
    else phases.push([packet]);
  }
  return phases;
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
  canonicalIds: ReadonlyMap<string, string>,
): ResolvedPhases {
  const phases = createPhasePackets(ctx, nodeById, rails, canonicalIds);
  if (phases.length > 1) {
    phases.forEach((phase, index) => {
      phase.forEach((packet, i) => {
        packet.stopLabel = `${index + 1}${phase.length > 1 ? String.fromCharCode(97 + i) : ''}`;
      });
    });
  }
  return {
    phases,
    // At zoom 1 until a camera says how large the diagram is drawn (see `paceView`).
    phaseDurations: pacePhases(phases),
    activeEdges: flowColors(phases.flat()),
  };
}

function resolveEdges(
  ctx: StepContext,
  nodes: readonly ResolvedNode[],
  nodeById: ReadonlyMap<string, ResolvedNode>,
  groupById: ReadonlyMap<string, ResolvedGroup>,
  rails: RailRouter,
  activeEdges: ReadonlyMap<string, string>,
  overview: ReturnType<typeof synthesizedConnections>,
  canonicalIds: ReadonlyMap<string, string>,
  showLabels: boolean,
  stopPoints: readonly Point[],
): ResolvedEdge[] {
  const edges: ResolvedEdge[] = [];
  const stepPairs = new Set<string>();
  const endpointOf = (id: string) => {
    const n = nodeById.get(id);
    if (n) return { endpoint: n, visible: n.visible, focused: n.focused };
    const g = groupById.get(id);
    if (g) return { endpoint: { id: g.id, rect: g.rect }, visible: true, focused: !g.dimmed };
    return undefined;
  };
  const overviewLabels = showLabels && !ctx.step ? connectionLabels(ctx.doc) : undefined;
  const overviewColors = !ctx.step ? connectionColors(ctx.doc) : undefined;

  if (ctx.step) {
    for (const sc of stepConnections(ctx.step, canonicalIds)) {
      const from = endpointOf(sc.from);
      const to = endpointOf(sc.to);
      if (!from || !to || !from.visible || !to.visible) continue;
      stepPairs.add(unorderedPairKey(sc.from, sc.to));
      const activeColor = activeEdges.get(sc.id);
      const edge: ResolvedEdge = {
        id: sc.id,
        from: sc.from,
        to: sc.to,
        style: sc.style,
        direction: sc.direction,
        color: sc.staticColor ?? DEFAULT_EDGE_COLOR,
        path: rails.railOf(from.endpoint, to.endpoint),
        active: activeColor !== undefined,
      };
      if (activeColor !== undefined) edge.flowColor = activeColor;
      const label = sc.staticLabel ?? (showLabels ? sc.animateLabel : undefined);
      if (label !== undefined) edge.label = label;
      edges.push(edge);
    }
  }

  for (const conn of overview) {
    const pk = unorderedPairKey(conn.from, conn.to);
    if (stepPairs.has(pk)) continue;
    const from = endpointOf(conn.from);
    const to = endpointOf(conn.to);
    if (!from || !to || !from.visible || !to.visible) continue;
    if (ctx.filtering && !(from.focused && to.focused)) continue;
    const edge: ResolvedEdge = {
      id: conn.id,
      from: conn.from,
      to: conn.to,
      style: conn.style,
      direction: conn.direction,
      color: overviewColors?.get(pk) ?? DEFAULT_EDGE_COLOR,
      path: rails.railOf(from.endpoint, to.endpoint),
      active: false,
    };
    const overviewLabel = overviewLabels?.get(pk);
    if (overviewLabel !== undefined) edge.label = overviewLabel;
    edges.push(edge);
  }

  if (ctx.step || showLabels) {
    rails.attachLabels(edges, nodes, stopPoints);
  }
  return edges;
}

/**
 * The rails of a diagram depend on where its nodes are, not on the step, so one router serves
 * every step of a layout. That also keeps each rail on the same course from step to step.
 */
const routers = new WeakMap<Layout, { doc: DavDocument; rails: RailRouter }>();

function railsOf(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]): RailRouter {
  const cached = routers.get(layout);
  if (cached?.doc === doc) return cached.rails;
  const rails = new RailRouter(doc, layout, nodes);
  routers.set(layout, { doc, rails });
  return rails;
}

export interface ResolveViewOptions {
  /** Draws representative edge labels on the overview or active `animate` labels on a still step. */
  showLabels?: boolean;
}

/**
 * Resolves what the diagram looks like at a step (`dav 2`).
 * Every step is self-contained: `state`, `static`, `focus`, and `animate` apply to step k only.
 * Pure and deterministic: jumping to any step gives the same result.
 */
export function resolveView(
  doc: DavDocument,
  layout: Layout,
  stepIndex: number | null,
  options?: ResolveViewOptions,
): ResolvedView {
  const step =
    stepIndex !== null && stepIndex >= 0 && stepIndex < doc.steps.length
      ? doc.steps[stepIndex]
      : undefined;
  const index = step !== undefined && stepIndex !== null ? stepIndex : null;
  const focus = focusOf(step);
  const ctx: StepContext = {
    doc,
    layout,
    step,
    overrides: stepOverrides(step),
    focus,
    filtering: step !== undefined && focus.size > 0,
    groupParent: parentMap(doc.groups),
    nodeParent: parentMap(doc.nodes),
  };

  const nodes = resolveNodes(ctx);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const groups = resolveGroups(ctx, nodes);
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const rails = railsOf(doc, layout, nodes);
  const overview = synthesizedConnections(doc);
  const canonicalIds = connectionIdMap(overview);
  const { phases, phaseDurations, activeEdges } = resolvePhases(ctx, nodeById, rails, canonicalIds);

  const visibleNodes = nodes.filter((n) => n.visible);
  const stopPoints = stopPlacements(phases).map((s) => s.at);
  const edges = resolveEdges(
    ctx,
    nodes,
    nodeById,
    groupById,
    rails,
    activeEdges,
    overview,
    canonicalIds,
    options?.showLabels ?? false,
    stopPoints,
  );
  if (phases.length > 0) {
    const stepRails = edges.map((e) => e.path);
    const closed = [
      // A dimmed node may be covered, all but its badge: the step is not about it.
      ...visibleNodes
        .flatMap((n) => [...(n.dimmed ? [] : nodeBody(n)), ...badgeArea(n)])
        .map((part) => expandRect(part, CALLOUT_NODE_CLEARANCE)),
      // A zone's name; the rest of the strip across the top of the zone is free.
      ...groups.map((g) => expandRect(zoneNameArea(g.label, g.rect), CALLOUT_ZONE_NAME_CLEARANCE)),
      ...edges.flatMap((e) => (e.label && e.labelAt ? [edgeLabelArea(e.label, e.labelAt)] : [])),
    ];
    const cells = visibleNodes
      .filter((n) => !n.dimmed)
      .map((n) => expandRect(n.rect, CALLOUT_NODE_CELL_CLEARANCE));
    // A dimmed zone's border may be crossed freely.
    const zones = groups.filter((g) => !g.dimmed).map((g) => g.rect);
    const dimmedBodies = visibleNodes
      .filter((n) => n.dimmed)
      .flatMap((n) => nodeBody(n))
      .map((part) => expandRect(part, CALLOUT_NODE_CLEARANCE));
    for (const phase of phases) {
      placePhaseCallouts(phase, {
        closed,
        cells,
        zones,
        dimmedBodies,
        rails: [...stepRails, ...phase.map((p) => p.path)],
      });
    }
  }

  const view: ResolvedView = {
    title: doc.title,
    stepIndex: index,
    groups,
    nodes: visibleNodes,
    edges,
    phases,
    phaseDurations,
  };
  if (step) {
    view.stepTitle = step.title;
    view.description = step.description;
  }
  return view;
}
