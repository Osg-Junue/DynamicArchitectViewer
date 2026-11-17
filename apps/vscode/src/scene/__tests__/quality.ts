// How easy the overview of a diagram is to read, in numbers that a change to the layout, to
// the routing or to the placing of labels can be held to.
import { parse } from '../../dsl';
import { computeLayout, type Rect, rectOverlaps, stationRect } from '../../layout';
import { enclosingRect } from '../../layout/metrics';
import { zoneOfNodes } from '../../model/zones';
import { expandRect, type Point, segmentIntersectsRect } from '../geometry';
import { resolveView } from '../index';
import { edgeLabelArea } from '../rails';

export interface Quality {
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

/** Measures the overview of a diagram as the preview draws it. */
export function qualityOf(dsl: string): Quality {
  const doc = parse(dsl).document;
  const layout = computeLayout(doc);
  const view = resolveView(doc, layout, null);

  const rails = view.edges.flatMap((e) =>
    'points' in e.path ? [{ edge: e, stretches: stretchesOf(e.path.points) }] : [],
  );
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

  const zoneOf = zoneOfNodes(doc);
  const stationOf = new Map(
    view.nodes.map((n) => {
      const station = stationRect(n.rect, n.icon);
      return [n.id, { x: station.x + station.width / 2, y: station.y + station.height / 2 }];
    }),
  );
  const between = view.edges.flatMap((e) => {
    const from = stationOf.get(e.from);
    const to = stationOf.get(e.to);
    const apart = e.from !== e.to && (zoneOf.get(e.from) ?? e.from) !== (zoneOf.get(e.to) ?? e.to);
    return apart && from && to ? [{ dx: to.x - from.x, dy: to.y - from.y }] : [];
  });
  const toTheRight = between.filter(({ dx, dy }) => dx > 0 && dx >= Math.abs(dy)).length;
  const jogs = rails.filter(({ edge, stretches }) => {
    const [first, , last] = stretches;
    if (stretches.length !== 3 || !first || !last) return false;
    if ((zoneOf.get(edge.from) ?? edge.from) === (zoneOf.get(edge.to) ?? edge.to)) return false;
    const level = (s: Stretch) => Math.abs(s[0].y - s[1].y) < 0.5;
    if (level(first) !== level(last)) return false;
    const apart = level(first) ? first[0].y - last[1].y : first[0].x - last[1].x;
    return Math.abs(apart) <= 120;
  }).length;

  const labels = view.edges.flatMap((e) =>
    e.label && e.labelAt
      ? [{ edge: e, area: expandRect(edgeLabelArea(e.label, e.labelAt), -1) }]
      : [],
  );
  const coveredLabels = labels.filter(
    ({ edge, area }) =>
      labels.some((other) => other.edge !== edge && rectOverlaps(area, other.area)) ||
      rails.some(
        (rail) =>
          rail.edge !== edge && rail.stretches.some(([p, q]) => segmentIntersectsRect(p, q, area)),
      ),
  ).length;

  const drawn: Rect[] = [...Object.values(layout.nodes), ...Object.values(layout.groups)];
  const { width, height } = enclosingRect(drawn);

  return {
    winding: rails.filter((r) => r.stretches.length - 1 >= 3).length,
    crossings,
    sharedCrossings,
    jogs,
    rightward: between.length === 0 ? 1 : round(toTheRight / between.length),
    coveredLabels,
    aspect: round(width / height),
  };
}
