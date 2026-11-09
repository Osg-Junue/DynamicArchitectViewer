import { type Rect, stationRect } from '../layout';
import type { DavDocument, DavEdge } from '../model/types';
import { idPair } from '../model/zones';
import {
  type Bezier,
  bowLeft,
  connectStations,
  connectVertical,
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

/** Draws the rails of one view. Opposite directions between two stations get parallel tracks. */
export class RailRouter {
  readonly #tracks: Set<string>;
  readonly #ordinals: Map<DavEdge, number>;
  readonly #obstacles: ReadonlyArray<{ id: string; area: Rect }>;

  constructor(doc: DavDocument, nodes: readonly ResolvedNode[]) {
    this.#tracks = separateTracks(doc);
    this.#ordinals = railOrdinals(doc);
    this.#obstacles = nodes.map((n) => ({ id: n.id, area: stationArea(n) }));
  }

  /** Whether something also runs from `to` back to `from` on a track of its own. */
  hasReverseTrack(from: string, to: string): boolean {
    return this.#tracks.has(idPair(to, from));
  }

  between(from: ResolvedNode, to: ResolvedNode, ordinal = 0): Bezier {
    if (from.id === to.id) return selfLoop(stationRect(from.rect, from.icon), ordinal);
    const others = this.#obstacles
      .filter((o) => o.id !== from.id && o.id !== to.id)
      .map((o) => o.area);
    const path = routeAround(stationConnect(from, to), others);
    const track = this.hasReverseTrack(from.id, to.id) ? shiftLeft(path, TRACK_OFFSET) : path;
    return ordinal > 0 ? bowLeft(track, ordinal * SHARED_RAIL_BOW) : track;
  }

  /** The rail of a declared edge, whose stations are `from` and `to`. */
  ofEdge(edge: DavEdge, from: ResolvedNode, to: ResolvedNode): Bezier {
    return this.between(from, to, this.#ordinals.get(edge));
  }
}
