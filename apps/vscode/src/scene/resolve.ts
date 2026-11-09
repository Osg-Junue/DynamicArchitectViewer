import { type Layout, type Rect, stationRect } from '../layout';
import { estimateTextWidth } from '../model/text';
import {
  COLOR_RESET,
  type DavDocument,
  type Direction,
  type IconName,
  type LineStyle,
} from '../model/types';
import {
  type Bezier,
  bowLeft,
  connectStations,
  connectVertical,
  reverse,
  routeAround,
  selfLoop,
  shiftLeft,
} from './geometry';

export const DEFAULT_FLOW_COLOR = 'var(--dav-accent)';
const DEFAULT_EDGE_COLOR = 'var(--dav-edge)';

export interface ResolvedNode {
  id: string;
  label: string;
  sub?: string;
  icon: IconName;
  badge?: string;
  /** Author-specified color; absent when the station follows the theme. */
  accent?: string;
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
  color: string;
  path: Bezier;
  /** Written as `<->` in the `animate`: the packet goes to the end and comes back. */
  roundTrip: boolean;
  /** Top edge of the two endpoint nodes; the callout stays above it to keep them visible. */
  clearTop: number;
  /** Zone names on the canvas, which the callout must not cover. */
  labelAreas: readonly Rect[];
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

const TRACK_OFFSET = 12;
/** How far each further edge between the same stations bends away from the first. */
const SHARED_RAIL_BOW = 36;
const STATION_CLEARANCE = 12;
const LABEL_AREA_WIDTH = 96;

/** Where a zone's name is drawn (see groupLabelElement). */
function zoneLabelArea(group: ResolvedGroup): Rect {
  const { x, y, width } = group.rect;
  return {
    x: x + 14,
    y: y + 6,
    width: Math.min(estimateTextWidth(group.label, 12), Math.max(40, width - 28)),
    height: 18,
  };
}

/** The part of a node a rail must not cross: its station and the labels below it. */
function stationArea(node: ResolvedNode): Rect {
  const station = stationRect(node.rect, node.icon);
  const width = Math.max(station.width + STATION_CLEARANCE * 2, LABEL_AREA_WIDTH);
  const top = station.y - STATION_CLEARANCE;
  return {
    x: station.x + station.width / 2 - width / 2,
    y: top,
    width,
    height: node.rect.y + node.rect.height - top,
  };
}

/**
 * Connects two stations. A vertical rail leaves below the upper station's labels,
 * so it does not run through its text.
 */
function stationConnect(from: ResolvedNode, to: ResolvedNode): Bezier {
  const a = stationRect(from.rect, from.icon);
  const b = stationRect(to.rect, to.icon);
  const dx = Math.abs(a.x + a.width / 2 - (b.x + b.width / 2));
  const dy = Math.abs(a.y + a.height / 2 - (b.y + b.height / 2));
  if (dx >= dy * 0.85) return connectStations(a, b);
  const withLabels = (station: Rect, node: ResolvedNode): Rect => ({
    ...station,
    height: node.rect.y + node.rect.height - station.y,
  });
  return a.y < b.y
    ? connectVertical(withLabels(a, from), b)
    : connectVertical(a, withLabels(b, to));
}

/** The flow color of each edge the packets ride; the first packet on an edge decides. */
export function flowColors(packets: readonly Packet[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const { edgeId, color } of packets) {
    if (edgeId !== undefined && !colors.has(edgeId)) colors.set(edgeId, color);
  }
  return colors;
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
  const index = step ? (stepIndex as number) : null;

  // 1. Accumulate state overrides.
  type Override = Partial<{
    badge: string;
    visible: boolean;
    color: string;
  }>;
  const overrides = new Map<string, Override>();
  if (index !== null) {
    for (const s of doc.steps.slice(0, index + 1)) {
      for (const st of s.states) {
        const { target, ...rest } = st;
        const merged = { ...overrides.get(target), ...rest };
        if (merged.color === COLOR_RESET) delete merged.color;
        overrides.set(target, merged);
      }
    }
  }

  // 2. Focus set for this step.
  const focus = new Set<string>();
  if (step) {
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
      dimmed: filtering && !focusedGroups.has(g.id) && !inFocusedGroup(g.parentId),
    };
    const color = ov.color ?? g.color;
    if (color) group.color = color;
    return [group];
  });

  const labelAreas = groups.map(zoneLabelArea);

  // 5. Rails. Opposite directions between two stations run on parallel tracks.
  const trackKey = (from: string, to: string) => `${from}\u0000${to}`;
  const sharedRail = new Set(
    doc.edges
      .filter((e) => e.direction === 'bidirectional')
      .flatMap((e) => [trackKey(e.from, e.to), trackKey(e.to, e.from)]),
  );
  const directions = new Set(
    [...doc.edges, ...doc.steps.flatMap((s) => s.animations)]
      .filter((r) => r.from !== r.to)
      .map((r) => trackKey(r.from, r.to))
      .filter((key) => !sharedRail.has(key)),
  );
  // Edges that would share one rail are told apart by their position among those edges.
  const railUse = new Map<string, number>();
  const railOrdinals = new Map(
    doc.edges.map((e) => {
      const forward = trackKey(e.from, e.to);
      const backward = trackKey(e.to, e.from);
      const both = e.direction === 'bidirectional';
      const ordinal = Math.max(railUse.get(forward) ?? 0, both ? (railUse.get(backward) ?? 0) : 0);
      railUse.set(forward, ordinal + 1);
      if (both) railUse.set(backward, ordinal + 1);
      return [e, ordinal] as const;
    }),
  );
  const railBetween = (from: ResolvedNode, to: ResolvedNode, ordinal = 0): Bezier => {
    if (from.id === to.id) return selfLoop(stationRect(from.rect, from.icon), ordinal);
    const others = nodes.filter((n) => n.id !== from.id && n.id !== to.id);
    const path = routeAround(stationConnect(from, to), others.map(stationArea));
    const track = directions.has(trackKey(to.id, from.id)) ? shiftLeft(path, TRACK_OFFSET) : path;
    return ordinal > 0 ? bowLeft(track, ordinal * SHARED_RAIL_BOW) : track;
  };

  // 6. Animation phases. Between parallel edges, a packet prefers one that is on screen.
  const isShown = (e: DavDocument['edges'][number]) => overrides.get(e.id)?.visible ?? e.visible;
  const edgeFor = (from: string, to: string) => {
    const candidates = doc.edges.filter(
      (e) =>
        (e.from === from && e.to === to) ||
        (e.direction === 'bidirectional' && e.from === to && e.to === from),
    );
    return candidates.find(isShown) ?? candidates[0];
  };
  const phases: Packet[][] = [];
  const activeEdges = new Map<string, string>();
  for (const a of step?.animations ?? []) {
    const fromNode = nodeById.get(a.from);
    const toNode = nodeById.get(a.to);
    if (!fromNode || !toNode) continue;
    const edge = edgeFor(a.from, a.to);
    const color = a.color ?? DEFAULT_FLOW_COLOR;
    let path = railBetween(fromNode, toNode);
    if (edge) {
      const edgeFrom = nodeById.get(edge.from);
      const edgeTo = nodeById.get(edge.to);
      if (edgeFrom && edgeTo) {
        const edgePath = railBetween(edgeFrom, edgeTo, railOrdinals.get(edge));
        path = edge.from === a.from ? edgePath : reverse(edgePath);
      }
      if (!activeEdges.has(edge.id)) activeEdges.set(edge.id, color);
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
    };
    if (edge) packet.edgeId = edge.id;
    if (a.label !== undefined) packet.label = a.label;
    if (a.description !== undefined) packet.description = a.description;
    const current = phases[phases.length - 1];
    if (a.parallel && current) current.push(packet);
    else phases.push([packet]);
  }

  // 7. Edges.
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
      labelBelow: directions.has(trackKey(e.to, e.from)) && to.rect.x < from.rect.x,
      style: e.style,
      direction: e.direction,
      color: ov.color ?? e.color ?? DEFAULT_EDGE_COLOR,
      path: railBetween(from, to, railOrdinals.get(e)),
      active: activeColor !== undefined,
      dimmed: filtering && !focused,
    };
    if (activeColor !== undefined) edge.flowColor = activeColor;
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
