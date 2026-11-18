// How easy a diagram is to read across its overview and steps, in numbers that a change to the
// layout, to the routing or to the placing of labels and callouts can be held to.
import { parse } from '../../dsl';
import { computeLayout, type Layout, type Rect, rectOverlaps, stationRect } from '../../layout';
import {
  analyzeFlow,
  countCorridorIntrusions,
  type FlowAnalysis,
  flowPairKey,
  primaryCorridors,
  type TransitionRole,
} from '../../layout/flow';
import { enclosingRect } from '../../layout/metrics';
import { ownersOf } from '../../layout/zoned';
import type { DavDocument } from '../../model/types';
import { topLevelGroups } from '../../model/zones';
import { expandRect, type Point, segmentIntersectsRect } from '../geometry';
import { calloutRect, computePacketCalloutBox, type ResolvedView, resolveView } from '../index';
import { edgeLabelArea } from '../rails';

export interface Quality {
  /**
   * Of the inter-zone primary forward links, the share whose target station lies to the right
   * of its source station (excluding return/feedback and static links). 1 without such links.
   */
  primaryRightward: number;
  /**
   * Unrelated, auxiliary, or downstream zones intruding horizontally between connected primary
   * zone endpoints while sharing their vertical band.
   */
  layerIntrusions: number;
  /** Drawn crossings between non-adjacent primary rails. */
  primaryCrossings: number;
  /** Primary rails that turn three times or more. */
  primaryWinding: number;
  /** Pairs of callouts that overlap in any step phase. */
  stepCalloutCollisions: number;
  /** Step static labels written over another label or over another rail in that step. */
  stepCoveredLabels: number;
  /** Rails that turn three times or more. */
  winding: number;
  /** Places where two rails cross as they are drawn; rails that share a station do not count. */
  crossings: number;
  /**
   * Places where two rails that share one station cross: rails a node sends to nodes stacked
   * beside each other cross where they turn off in the wrong order.
   */
  sharedCrossings: number;
  /**
   * Rails between zones that step aside: two turns, leaving and arriving the same way, at most
   * 120 apart. Moving one of the zones that little would make them straight.
   */
  jogs: number;
  /**
   * Of the links between zones, the share whose target lies further to the right of its source
   * than above or below it: a diagram is read from left to right. 1 without such links.
   */
  rightward: number;
  /** Edge labels written over another edge's label, or over a rail that is not their own. */
  coveredLabels: number;
  /** Width to height of everything drawn. */
  aspect: number;
}

type Stretch = readonly [Point, Point];

interface RailEntry {
  edge: ResolvedView['edges'][number];
  stretches: Stretch[];
  role: TransitionRole;
}

const stretchesOf = (points: readonly Point[]): Stretch[] =>
  points.slice(0, -1).flatMap((p, i) => {
    const q = points[i + 1];
    return q ? [[p, q] as const] : [];
  });

const side = (p: Point, q: Point, r: Point): number =>
  (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

const cross = ([a, b]: Stretch, [c, d]: Stretch): boolean =>
  side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;

const round = (value: number): number => Math.round(value * 100) / 100;

function railsOf(
  view: ResolvedView,
  roleOf: (from: string, to: string) => TransitionRole,
): RailEntry[] {
  return view.edges.flatMap((edge) =>
    'points' in edge.path
      ? [{ edge, stretches: stretchesOf(edge.path.points), role: roleOf(edge.from, edge.to) }]
      : [],
  );
}

function countCrossings(rails: readonly RailEntry[]): {
  crossings: number;
  sharedCrossings: number;
} {
  let crossings = 0;
  let sharedCrossings = 0;
  rails.forEach((a, i) => {
    for (const b of rails.slice(i + 1)) {
      const ends = new Set([a.edge.from, a.edge.to]);
      const shared = [b.edge.from, b.edge.to].filter((n) => ends.has(n)).length;
      if (shared === 2) continue;
      let count = 0;
      for (const s of a.stretches) count += b.stretches.filter((t) => cross(s, t)).length;
      if (shared === 0) crossings += count;
      else sharedCrossings += count;
    }
  });
  return { crossings, sharedCrossings };
}

function countCoveredLabels(view: ResolvedView, rails: readonly RailEntry[]): number {
  const labels = view.edges.flatMap((edge) =>
    edge.label && edge.labelAt
      ? [{ edge, area: expandRect(edgeLabelArea(edge.label, edge.labelAt), -1) }]
      : [],
  );
  return labels.filter(
    ({ edge, area }) =>
      labels.some((other) => other.edge !== edge && rectOverlaps(area, other.area)) ||
      rails.some(
        (rail) =>
          rail.edge !== edge && rail.stretches.some(([p, q]) => segmentIntersectsRect(p, q, area)),
      ),
  ).length;
}

function countStepCalloutCollisions(view: ResolvedView): number {
  let collisions = 0;
  for (const phase of view.phases) {
    const boxes = phase.flatMap((packet) => {
      const box = computePacketCalloutBox(packet);
      return box ? [calloutRect(box)] : [];
    });
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      if (!a) continue;
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j];
        if (b && rectOverlaps(a, b)) collisions++;
      }
    }
  }
  return collisions;
}

function countLayerIntrusions(
  doc: DavDocument,
  layout: Layout,
  flow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
): number {
  const blockRect = new Map<string, Rect>();
  for (const group of topLevelGroups(doc.groups)) {
    const rect = layout.groups[group.id];
    if (rect) blockRect.set(group.id, rect);
  }
  for (const node of doc.nodes) {
    if (owners.get(node.id) === node.id && node.visible) {
      const rect = layout.nodes[node.id];
      if (rect) blockRect.set(node.id, rect);
    }
  }
  return countCorridorIntrusions(primaryCorridors(flow, owners), blockRect);
}

/** Measures the overview and step playback quality of a diagram as the preview draws it. */
export function qualityOf(dsl: string): Quality {
  const doc = parse(dsl).document;
  const layout = computeLayout(doc);
  const view = resolveView(doc, layout, null);
  const flow = analyzeFlow(doc);
  const owners = ownersOf(doc);
  const ownerOf = (id: string): string => owners.get(id) ?? id;
  const roleOf = (from: string, to: string): TransitionRole =>
    flow.byPair.get(flowPairKey(from, to))?.role ?? 'static';

  const rails = railsOf(view, roleOf);
  const primaryRails = rails.filter((r) => r.role === 'primary');
  const { crossings, sharedCrossings } = countCrossings(rails);
  const { crossings: primaryCrossings } = countCrossings(primaryRails);

  const allStations = new Map(
    doc.nodes.flatMap((n) => {
      const rect = layout.nodes[n.id];
      if (!rect) return [];
      const station = stationRect(rect, n.icon);
      return [
        [n.id, { x: station.x + station.width / 2, y: station.y + station.height / 2 }] as const,
      ];
    }),
  );
  const primaryBetween = flow.connections.flatMap((c) => {
    if (c.role !== 'primary' || ownerOf(c.from) === ownerOf(c.to)) return [];
    const from = allStations.get(c.from);
    const to = allStations.get(c.to);
    return from && to ? [{ dx: to.x - from.x }] : [];
  });
  const primaryToRight = primaryBetween.filter(({ dx }) => dx > 0).length;

  const viewStationOf = new Map(
    view.nodes.map((n) => {
      const station = stationRect(n.rect, n.icon);
      return [n.id, { x: station.x + station.width / 2, y: station.y + station.height / 2 }];
    }),
  );
  const between = view.edges.flatMap((e) => {
    const from = viewStationOf.get(e.from);
    const to = viewStationOf.get(e.to);
    const apart = e.from !== e.to && ownerOf(e.from) !== ownerOf(e.to);
    return apart && from && to ? [{ dx: to.x - from.x, dy: to.y - from.y }] : [];
  });
  const toTheRight = between.filter(({ dx, dy }) => dx > 0 && dx >= Math.abs(dy)).length;

  const jogs = rails.filter(({ edge, stretches }) => {
    const [first, , last] = stretches;
    if (stretches.length !== 3 || !first || !last) return false;
    if (ownerOf(edge.from) === ownerOf(edge.to)) return false;
    const level = (s: Stretch) => Math.abs(s[0].y - s[1].y) < 0.5;
    if (level(first) !== level(last)) return false;
    const apart = level(first) ? first[0].y - last[1].y : first[0].x - last[1].x;
    return Math.abs(apart) <= 120;
  }).length;

  let stepCalloutCollisions = 0;
  let stepCoveredLabels = 0;
  for (let s = 0; s < doc.steps.length; s++) {
    const stepView = resolveView(doc, layout, s);
    stepCalloutCollisions += countStepCalloutCollisions(stepView);
    stepCoveredLabels += countCoveredLabels(stepView, railsOf(stepView, roleOf));
  }

  const drawn: Rect[] = [...Object.values(layout.nodes), ...Object.values(layout.groups)];
  const { width, height } = enclosingRect(drawn);
  const coveredLabels = countCoveredLabels(view, rails);

  return {
    primaryRightward:
      primaryBetween.length === 0 ? 1 : round(primaryToRight / primaryBetween.length),
    layerIntrusions: countLayerIntrusions(doc, layout, flow, owners),
    primaryCrossings,
    primaryWinding: primaryRails.filter((r) => r.stretches.length - 1 >= 3).length,
    stepCalloutCollisions,
    stepCoveredLabels,
    winding: rails.filter((r) => r.stretches.length - 1 >= 3).length,
    crossings,
    sharedCrossings,
    jogs,
    rightward: between.length === 0 ? 1 : round(toTheRight / between.length),
    coveredLabels,
    aspect: height === 0 ? 1 : round(width / height),
  };
}
