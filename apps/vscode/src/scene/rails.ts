import { type Layout, type Rect, rectOverlaps, stationRect } from '../layout';
import { selfLoopNodeIds, synthesizedConnections, unorderedPairKey } from '../model/connections';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import type { DavDocument } from '../model/types';
import { ancestorIds, parentMap } from '../model/zones';
import {
  type Point,
  pointAt,
  type Rail,
  type Route,
  reverse,
  segmentIntersectsRect,
  selfLoop,
} from './geometry';
import type { ResolvedEdge, ResolvedNode } from './resolve';
import { type RoutedRail, type RouteEdge, routeEdges } from './route';
import {
  BADGE_MAX_WIDTH,
  BADGE_SIZE,
  fitText,
  NODE_LABEL_SIZE,
  NODE_SUB_SIZE,
  textWidth,
} from './text';
import { ZONE_LABEL, zoneLabelRoom } from './zones';

/** How far above the middle of its curve a loop's label is written, clear of a numbered stop. */
const LOOP_LABEL_LIFT = 20;

const STATION_CLEARANCE = 12;
const LABEL_AREA_WIDTH = 96;

/** The part of a node a rail must not cross: its station and the labels below it. */
export function stationArea(node: ResolvedNode): Rect {
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

/** Where an edge's label is written: the start, middle or end of its text, on its baseline. */
export interface EdgeLabelSpot {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/** A loop's label is written above the middle of its curve. */
function loopLabelSpot(station: Rect): EdgeLabelSpot {
  const middle = pointAt(selfLoop(station, 0), 0.5);
  return { x: middle.x, y: middle.y - LOOP_LABEL_LIFT, anchor: 'middle' };
}

/**
 * Room kept round the curve of a loop, which no other rail is drawn through or along: wide
 * enough that rails running side by side past it stay clear of it too.
 */
const LOOP_CLEARANCE = 10;

/**
 * The room each loop's curve takes up beside its station. It leaves the station a little right
 * of the middle of its top and comes back a little above the middle of its right side, so the
 * lines through the middle of the station stay open to the rails that meet it there.
 */
function loopAreas(
  loopNodes: ReadonlySet<string>,
  nodes: readonly ResolvedNode[],
  nodeIndex: ReadonlyMap<string, number>,
): Rect[] {
  const areas: Rect[] = [];
  for (const id of loopNodes) {
    const node = nodes[nodeIndex.get(id) ?? -1];
    if (!node) continue;
    const station = stationRect(node.rect, node.icon);
    const curve = selfLoop(station, 0);
    const points = Array.from({ length: 25 }, (_, i) => pointAt(curve, i / 24));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    // Never over the lines through the middle of the station, which its own rails arrive on.
    const x = Math.max(Math.min(...xs) - LOOP_CLEARANCE, station.x + station.width / 2 + 1);
    const y = Math.min(...ys) - LOOP_CLEARANCE;
    const bottom = Math.min(Math.max(...ys) + LOOP_CLEARANCE, station.y + station.height / 2 - 1);
    areas.push({ x, y, width: Math.max(...xs) + LOOP_CLEARANCE - x, height: bottom - y });
  }
  return areas;
}

interface StoredRail {
  canonFrom: string;
  canonTo: string;
  route: Route;
  shared: readonly boolean[];
}

/** The routed rails of one arrangement of a diagram, keyed by `unorderedPairKey`. */
interface Routed {
  rails: Map<string, StoredRail>;
  solidWalls: Rect[];
  loopNodes: Set<string>;
}

/**
 * The rectangle occupied by a node's label and sub-label below its station.
 */
function nodeLabelRect(node: ResolvedNode, area = stationArea(node)): Rect {
  const station = stationRect(node.rect, node.icon);
  const bottom = station.y + station.height;
  // A long name or sub-label is wider than the area a rail keeps clear of.
  const text = Math.min(
    node.rect.width,
    Math.max(
      area.width,
      textWidth(node.label, NODE_LABEL_SIZE, 'bold') + 8,
      node.sub ? textWidth(node.sub, NODE_SUB_SIZE) + 8 : 0,
    ),
  );
  return {
    x: station.x + station.width / 2 - text / 2,
    y: bottom,
    width: text,
    height: area.y + area.height - bottom,
  };
}

/**
 * What is drawn of a node: its station, and the block of labels below it. An edge label keeps
 * clear of these; the room `stationArea` adds around a station is free for it.
 */
export function nodeBody(node: ResolvedNode): Rect[] {
  const station = stationRect(node.rect, node.icon);
  return [
    { x: station.x - 4, y: station.y - 4, width: station.width + 8, height: station.height + 8 },
    nodeLabelRect(node),
  ];
}

/** Straight from one station's outline to the other's, for the rare rail no route is found for. */
function direct(from: ResolvedNode, to: ResolvedNode): Route {
  const a = stationRect(from.rect, from.icon);
  const b = stationRect(to.rect, to.icon);
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const along = (p: Point, by: number): Point => ({
    x: p.x + ((end.x - start.x) / length) * by,
    y: p.y + ((end.y - start.y) / length) * by,
  });
  return { points: [along(start, a.width / 2 + 2), along(end, -(b.width / 2 + 2))] };
}

/** The room a zone's name takes up, which no rail, label or callout is drawn over. */
export function zoneNameArea(label: string, zone: Rect): Rect {
  const width = Math.min(textWidth(label, ZONE_LABEL.size), zoneLabelRoom(zone.width));
  return {
    x: zone.x + ZONE_LABEL.inset - 4,
    y: zone.y + ZONE_LABEL.baseline - ZONE_LABEL.size - 2,
    width: width + 8,
    height: ZONE_LABEL.size + 10,
  };
}

function zoneNameAreas(doc: DavDocument, layout: Layout): Rect[] {
  return doc.groups.flatMap((g) => {
    const rect = layout.groups[g.id];
    return rect ? [zoneNameArea(g.label, rect)] : [];
  });
}

/** How far above its station a node's badge starts, and how tall it is. */
const BADGE_RISE = 25;
const BADGE_HEIGHT = 20;
/** Kept between a badge and a rail that runs level above it. */
const BADGE_CLEARANCE = 8;

/** The room the badge above a node's station takes up; none without a badge. */
export function badgeArea(node: ResolvedNode): Rect[] {
  if (!node.badge) return [];
  const station = stationRect(node.rect, node.icon);
  const width =
    textWidth(fitText(node.badge, BADGE_SIZE, BADGE_MAX_WIDTH, 'bold'), BADGE_SIZE, 'bold') + 16;
  return [
    {
      x: station.x + station.width / 2 - width / 2,
      y: station.y - BADGE_RISE,
      width,
      height: BADGE_HEIGHT,
    },
  ];
}

/**
 * The room above a node's station that a badge is written in, as wide as the node's area. A step
 * may give any node a badge, and a rail keeps its course from step to step.
 */
function badgeRoom(node: ResolvedNode, area: Rect): Rect {
  const station = stationRect(node.rect, node.icon);
  return {
    x: area.x,
    y: station.y - BADGE_RISE - BADGE_CLEARANCE,
    width: area.width,
    height: BADGE_HEIGHT + BADGE_CLEARANCE,
  };
}

/** The room an edge's label takes up where it is written. */
export function edgeLabelArea(label: string, spot: EdgeLabelSpot): Rect {
  const width = textWidth(
    fitText(label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH),
    EDGE_LABEL_FONT_SIZE,
  );
  const left =
    spot.anchor === 'middle'
      ? spot.x - width / 2
      : spot.anchor === 'start'
        ? spot.x
        : spot.x - width;
  return {
    x: left - 2,
    y: spot.y - EDGE_LABEL_FONT_SIZE,
    width: width + 4,
    height: EDGE_LABEL_FONT_SIZE * 1.3,
  };
}

/** Gap between a label and the stretch of rail it is written beside. */
const LABEL_GAP = 7;
/**
 * A step numbers its packets at the middle of their rails. A label is not written there; on a
 * rail too short to avoid it, the label goes further above or below, clear of the number.
 */
const STOP_ROOM = 15;
const LABEL_ABOVE_STOP = 20;
const LABEL_BELOW_STOP = 28;
/** Shares of a stretch at which its label is tried, the middle first. */
const LABEL_SHARES = [0.5, 0.35, 0.65, 0.2, 0.8, 0.27, 0.73, 0.12, 0.88, 0.42, 0.58];

/**
 * Finds each label a place beside its own rail: on the longest stretch that no other rail runs
 * beside and that is long enough for it, clear of every node, zone name, other label and rail.
 * Most-constrained (shortest) rails are placed first. A label with no free place takes the one
 * that covers the least.
 */
function placeLabels(
  edges: ReadonlyArray<{ label: string; rail: Route; shared: readonly boolean[] } | undefined>,
  solid: readonly Rect[],
  rails: readonly Route[],
): Array<EdgeLabelSpot | undefined> {
  const strokes = rails.flatMap((rail) =>
    rail.points.slice(0, -1).flatMap((a, i): Array<{ rail: Route; a: Point; b: Point }> => {
      const b = rail.points[i + 1];
      return b ? [{ rail, a, b }] : [];
    }),
  );
  const totalLen = (rail: Route): number => {
    let len = 0;
    for (let i = 0; i + 1 < rail.points.length; i++) {
      const p = rail.points[i] as Point;
      const q = rail.points[i + 1] as Point;
      len += Math.hypot(q.x - p.x, q.y - p.y);
    }
    return len;
  };
  const order = edges
    .flatMap((edge, i) => (edge ? [{ i, len: totalLen(edge.rail) }] : []))
    .sort((a, b) => a.len - b.len || a.i - b.i)
    .map((entry) => entry.i);

  const taken: Rect[] = [];
  const height = EDGE_LABEL_FONT_SIZE * 1.2;
  const result: Array<EdgeLabelSpot | undefined> = Array(edges.length).fill(undefined);

  for (const edgeIdx of order) {
    const edge = edges[edgeIdx];
    if (!edge) continue;
    const text = fitText(edge.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH);
    const width = textWidth(text, EDGE_LABEL_FONT_SIZE);
    const middle = pointAt(edge.rail, 0.5);
    const stops: Rect = {
      x: middle.x - STOP_ROOM,
      y: middle.y - STOP_ROOM,
      width: STOP_ROOM * 2,
      height: STOP_ROOM * 2,
    };
    const spans = edge.rail.points
      .slice(0, -1)
      .flatMap((p, i) => {
        const q = edge.rail.points[i + 1];
        if (!q) return [];
        const length = Math.hypot(q.x - p.x, q.y - p.y);
        const longEnough = length >= width + 16;
        const isShared = Boolean(edge.shared[i]);
        const fitsUnshared = !isShared && longEnough;
        const fitsShared = isShared && longEnough;
        const fitCost = fitsUnshared ? 0 : fitsShared ? 2 : 4;
        return [{ p, q, length, fitsUnshared, fitsShared, fitCost }];
      })
      .sort(
        (s, t) =>
          Number(t.fitsUnshared) - Number(s.fitsUnshared) ||
          Number(t.fitsShared) - Number(s.fitsShared) ||
          t.length - s.length,
      );

    let best: { spot: EdgeLabelSpot; box: Rect; cost: number } | undefined;
    const consider = (spot: EdgeLabelSpot, left: number, fitCost: number) => {
      const box = {
        x: left - 2,
        y: spot.y - EDGE_LABEL_FONT_SIZE,
        width: width + 4,
        height: EDGE_LABEL_FONT_SIZE * 1.3,
      };
      let cost = fitCost;
      for (const o of solid) if (rectOverlaps(box, o)) cost += 300;
      for (const o of taken) if (rectOverlaps(box, o)) cost += 200;
      if (rectOverlaps(box, stops)) cost += 60;
      for (const s of strokes) {
        if (segmentIntersectsRect(s.a, s.b, box)) {
          cost += s.rail === edge.rail ? 15 : 120;
        }
      }
      if (!best || cost < best.cost) best = { spot, box, cost };
    };
    for (const span of spans) {
      const level = span.p.y === span.q.y;
      for (const share of LABEL_SHARES) {
        const x = span.p.x + (span.q.x - span.p.x) * share;
        const y = span.p.y + (span.q.y - span.p.y) * share;
        for (const gap of [LABEL_GAP, LABEL_GAP + 6, LABEL_GAP + 12]) {
          const fitCost =
            gap === LABEL_GAP ? span.fitCost : span.fitCost + (gap === LABEL_GAP + 6 ? 1 : 2);
          if (level) {
            consider({ x, y: y - gap, anchor: 'middle' }, x - width / 2, fitCost);
            consider({ x, y: y + gap + height * 0.8, anchor: 'middle' }, x - width / 2, fitCost);
          } else {
            const base = y + height * 0.3;
            consider({ x: x + gap, y: base, anchor: 'start' }, x + gap, fitCost);
            consider({ x: x - gap, y: base, anchor: 'end' }, x - gap - width, fitCost);
          }
        }
        if (level && share === 0.5) {
          const stopCost = Math.max(span.fitCost, 2);
          consider({ x, y: y - LABEL_ABOVE_STOP, anchor: 'middle' }, x - width / 2, stopCost);
          consider({ x, y: y + LABEL_BELOW_STOP, anchor: 'middle' }, x - width / 2, stopCost);
        }
        if (best?.cost === 0) break;
      }
      if (best?.cost === 0) break;
    }
    if (!best) continue;
    taken.push(best.box);
    result[edgeIdx] = best.spot;
  }
  return result;
}

/**
 * Routing takes a while on a large diagram, and a diagram is laid out afresh after every edit.
 * The last result is kept for as long as nothing a route depends on has changed.
 */
let lastFound: { key: string; found: Map<string, RoutedRail> } | undefined;

function routesFor(...args: Parameters<typeof routeEdges>): Map<string, RoutedRail> {
  const [nodes, groups, walls, edges] = args;
  const key = JSON.stringify([nodes, groups, walls, edges.map((e) => [e, [...e.home]])]);
  if (lastFound?.key !== key) lastFound = { key, found: routeEdges(...args) };
  return lastFound.found;
}

function routeDiagram(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]): Routed {
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const groups = doc.groups.flatMap((g) => {
    const rect = layout.groups[g.id];
    return rect ? [{ id: g.id, rect }] : [];
  });
  const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
  const groupParent = parentMap(doc.groups);
  const nodeParent = parentMap(doc.nodes);
  const zonesAround = (nodeId: string): number[] =>
    ancestorIds(groupParent, nodeParent.get(nodeId)).flatMap((g) => groupIndex.get(g) ?? []);

  const connections = synthesizedConnections(doc);
  const wanted: RouteEdge[] = [];
  const entries = new Map<string, { conn: (typeof connections)[number]; id: string }>();
  connections.forEach((conn, i) => {
    if (conn.from === conn.to) return;
    const a = nodeIndex.get(conn.from);
    const b = nodeIndex.get(conn.to);
    if (a === undefined || b === undefined) return;
    const id = `c${i}`;
    wanted.push({
      id,
      from: a,
      to: b,
      home: new Set([...zonesAround(conn.from), ...zonesAround(conn.to)]),
      bothWays: conn.direction === 'bidirectional',
    });
    entries.set(unorderedPairKey(conn.from, conn.to), { conn, id });
  });

  const names = zoneNameAreas(doc, layout);
  const areas = nodes.map(stationArea);
  const loopNodes = selfLoopNodeIds(doc);
  const loopRoom = loopAreas(loopNodes, nodes, nodeIndex);
  // Reserve space above self-loops when any step attaches a static label to that loop.
  const loopLabels: Rect[] = [];
  for (const id of loopNodes) {
    const node = nodes[nodeIndex.get(id) ?? -1];
    if (!node) continue;
    let longest: string | undefined;
    for (const step of doc.steps) {
      for (const s of step.statics) {
        if (s.from === id && s.to === id && s.label) {
          if (!longest || s.label.length > longest.length) longest = s.label;
        }
      }
    }
    if (longest) {
      loopLabels.push(edgeLabelArea(longest, loopLabelSpot(stationRect(node.rect, node.icon))));
    }
  }

  const found = routesFor(
    nodes.map((n, i) => {
      const area = areas[i] as Rect;
      return {
        station: stationRect(n.rect, n.icon),
        area,
        labelArea: nodeLabelRect(n, area),
        hasLoop: loopNodes.has(n.id),
        badge: badgeRoom(n, area),
      };
    }),
    groups.map((g) => ({
      rect: g.rect,
      depth: ancestorIds(groupParent, groupParent.get(g.id)).length,
    })),
    // Other rails go round a loop as round a zone's name, instead of through it.
    [...names, ...loopRoom, ...loopLabels],
    wanted,
  );

  const rails = new Map<string, StoredRail>();
  for (const [key, { conn, id }] of entries) {
    const routed = found.get(id);
    if (routed) {
      rails.set(key, {
        canonFrom: conn.from,
        canonTo: conn.to,
        route: { points: routed.points },
        shared: routed.shared,
      });
    } else {
      const a = nodes[nodeIndex.get(conn.from) ?? -1];
      const b = nodes[nodeIndex.get(conn.to) ?? -1];
      if (a && b) {
        rails.set(key, {
          canonFrom: conn.from,
          canonTo: conn.to,
          route: direct(a, b),
          shared: [],
        });
      }
    }
  }
  return {
    rails,
    solidWalls: [...nodes.flatMap(nodeBody), ...names, ...loopLabels, ...loopRoom],
    loopNodes,
  };
}

let lastRouted: { key: string; routed: Routed } | undefined;

function routedFor(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]): Routed {
  const key = JSON.stringify([
    nodes.map((n) => [
      n.id,
      n.icon,
      n.label,
      n.sub ?? '',
      n.rect.x,
      n.rect.y,
      n.rect.width,
      n.rect.height,
    ]),
    doc.nodes.map((n) => n.parentId ?? null),
    doc.groups.map((g) => [g.id, g.parentId ?? null, g.label, layout.groups[g.id] ?? null]),
    synthesizedConnections(doc).map((c) => [c.from, c.to, c.direction]),
    doc.steps.map((s) => s.statics.map((st) => [st.from, st.to, st.label ?? null])),
  ]);
  if (lastRouted?.key !== key) lastRouted = { key, routed: routeDiagram(doc, layout, nodes) };
  return lastRouted.routed;
}

/**
 * The rails of a diagram: right-angled routes that keep clear of every node and zone name, and
 * avoid the zones they have nothing to do with. Rails that share a line run side by side, so
 * opposite directions between two stations get parallel tracks.
 *
 * Every rail is decided once for an arrangement, whatever the step shows, so a rail keeps its
 * course from step to step.
 */
export class RailRouter {
  readonly #routed: Routed;

  constructor(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]) {
    this.#routed = routedFor(doc, layout, nodes);
  }

  /** The routed rail from `from` to `to`, oriented in the caller's direction. */
  railOf(from: ResolvedNode, to: ResolvedNode): Rail {
    if (from.id === to.id) return selfLoop(stationRect(from.rect, from.icon), 0);
    const stored = this.#routed.rails.get(unorderedPairKey(from.id, to.id));
    if (!stored) return direct(from, to);
    return stored.canonFrom === from.id ? stored.route : reverse(stored.route);
  }

  /** Places labels for any `static` statements that have one in the given step's edges. */
  attachLabels(edges: ResolvedEdge[], nodes: readonly ResolvedNode[]): void {
    if (!edges.some((e) => e.label)) return;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const stepRails: Route[] = [];
    const labelInputs: Array<
      { label: string; rail: Route; shared: readonly boolean[] } | undefined
    > = edges.map((e) => {
      if (e.from === e.to) {
        if (e.label) {
          const node = nodeById.get(e.from);
          if (node) e.labelAt = loopLabelSpot(stationRect(node.rect, node.icon));
        }
        return undefined;
      }
      if (!('points' in e.path)) return undefined;
      stepRails.push(e.path);
      if (!e.label) return undefined;
      const stored = this.#routed.rails.get(unorderedPairKey(e.from, e.to));
      const shared = stored
        ? stored.canonFrom === e.from
          ? stored.shared
          : [...stored.shared].reverse()
        : [];
      return { label: e.label, rail: e.path, shared };
    });

    const spots = placeLabels(labelInputs, this.#routed.solidWalls, stepRails);
    edges.forEach((e, i) => {
      const spot = spots[i];
      if (spot) e.labelAt = spot;
    });
  }
}
