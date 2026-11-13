import { type Rect, stationRect } from '../layout';
import type { DavDocument, DavEdge } from '../model/types';
import { idPair } from '../model/zones';
import {
  type Bezier,
  bowLeft,
  connectStations,
  connectVertical,
  type Point,
  pointAt,
  routeAround,
  selfLoop,
  shiftLeft,
} from './geometry';
import type { ResolvedNode } from './resolve';

const TRACK_OFFSET = 12;
/** How far each further edge between the same stations bends away from the first. */
const SHARED_RAIL_BOW = 36;
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

/** Edges that would share one rail are told apart by their position among those edges. */
function railOrdinals(doc: DavDocument): Map<DavEdge, number> {
  const railUse = new Map<string, number>();
  return new Map(
    doc.edges.map((e) => {
      const forward = idPair(e.from, e.to);
      const backward = idPair(e.to, e.from);
      const both = e.direction === 'bidirectional';
      const ordinal = Math.max(railUse.get(forward) ?? 0, both ? (railUse.get(backward) ?? 0) : 0);
      railUse.set(forward, ordinal + 1);
      if (both) railUse.set(backward, ordinal + 1);
      return [e, ordinal] as const;
    }),
  );
}

/** Gap between rails that would otherwise leave a station from one point. */
const FAN_GAP = 9;
/** Ends closer than this on one station count as leaving from one spot. */
const FAN_SPOT = 6;
/** How much of a round station's half-width a fan may take up. */
const FAN_MAX_SPREAD = 0.8;
/** Width a fan may take on a flat side, such as under a node's labels. */
const FAN_MAX_WIDTH = 72;

/**
 * Moves one end of a rail sideways by `offset`, across the direction it leaves in. On a round
 * station the end stays on the outline; its control point moves along, so that the rail still
 * leaves in the same direction, beside its neighbors.
 */
function shiftEnd(path: Bezier, atStart: boolean, station: Rect, offset: number): Bezier {
  const end = atStart ? path.p0 : path.p3;
  const control = atStart ? path.p1 : path.p2;
  const across = acrossOf(end, control);
  const center = { x: station.x + station.width / 2, y: station.y + station.height / 2 };
  const radius = station.width / 2;
  const fromCenter = Math.hypot(end.x - center.x, end.y - center.y);
  let moved: Point;
  if (station.width === station.height && Math.abs(fromCenter - radius) < 1) {
    const angle = Math.atan2(end.y - center.y, end.x - center.x);
    // Along the outline, the way `across` points.
    const tangent = { x: -Math.sin(angle), y: Math.cos(angle) };
    const turn = Math.asin(Math.max(-1, Math.min(1, offset / radius)));
    const signed = tangent.x * across.x + tangent.y * across.y >= 0 ? turn : -turn;
    moved = {
      x: center.x + radius * Math.cos(angle + signed),
      y: center.y + radius * Math.sin(angle + signed),
    };
  } else {
    moved = { x: end.x + across.x * offset, y: end.y + across.y * offset };
  }
  const movedControl = { x: control.x + across.x * offset, y: control.y + across.y * offset };
  return atStart
    ? { ...path, p0: moved, p1: movedControl }
    : { ...path, p2: movedControl, p3: moved };
}

/** The unit vector across the direction a rail takes from `end` towards `control`. */
function acrossOf(end: Point, control: Point): Point {
  const dx = control.x - end.x;
  const dy = control.y - end.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

/** A rail whose course is decided, as the others see it when they choose theirs. */
interface Settled {
  from: string;
  to: string;
  points: Point[];
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const SETTLED_SAMPLES = 16;

function settle(from: string, to: string, path: Bezier): Settled {
  const points = Array.from({ length: SETTLED_SAMPLES + 1 }, (_, i) =>
    pointAt(path, i / SETTLED_SAMPLES),
  );
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    from,
    to,
    points,
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

const side = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function cross(a: Settled, b: Settled): boolean {
  if (a.left > b.right || b.left > a.right || a.top > b.bottom || b.top > a.bottom) return false;
  for (let i = 1; i < a.points.length; i++) {
    for (let j = 1; j < b.points.length; j++) {
      const p = a.points[i - 1];
      const q = a.points[i];
      const r = b.points[j - 1];
      const t = b.points[j];
      if (p && q && r && t && segmentsCross(p, q, r, t)) return true;
    }
  }
  return false;
}

/**
 * Draws the rails of a diagram. Opposite directions between two stations get parallel tracks.
 *
 * A rail that has to bend round a node often has several bends to choose from. It takes the
 * one that crosses the fewest rails already decided: first the rails that run straight, then
 * the bent ones in declaration order. Every edge is decided this way once, whatever the step
 * shows, so a rail keeps its course from step to step.
 */
export class RailRouter {
  readonly #doc: DavDocument;
  readonly #tracks: Set<string>;
  readonly #ordinals: Map<DavEdge, number>;
  readonly #nodes: ReadonlyMap<string, ResolvedNode>;
  readonly #obstacles: ReadonlyArray<{ id: string; area: Rect }>;
  #edgePaths: Map<DavEdge, Bezier> | undefined;
  #settled: Settled[] = [];

  constructor(doc: DavDocument, nodes: readonly ResolvedNode[]) {
    this.#doc = doc;
    this.#tracks = separateTracks(doc);
    this.#ordinals = railOrdinals(doc);
    this.#nodes = new Map(nodes.map((n) => [n.id, n]));
    this.#obstacles = nodes.map((n) => ({ id: n.id, area: stationArea(n) }));
  }

  /** Whether something also runs from `to` back to `from` on a track of its own. */
  hasReverseTrack(from: string, to: string): boolean {
    return this.#tracks.has(idPair(to, from));
  }

  #others(from: string, to: string): Rect[] {
    return this.#obstacles.filter((o) => o.id !== from && o.id !== to).map((o) => o.area);
  }

  /** How many decided rails a path would cross; rails that share a station meet, not cross. */
  #crossings(from: string, to: string, path: Bezier): number {
    const candidate = settle(from, to, path);
    let count = 0;
    for (const rail of this.#settled) {
      if (rail.from === from || rail.from === to || rail.to === from || rail.to === to) continue;
      if (cross(candidate, rail)) count++;
    }
    return count;
  }

  #detour(from: ResolvedNode, to: ResolvedNode, direct = stationConnect(from, to)): Bezier {
    return routeAround(direct, this.#others(from.id, to.id), (candidate) =>
      this.#crossings(from.id, to.id, candidate),
    );
  }

  /**
   * The straight course of every edge, with the ends that would share one point of a station
   * set side by side. That happens to rails steeper than a station lets them leave, and to
   * rails that leave straight up or down. Rails between the same two stations count as one:
   * their tracks are told apart later.
   */
  #fannedOut(): Array<{ edge: DavEdge; from: ResolvedNode; to: ResolvedNode; direct: Bezier }> {
    const rails = this.#doc.edges.flatMap((edge) => {
      const from = this.#nodes.get(edge.from);
      const to = this.#nodes.get(edge.to);
      if (!from || !to || from === to) return [];
      return [{ edge, from, to, direct: stationConnect(from, to) }];
    });

    // Ends that meet at one spot of one station, by the pair of stations they join. A spot
    // is a few units wide: rails that close together read as one line anyway.
    type End = { rail: (typeof rails)[number]; atStart: boolean };
    const spots = new Map<string, Array<{ at: Point; pairs: Map<string, End[]> }>>();
    for (const rail of rails) {
      for (const atStart of [true, false]) {
        const node = atStart ? rail.from : rail.to;
        const at = atStart ? rail.direct.p0 : rail.direct.p3;
        const other = atStart ? rail.to.id : rail.from.id;
        const ofNode = spots.get(node.id) ?? [];
        spots.set(node.id, ofNode);
        let spot = ofNode.find((o) => Math.hypot(o.at.x - at.x, o.at.y - at.y) < FAN_SPOT);
        if (!spot) {
          spot = { at, pairs: new Map() };
          ofNode.push(spot);
        }
        const ends = spot.pairs.get(other) ?? [];
        spot.pairs.set(other, ends);
        ends.push({ rail, atStart });
      }
    }
    const meeting = [...spots.values()].flatMap((ofNode) => ofNode.map((spot) => spot.pairs));

    for (const pairs of meeting) {
      if (pairs.size < 2) continue;
      const groups = [...pairs.values()];
      const [lead] = groups[0] ?? [];
      if (!lead) continue;
      const node = lead.atStart ? lead.rail.from : lead.rail.to;
      const station = stationRect(node.rect, node.icon);
      const end = lead.atStart ? lead.rail.direct.p0 : lead.rail.direct.p3;
      const across = acrossOf(end, lead.atStart ? lead.rail.direct.p1 : lead.rail.direct.p2);
      // In the order of where they head, so that the fan does not cross itself.
      const heading = (group: (typeof groups)[number]): number => {
        const [first] = group;
        if (!first) return 0;
        const far = first.atStart ? first.rail.direct.p3 : first.rail.direct.p0;
        return (far.x - end.x) * across.x + (far.y - end.y) * across.y;
      };
      const ordered = groups
        .map((group, index) => ({ group, index, heading: heading(group) }))
        .sort((a, b) => a.heading - b.heading || a.index - b.index);
      const round = station.width === station.height;
      const room = round ? station.width * FAN_MAX_SPREAD : FAN_MAX_WIDTH;
      const gap = Math.min(FAN_GAP, room / (ordered.length - 1));
      ordered.forEach(({ group }, i) => {
        const offset = (i - (ordered.length - 1) / 2) * gap;
        if (offset === 0) return;
        for (const { rail, atStart } of group) {
          rail.direct = shiftEnd(rail.direct, atStart, station, offset);
        }
      });
    }
    return rails;
  }

  /** The course of every edge, before its track offset. */
  #routes(): Map<DavEdge, Bezier> {
    if (this.#edgePaths) return this.#edgePaths;
    const paths = new Map<DavEdge, Bezier>();
    this.#edgePaths = paths;
    const bent: Array<{ edge: DavEdge; from: ResolvedNode; to: ResolvedNode; direct: Bezier }> = [];
    for (const { edge, from, to, direct } of this.#fannedOut()) {
      if (routeAround(direct, this.#others(from.id, to.id)) === direct) {
        paths.set(edge, direct);
        this.#settled.push(settle(from.id, to.id, direct));
      } else {
        bent.push({ edge, from, to, direct });
      }
    }
    for (const { edge, from, to, direct } of bent) {
      const path = this.#detour(from, to, direct);
      paths.set(edge, path);
      this.#settled.push(settle(from.id, to.id, path));
    }
    return paths;
  }

  #onTrack(path: Bezier, from: string, to: string, ordinal: number): Bezier {
    const track = this.hasReverseTrack(from, to) ? shiftLeft(path, TRACK_OFFSET) : path;
    return ordinal > 0 ? bowLeft(track, ordinal * SHARED_RAIL_BOW) : track;
  }

  /** A rail between two stations that no edge joins, such as the path of a lone packet. */
  between(from: ResolvedNode, to: ResolvedNode, ordinal = 0): Bezier {
    if (from.id === to.id) return selfLoop(stationRect(from.rect, from.icon), ordinal);
    this.#routes();
    return this.#onTrack(this.#detour(from, to), from.id, to.id, ordinal);
  }

  /** The rail of a declared edge, whose stations are `from` and `to`. */
  ofEdge(edge: DavEdge, from: ResolvedNode, to: ResolvedNode): Bezier {
    const ordinal = this.#ordinals.get(edge) ?? 0;
    if (from.id === to.id) return selfLoop(stationRect(from.rect, from.icon), ordinal);
    const path = this.#routes().get(edge) ?? this.#detour(from, to);
    return this.#onTrack(path, from.id, to.id, ordinal);
  }
}
