import { type Layout, type Rect, rectOverlaps, stationRect } from '../layout';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import type { DavDocument, DavEdge } from '../model/types';
import { ancestorIds, idPair, parentMap } from '../model/zones';
import {
  type Point,
  pointAt,
  type Rail,
  type Route,
  segmentIntersectsRect,
  selfLoop,
} from './geometry';
import type { ResolvedNode } from './resolve';
import { type RouteEdge, routeEdges } from './route';
import {
  BADGE_MAX_WIDTH,
  BADGE_SIZE,
  estimateTextWidth,
  fitText,
  NODE_LABEL_SIZE,
  NODE_SUB_SIZE,
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

/** Directions between stations that have a rail of their own, not shared with the reverse. */
function separateTracks(doc: DavDocument): Set<string> {
  const sharedRail = new Set(
    doc.edges
      .filter((e) => e.direction === 'bidirectional')
      .flatMap((e) => [idPair(e.from, e.to), idPair(e.to, e.from)]),
  );
  return new Set(
    [...doc.edges, ...doc.steps.flatMap((s) => s.animations)]
      .filter((r) => r.from !== r.to)
      .map((r) => idPair(r.from, r.to))
      .filter((key) => !sharedRail.has(key)),
  );
}

/** Loops on one station are told apart by their position among them: each nests outside the last. */
function loopOrdinals(doc: DavDocument): Map<DavEdge, number> {
  const loops = new Map<string, number>();
  return new Map(
    doc.edges
      .filter((e) => e.from === e.to)
      .map((e) => {
        const ordinal = loops.get(e.from) ?? 0;
        loops.set(e.from, ordinal + 1);
        return [e, ordinal] as const;
      }),
  );
}

/** Where an edge's label is written: the start, middle or end of its text, on its baseline. */
export interface EdgeLabelSpot {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/** The rails of one arrangement of a diagram. */
interface Routed {
  /** By position in `doc.edges`; none for a loop. */
  ofEdges: Array<Route | undefined>;
  labels: Array<EdgeLabelSpot | undefined>;
  /** Rails for packets that travel where no edge runs, by `idPair(from, to)`. */
  lone: Map<string, Route>;
}

/** A packet rides an edge the way it points, or a two-way edge either way. */
const carries = (e: DavEdge, from: string, to: string): boolean =>
  (e.from === from && e.to === to) ||
  (e.direction === 'bidirectional' && e.from === to && e.to === from);

/**
 * What is drawn of a node: its station, and the block of labels below it. An edge label keeps
 * clear of these; the room `stationArea` adds around a station is free for it.
 */
export function nodeBody(node: ResolvedNode): Rect[] {
  const station = stationRect(node.rect, node.icon);
  const area = stationArea(node);
  const bottom = station.y + station.height;
  // A long name or sub-label is wider than the area a rail keeps clear of.
  const text = Math.min(
    node.rect.width,
    Math.max(
      area.width,
      estimateTextWidth(node.label, NODE_LABEL_SIZE) + 8,
      node.sub ? estimateTextWidth(node.sub, NODE_SUB_SIZE) + 8 : 0,
    ),
  );
  return [
    { x: station.x - 4, y: station.y - 4, width: station.width + 8, height: station.height + 8 },
    {
      x: station.x + station.width / 2 - text / 2,
      y: bottom,
      width: text,
      height: area.y + area.height - bottom,
    },
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
function zoneNameArea(label: string, zone: Rect): Rect {
  const width = Math.min(estimateTextWidth(label, ZONE_LABEL.size), zoneLabelRoom(zone.width));
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

/** The room the badge above a node's station takes up; none without a badge. */
export function badgeArea(node: ResolvedNode): Rect[] {
  if (!node.badge) return [];
  const station = stationRect(node.rect, node.icon);
  const width =
    estimateTextWidth(fitText(node.badge, BADGE_SIZE, BADGE_MAX_WIDTH), BADGE_SIZE) + 16;
  return [{ x: station.x + station.width / 2 - width / 2, y: station.y - 25, width, height: 20 }];
}

/** The room an edge's label takes up where it is written. */
export function edgeLabelArea(label: string, spot: EdgeLabelSpot): Rect {
  const width = estimateTextWidth(
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
const LABEL_SHARES = [0.5, 0.3, 0.7];

/**
 * Finds each label a place beside its own rail: on the longest stretch that no other rail runs
 * beside and that is long enough for it, clear of every node, zone name, other label and rail.
 * A label with no such place takes the one that covers the least.
 */
function placeLabels(
  edges: ReadonlyArray<{ label: string; rail: Route; shared: readonly boolean[] } | undefined>,
  solid: readonly Rect[],
  rails: readonly Route[],
): Array<EdgeLabelSpot | undefined> {
  const strokes = rails.flatMap((rail) =>
    rail.points.slice(0, -1).flatMap((a, i): Array<[Point, Point]> => {
      const b = rail.points[i + 1];
      return b ? [[a, b]] : [];
    }),
  );
  const taken: Rect[] = [];
  const height = EDGE_LABEL_FONT_SIZE * 1.2;
  return edges.map((edge) => {
    if (!edge) return undefined;
    const text = fitText(edge.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH);
    const width = estimateTextWidth(text, EDGE_LABEL_FONT_SIZE);
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
        return [{ p, q, length, fits: !edge.shared[i] && length >= width + 16 }];
      })
      .sort((s, t) => Number(t.fits) - Number(s.fits) || t.length - s.length);

    let best: { spot: EdgeLabelSpot; box: Rect; cost: number } | undefined;
    const consider = (spot: EdgeLabelSpot, left: number, fits: boolean) => {
      const box = { x: left - 2, y: spot.y - height * 0.8, width: width + 4, height };
      const cost =
        [...solid, ...taken, stops].filter((o) => rectOverlaps(box, o)).length * 100 +
        strokes.filter(([p, q]) => segmentIntersectsRect(p, q, box)).length * 10 +
        (fits ? 0 : 1);
      if (!best || cost < best.cost) best = { spot, box, cost };
    };
    for (const span of spans) {
      const level = span.p.y === span.q.y;
      for (const share of LABEL_SHARES) {
        const x = span.p.x + (span.q.x - span.p.x) * share;
        const y = span.p.y + (span.q.y - span.p.y) * share;
        if (level) {
          // Above the stretch, or else below it.
          consider({ x, y: y - LABEL_GAP, anchor: 'middle' }, x - width / 2, span.fits);
          consider(
            { x, y: y + LABEL_GAP + height * 0.8, anchor: 'middle' },
            x - width / 2,
            span.fits,
          );
          if (share === 0.5) {
            consider({ x, y: y - LABEL_ABOVE_STOP, anchor: 'middle' }, x - width / 2, false);
            consider({ x, y: y + LABEL_BELOW_STOP, anchor: 'middle' }, x - width / 2, false);
          }
        } else {
          // To the right of the stretch, or else to its left.
          const base = y + height * 0.3;
          consider({ x: x + LABEL_GAP, y: base, anchor: 'start' }, x + LABEL_GAP, span.fits);
          consider({ x: x - LABEL_GAP, y: base, anchor: 'end' }, x - LABEL_GAP - width, span.fits);
        }
        if (best?.cost === 0) break;
      }
      if (best?.cost === 0) break;
    }
    if (!best) return undefined;
    taken.push(best.box);
    return best.spot;
  });
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

  const wanted: RouteEdge[] = [];
  const want = (id: string, from: string, to: string) => {
    const a = nodeIndex.get(from);
    const b = nodeIndex.get(to);
    if (a === undefined || b === undefined || a === b) return;
    wanted.push({ id, from: a, to: b, home: new Set([...zonesAround(from), ...zonesAround(to)]) });
  };
  doc.edges.forEach((e, i) => {
    want(`e${i}`, e.from, e.to);
  });
  const lonePairs = new Map<string, { from: string; to: string }>();
  for (const a of doc.steps.flatMap((s) => s.animations)) {
    if (a.from === a.to || doc.edges.some((e) => carries(e, a.from, a.to))) continue;
    lonePairs.set(idPair(a.from, a.to), a);
  }
  for (const [key, pair] of lonePairs) want(`l${key}`, pair.from, pair.to);

  const names = zoneNameAreas(doc, layout);
  const areas = nodes.map(stationArea);
  const found = routeEdges(
    nodes.map((n, i) => ({ station: stationRect(n.rect, n.icon), area: areas[i] as Rect })),
    groups.map((g) => ({
      rect: g.rect,
      depth: ancestorIds(groupParent, groupParent.get(g.id)).length,
    })),
    names,
    wanted,
  );

  const railOf = (id: string, from: string, to: string): Route | undefined => {
    const route = found.get(id);
    if (route) return { points: route.points };
    const a = nodes[nodeIndex.get(from) ?? -1];
    const b = nodes[nodeIndex.get(to) ?? -1];
    return a && b && a !== b ? direct(a, b) : undefined;
  };
  const ofEdges = doc.edges.map((e, i) => railOf(`e${i}`, e.from, e.to));
  const lone = new Map<string, Route>();
  for (const [key, pair] of lonePairs) {
    const rail = railOf(`l${key}`, pair.from, pair.to);
    if (rail) lone.set(key, rail);
  }
  const labels = placeLabels(
    doc.edges.map((e, i) => {
      const rail = ofEdges[i];
      return e.label && rail
        ? { label: e.label, rail, shared: found.get(`e${i}`)?.shared ?? [] }
        : undefined;
    }),
    [...nodes.flatMap(nodeBody), ...names],
    ofEdges.flatMap((rail) => rail ?? []),
  );
  return { ofEdges, labels, lone };
}

/**
 * Routing takes a while on a large diagram, and a diagram is laid out afresh after every edit.
 * The last result is kept for as long as nothing a route depends on has changed.
 */
let lastRouted: { key: string; routed: Routed } | undefined;

function routedFor(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]): Routed {
  const key = JSON.stringify([
    nodes.map((n) => [n.id, n.icon, n.rect.x, n.rect.y, n.rect.width, n.rect.height]),
    doc.nodes.map((n) => n.parentId ?? null),
    doc.groups.map((g) => [g.id, g.parentId ?? null, g.label, layout.groups[g.id] ?? null]),
    doc.edges.map((e) => [e.from, e.to, e.direction, e.label ?? null]),
    doc.steps.map((s) => s.animations.map((a) => [a.from, a.to])),
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
  readonly #tracks: Set<string>;
  readonly #loops: Map<DavEdge, number>;
  readonly #indexOf: Map<DavEdge, number>;
  readonly #routed: Routed;

  constructor(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]) {
    this.#tracks = separateTracks(doc);
    this.#loops = loopOrdinals(doc);
    this.#indexOf = new Map(doc.edges.map((e, i) => [e, i]));
    this.#routed = routedFor(doc, layout, nodes);
  }

  /** Whether something also runs from `to` back to `from` on a track of its own. */
  hasReverseTrack(from: string, to: string): boolean {
    return this.#tracks.has(idPair(to, from));
  }

  /** A rail between two stations that no edge joins, such as the path of a lone packet. */
  between(from: ResolvedNode, to: ResolvedNode, ordinal = 0): Rail {
    if (from.id === to.id) return selfLoop(stationRect(from.rect, from.icon), ordinal);
    return this.#routed.lone.get(idPair(from.id, to.id)) ?? direct(from, to);
  }

  /** The rail of a declared edge, whose stations are `from` and `to`. */
  ofEdge(edge: DavEdge, from: ResolvedNode, to: ResolvedNode): Rail {
    if (from.id === to.id) {
      return selfLoop(stationRect(from.rect, from.icon), this.#loops.get(edge) ?? 0);
    }
    return this.#routed.ofEdges[this.#indexOf.get(edge) ?? -1] ?? direct(from, to);
  }

  /** Where the edge's label goes; a loop's is written above the middle of its curve. */
  labelOf(edge: DavEdge, from: ResolvedNode, to: ResolvedNode): EdgeLabelSpot | undefined {
    if (!edge.label) return undefined;
    if (from.id === to.id) {
      const middle = pointAt(this.ofEdge(edge, from, to), 0.5);
      return { x: middle.x, y: middle.y - LOOP_LABEL_LIFT, anchor: 'middle' };
    }
    return this.#routed.labels[this.#indexOf.get(edge) ?? -1];
  }
}
