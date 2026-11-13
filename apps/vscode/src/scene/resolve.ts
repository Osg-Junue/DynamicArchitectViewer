import type { Layout, Rect } from '../layout';
import { GROUP_HEADER, GROUP_PADDING, selfLoopRoom } from '../layout/metrics';
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
import { type CalloutPlacement, separatePhaseCallouts } from './callout';
import { placePhaseCallouts } from './calloutPlace';
import { expandRect, type Point, pointAt, type Rail, railEnds, reverse } from './geometry';
import { THEME_COLOR } from './paint';
import {
  badgeArea,
  type EdgeLabelSpot,
  edgeLabelArea,
  nodeBody,
  RailRouter,
  stationArea,
} from './rails';
import { PHASE_MS, pacePhase } from './timing';

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
  style: LineStyle;
  direction: Direction;
  color: string;
  /** Color of the flow overlay; present when `active`. */
  flowColor?: string;
  path: Rail;
  /** Where the label is written; present when the edge has one. */
  labelAt?: EdgeLabelSpot;
  /** Packets flow along this edge in the current step. */
  active: boolean;
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
  /** Sideways move of the callout, set when nudged around an obstacle or separated from a sibling. */
  calloutShift?: number;
  /** Which side of its rail the callout sits on; defaults to `'above'`. */
  calloutPlacement?: CalloutPlacement;
  /** Top-left corner of the callout, where the last pass found it a place (see `placePhaseCallouts`). */
  calloutAt?: Point;
  /**
   * The number on this packet's stop and callout: its phase, with a letter when the phase runs
   * several packets (`5a`, `5b`). Absent in a step with a single phase, which draws no stops.
   */
  stopLabel?: string;
  /** Shared baseline bottom y when aligned with parallel `'above'` sibling callouts. */
  calloutBottom?: number;
  /** Shared top-edge shelf y when aligned with parallel `'below'` sibling callouts. */
  calloutTop?: number;
  path: Rail;
  /** Written as `<->` in the `animate`: the packet goes to the end and comes back. */
  roundTrip: boolean;
  /** Top edge of the two endpoint nodes; `'above'` callouts stay above it to keep them visible. */
  clearTop: number;
  /** Bottom clearance of the endpoint nodes for `'below'` callouts. */
  clearBottom?: number;
  /** Zone areas and focused stations on the canvas, which the callout must not cover. */
  labelAreas: readonly Rect[];
  /** Dimmed visible stations avoided when within reasonable lift/push distance. */
  dimmedNodeAreas?: readonly Rect[];
  /** Core rects of all visible nodes for scoring leader-line station/label crossings at midpoint. */
  nodeCores?: readonly Rect[];
  /** Core rects of non-endpoint visible nodes for scoring pointer sweep crossings along the rail. */
  otherNodeCores?: readonly Rect[];
  /** Bounding rects of all groups for penalizing full top-to-bottom leader traversals across zones. */
  groupRects?: readonly Rect[];
  /** True when the packet rides a lower reverse track or downward-bowed curve. */
  preferBelow?: boolean;
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

/** The strip across the top of a zone that its name moves along. */
const ZONE_NAME_STRIP = GROUP_PADDING + GROUP_HEADER;
/** Kept around what is drawn of a node: its station, its badge and its labels. */
const CALLOUT_NODE_CLEARANCE = 4;
/** Kept around the cell of a node a step is about, and around a dimmed node's station and labels. */
const CALLOUT_NODE_CELL_CLEARANCE = 6;
const CALLOUT_DIMMED_NODE_CLEARANCE = 14;

/** Max height of a normal 1–3 row zone treated as a solid obstacle on all four sides. */
const MAX_SOLID_GROUP_HEIGHT = 468;

/** Solid full-zone obstacle for 1–3 row zones, or top/bottom border bands for giant outer containers. */
function groupObstacleBands(group: ResolvedGroup): Rect[] {
  const outer = expandRect(group.rect, 10);
  if (group.rect.height <= MAX_SOLID_GROUP_HEIGHT) return [outer];
  return [
    { ...outer, height: GROUP_PADDING + GROUP_HEADER + 10 },
    { x: outer.x, y: group.rect.y + group.rect.height - 10, width: outer.width, height: 20 },
    { x: outer.x, y: outer.y, width: 20, height: outer.height },
    { x: group.rect.x + group.rect.width - 10, y: outer.y, width: 20, height: outer.height },
  ];
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

const NODE_CORE_INSET_X = 16;
const NODE_CORE_INSET_TOP = 10;
const NODE_CORE_INSET_BOTTOM = 4;

function nodeCoreRect(rect: Rect): Rect {
  return {
    x: rect.x + NODE_CORE_INSET_X,
    y: rect.y + NODE_CORE_INSET_TOP,
    width: Math.max(0, rect.width - NODE_CORE_INSET_X * 2),
    height: Math.max(0, rect.height - (NODE_CORE_INSET_TOP + NODE_CORE_INSET_BOTTOM)),
  };
}

/** Whether a flow from `from` to `to` travels right-to-left along a lower return track. */
function isReturnTrack(
  rails: RailRouter,
  from: ResolvedNode,
  to: ResolvedNode,
  oneWayOnBidirectionalEdge = false,
): boolean {
  return (
    to.rect.x < from.rect.x && (rails.hasReverseTrack(from.id, to.id) || oneWayOnBidirectionalEdge)
  );
}

interface CalloutSceneContext {
  zoneOf: ReadonlyMap<string, string | undefined>;
  topOf: (node: ResolvedNode) => number;
  labelAreas: Rect[];
  dimmedNodeAreas: Rect[];
  nodeCoreEntries: ReadonlyArray<{ id: string; core: Rect }>;
  nodeCores: Rect[];
  groupRects: Rect[];
}

function buildCalloutSceneContext(
  doc: DavDocument,
  groups: readonly ResolvedGroup[],
  nodes: readonly ResolvedNode[],
): CalloutSceneContext {
  const loopRoom = selfLoopRoom(doc);
  const topOf = (n: ResolvedNode): number => n.rect.y - (loopRoom.get(n.id) ?? 0);
  const nodeObstacle = (n: ResolvedNode): Rect => {
    const top = topOf(n) - 10;
    return {
      x: n.rect.x - 4,
      y: top,
      width: n.rect.width + 8,
      height: n.rect.y + n.rect.height + 10 - top,
    };
  };
  const visibleNodes = nodes.filter((n) => n.visible);
  const nodeCoreEntries = visibleNodes.map((n) => ({ id: n.id, core: nodeCoreRect(n.rect) }));
  return {
    zoneOf: zoneOfNodes(doc),
    topOf,
    labelAreas: [
      ...groups.flatMap(groupObstacleBands),
      ...visibleNodes.filter((n) => !n.dimmed).map(nodeObstacle),
    ],
    dimmedNodeAreas: visibleNodes.filter((n) => n.dimmed).map(nodeObstacle),
    nodeCoreEntries,
    nodeCores: nodeCoreEntries.map((e) => e.core),
    groupRects: groups.map((g) => g.rect),
  };
}

function createPhasePackets(
  ctx: StepContext,
  nodeById: ReadonlyMap<string, ResolvedNode>,
  rails: RailRouter,
  scene: CalloutSceneContext,
): Packet[][] {
  const phases: Packet[][] = [];
  for (const a of ctx.step?.animations ?? []) {
    const fromNode = nodeById.get(a.from);
    const toNode = nodeById.get(a.to);
    if (!fromNode || !toNode) continue;

    const edge = edgeForPacket(ctx, a.from, a.to);
    const edgeFrom = edge && nodeById.get(edge.from);
    const edgeTo = edge && nodeById.get(edge.to);
    let path: Rail;
    if (edge && edgeFrom && edgeTo) {
      const edgePath = rails.ofEdge(edge, edgeFrom, edgeTo);
      path = edge.from === a.from ? edgePath : reverse(edgePath);
    } else {
      path = rails.between(fromNode, toNode);
    }
    const ends = railEnds(path);

    const fromBottom = fromNode.rect.y + fromNode.rect.height;
    const toBottom = toNode.rect.y + toNode.rect.height;
    const clearBottom =
      Math.abs(fromNode.rect.y - toNode.rect.y) < 40
        ? Math.max(fromBottom, toBottom)
        : Math.min(fromBottom, toBottom);
    const oneWayOnBidi = edge?.direction === 'bidirectional' && a.direction !== 'bidirectional';
    const preferBelow =
      isReturnTrack(rails, fromNode, toNode, oneWayOnBidi) ||
      pointAt(path, 0.5).y > Math.max(ends.start.y, ends.end.y) + 18;
    const otherNodeCores = scene.nodeCoreEntries
      .filter((e) => e.id !== a.from && e.id !== a.to)
      .map((e) => e.core);

    const packet: Packet = {
      from: a.from,
      to: a.to,
      fromLabel: fromNode.label,
      toLabel: toNode.label,
      color: a.color ?? DEFAULT_FLOW_COLOR,
      path,
      roundTrip: a.direction === 'bidirectional',
      clearTop: Math.min(scene.topOf(fromNode), scene.topOf(toNode)),
      clearBottom,
      labelAreas: scene.labelAreas,
      otherNodeCores,
      durationMs: PHASE_MS,
    };
    if (scene.dimmedNodeAreas.length > 0) packet.dimmedNodeAreas = scene.dimmedNodeAreas;
    if (scene.nodeCores.length > 0) packet.nodeCores = scene.nodeCores;
    if (scene.groupRects.length > 0) packet.groupRects = scene.groupRects;
    if (preferBelow) packet.preferBelow = true;
    const fromZone = scene.zoneOf.get(a.from);
    const toZone = scene.zoneOf.get(a.to);
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
  groups: readonly ResolvedGroup[],
  nodes: readonly ResolvedNode[],
): ResolvedPhases {
  const scene = buildCalloutSceneContext(ctx.doc, groups, nodes);
  const phases = createPhasePackets(ctx, nodeById, rails, scene);
  if (phases.length > 1) {
    phases.forEach((phase, index) => {
      phase.forEach((packet, i) => {
        packet.stopLabel = `${index + 1}${phase.length > 1 ? String.fromCharCode(97 + i) : ''}`;
      });
    });
  }
  for (const phase of phases) separatePhaseCallouts(phase);
  return {
    phases,
    phaseDurations: phases.map(pacePhase),
    activeEdges: flowColors(phases.flat()),
  };
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
    // A step that focuses on something draws only the edges it is about: the ones it runs
    // packets on or sets the state of, and those between two focused nodes. The rest would
    // only be a tangle behind them.
    const focused =
      activeColor !== undefined || ctx.focus.has(e.id) || (from.focused && to.focused);
    if (ctx.filtering && !focused) return [];
    const edge: ResolvedEdge = {
      id: e.id,
      from: e.from,
      to: e.to,
      style: e.style,
      direction: e.direction,
      color: ov.color ?? e.color ?? DEFAULT_EDGE_COLOR,
      path: rails.ofEdge(e, from, to),
      active: activeColor !== undefined,
    };
    if (activeColor !== undefined) edge.flowColor = activeColor;
    if (e.label) edge.label = e.label;
    const labelAt = rails.labelOf(e, from, to);
    if (labelAt) edge.labelAt = labelAt;
    return [edge];
  });
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
  const rails = railsOf(doc, layout, nodes);
  const { phases, phaseDurations, activeEdges } = resolvePhases(
    ctx,
    nodeById,
    rails,
    groups,
    nodes,
  );

  const visibleNodes = nodes.filter((n) => n.visible);
  const edges = resolveEdges(ctx, nodeById, rails, activeEdges);
  if (phases.length > 0) {
    const stepRails = edges.map((e) => e.path);
    const closed = [
      ...visibleNodes
        .flatMap((n) => [...nodeBody(n), ...badgeArea(n)])
        .map((part) => expandRect(part, CALLOUT_NODE_CLEARANCE)),
      // A zone's name follows the camera along the strip at the top of its zone.
      ...groups.map((g) => ({ ...g.rect, height: ZONE_NAME_STRIP })),
      ...edges.flatMap((e) => (e.label && e.labelAt ? [edgeLabelArea(e.label, e.labelAt)] : [])),
    ];
    const cells = visibleNodes.map((n) =>
      n.dimmed
        ? expandRect(stationArea(n), CALLOUT_DIMMED_NODE_CLEARANCE)
        : expandRect(n.rect, CALLOUT_NODE_CELL_CLEARANCE),
    );
    const zones = groups.map((g) => g.rect);
    for (const phase of phases) {
      placePhaseCallouts(phase, {
        closed,
        cells,
        zones,
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
