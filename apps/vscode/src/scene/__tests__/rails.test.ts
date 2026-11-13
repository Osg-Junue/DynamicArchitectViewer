import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect, rectOverlaps } from '../../layout';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../../model/text';
import { SAMPLE_TEMPLATES } from '../../samples';
import {
  expandRect,
  type Point,
  pointAt,
  type Route,
  railEnds,
  railLength,
  reverse,
  segmentIntersectsRect,
  svgPath,
} from '../geometry';
import { fitText, type ResolvedView, resolveView, textWidth } from '../index';
import { nodeBody, stationArea } from '../rails';
import { type RouteEdge, type RouteNode, routeEdges } from '../route';

/** A node whose station is centered on the point, with its labels below. */
const node = (x: number, y: number): RouteNode => ({
  station: { x: x - 22, y: y - 22, width: 44, height: 44 },
  area: { x: x - 48, y: y - 34, width: 96, height: 102 },
});
const edge = (id: string, from: number, to: number, home: number[] = []): RouteEdge => ({
  id,
  from,
  to,
  home: new Set(home),
});
const stretches = (points: readonly Point[]): Array<[Point, Point]> =>
  points.slice(0, -1).flatMap((p, i) => {
    const q = points[i + 1];
    return q ? [[p, q] as [Point, Point]] : [];
  });
const passes = (points: readonly Point[], area: Rect): boolean =>
  stretches(points).some(([p, q]) => segmentIntersectsRect(p, q, expandRect(area, -1)));

describe('a route as a rail', () => {
  const route: Route = {
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
    ],
  };

  it('is drawn with a rounded corner', () => {
    expect(svgPath(route)).toBe('M 0 0 L 91 0 Q 100 0 100 9 L 100 60');
  });

  it('is a little shorter than its straight stretches, by what the corner cuts off', () => {
    expect(railLength(route)).toBeLessThan(160);
    expect(railLength(route)).toBeGreaterThan(150);
  });

  it('gives points by the share of its length, from its start to its end', () => {
    expect(pointAt(route, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(route, 1)).toEqual({ x: 100, y: 60 });
    const quarter = pointAt(route, 0.25);
    expect(quarter.y).toBe(0);
    expect(quarter.x).toBeCloseTo(railLength(route) / 4);
    // Round the corner, not through it.
    const turning = pointAt(route, 95.5 / railLength(route));
    expect(turning.x).toBeGreaterThan(91);
    expect(turning.x).toBeLessThan(100);
    expect(turning.y).toBeGreaterThan(0);
  });

  it('turns round end for end', () => {
    expect(railEnds(reverse(route))).toEqual({ start: { x: 100, y: 60 }, end: { x: 0, y: 0 } });
    expect(railLength(reverse(route))).toBeCloseTo(railLength(route));
  });
});

describe('finding routes', () => {
  it('joins two level stations by one straight line between their outlines', () => {
    const found = routeEdges([node(100, 100), node(500, 100)], [], [], [edge('e', 0, 1)]);
    expect(found.get('e')?.points).toEqual([
      { x: 124, y: 100 },
      { x: 476, y: 100 },
    ]);
  });

  it('goes round a node that stands in the way', () => {
    const nodes = [node(100, 100), node(400, 100), node(700, 100)];
    const points = routeEdges(nodes, [], [], [edge('e', 0, 2)]).get('e')?.points ?? [];
    expect(points.length).toBeGreaterThan(2);
    expect(passes(points, (nodes[1] as RouteNode).area)).toBe(false);
  });

  it('keeps out of a zone it has nothing to do with, and runs through one of its own', () => {
    const nodes = [node(100, 100), node(700, 100)];
    const zone = { rect: { x: 300, y: 0, width: 200, height: 200 }, depth: 0 };
    const around = routeEdges(nodes, [zone], [], [edge('e', 0, 1)]).get('e')?.points ?? [];
    expect(passes(around, zone.rect)).toBe(false);
    const through = routeEdges(nodes, [zone], [], [edge('e', 0, 1, [0])]).get('e')?.points ?? [];
    expect(through).toHaveLength(2);
  });

  it('never draws over the name of a zone', () => {
    const nodes = [node(100, 100), node(700, 100)];
    const zone = { rect: { x: 300, y: 60, width: 200, height: 200 }, depth: 0 };
    // The name lies right on the straight way through the zone, which is one of the rail's own.
    const name = { x: 310, y: 90, width: 80, height: 20 };
    const points = routeEdges(nodes, [zone], [name], [edge('e', 0, 1, [0])]).get('e')?.points ?? [];
    expect(points.length).toBeGreaterThan(2);
    expect(passes(points, name)).toBe(false);
  });

  it('runs two rails between the same stations side by side, each on the left of its way', () => {
    const found = routeEdges(
      [node(100, 100), node(500, 100)],
      [],
      [],
      [edge('there', 0, 1), edge('back', 1, 0)],
    );
    const there = found.get('there')?.points ?? [];
    const back = found.get('back')?.points ?? [];
    expect(there.map((p) => p.y)).toEqual([96.5, 96.5]);
    expect(back.map((p) => p.y)).toEqual([103.5, 103.5]);
    expect(found.get('there')?.shared).toEqual([true]);
  });

  it('joins stations that are a little off level by one straight line', () => {
    const near = routeEdges([node(100, 100), node(500, 108)], [], [], [edge('e', 0, 1)]);
    const points = near.get('e')?.points ?? [];
    expect(points).toHaveLength(2);
    expect(points[0]?.y).toBe(points[1]?.y);

    // Further off than a station is wide enough to hide, the rail steps across.
    const far = routeEdges([node(100, 100), node(500, 130)], [], [], [edge('e', 0, 1)]);
    expect(far.get('e')?.points.length).toBeGreaterThan(2);
  });

  it('starts below the labels of a node it leaves downwards', () => {
    const found = routeEdges([node(100, 100), node(100, 500)], [], [], [edge('e', 0, 1)]);
    expect(found.get('e')?.points).toEqual([
      { x: 100, y: 170 },
      { x: 100, y: 476 },
    ]);
  });

  it('keeps rails that run together on their sides, so that they part without crossing', () => {
    // Two rails leave the left node side by side. One goes on to the right, the other turns
    // off upwards half way: it must be the upper of the two all along.
    const nodes = [node(100, 300), node(900, 300), node(500, 0)];
    const found = routeEdges(nodes, [], [], [edge('on', 0, 1), edge('up', 0, 2)]);
    const on = found.get('on')?.points ?? [];
    const up = found.get('up')?.points ?? [];
    expect(on[0]?.y).toBeGreaterThan(up[0]?.y ?? Number.POSITIVE_INFINITY);
    const crossings = stretches(on).filter(([a, b]) =>
      stretches(up).some(([c, d]) => {
        const side = (p: Point, q: Point, r: Point) =>
          (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
        return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
      }),
    );
    expect(crossings).toEqual([]);
  });
});

describe('the rails of a diagram', () => {
  const viewOf = (dsl: string, step: number | null = null): ResolvedView => {
    const doc = parse(dsl).document;
    return resolveView(doc, computeLayout(doc), step);
  };

  it('gives a packet that travels where no edge runs a rail of its own', () => {
    const view = viewOf('dav 1\nnode a\nnode b\na --> b\nstep "S" {\n  animate b --> a\n}\n', 0);
    const edge = view.edges[0];
    const packet = view.phases[0]?.[0];
    if (!edge || !packet) throw new Error('missing edge or packet');
    expect(packet.edgeId).toBeUndefined();
    // Beside the edge, the other way.
    expect(railEnds(packet.path).start.x).toBeGreaterThan(railEnds(packet.path).end.x);
    expect(railEnds(packet.path).start.y).not.toBe(railEnds(edge.path).start.y);
    expect(Math.abs(railEnds(packet.path).start.y - railEnds(edge.path).start.y)).toBeLessThan(10);
  });

  it('runs a rail level from a node outside a zone to one inside it', () => {
    const view = viewOf('dav 1\nnode a\ngroup g {\n  node b\n}\na --> b\n');
    const rail = view.edges[0]?.path;
    expect(rail && 'points' in rail && rail.points.length).toBe(2);
  });

  it('keeps that rail level when a node in the zone has a loop, which needs room above it', () => {
    const view = viewOf('dav 1\nnode a\ngroup g {\n  node b\n}\na --> b\nb --> b\n');
    const rail = view.edges.find((e) => e.from === 'a')?.path;
    expect(rail && 'points' in rail && rail.points.length).toBe(2);
  });

  it.each(SAMPLE_TEMPLATES.map((sample) => [sample.id, sample.dsl] as const))(
    '%s: a rail keeps its course from the overview into every step',
    (_, dsl) => {
      const doc = parse(dsl).document;
      const layout = computeLayout(doc);
      const overview = new Map(
        resolveView(doc, layout, null).edges.map((e) => [e.id, e.path] as const),
      );
      doc.steps.forEach((_step, index) => {
        for (const edge of resolveView(doc, layout, index).edges) {
          const before = overview.get(edge.id);
          // An edge that a step reveals has no course on the overview to compare with.
          if (before) expect(edge.path).toEqual(before);
        }
      });
    },
  );

  it.each(SAMPLE_TEMPLATES.map((sample) => [sample.id, sample.dsl] as const))(
    '%s: no rail runs through a node, and no label is written over one',
    (_, dsl) => {
      const view = viewOf(dsl);
      const areas = new Map(view.nodes.map((n) => [n.id, stationArea(n)]));
      for (const edge of view.edges) {
        if (!('points' in edge.path)) continue;
        for (const [id, area] of areas) {
          if (id !== edge.from && id !== edge.to) {
            expect(passes(edge.path.points, area), `${edge.id} through ${id}`).toBe(false);
          }
        }
        if (!edge.label || !edge.labelAt) continue;
        const width = textWidth(
          fitText(edge.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH),
          EDGE_LABEL_FONT_SIZE,
        );
        const { x, y, anchor } = edge.labelAt;
        const box = {
          x: anchor === 'middle' ? x - width / 2 : anchor === 'start' ? x : x - width,
          y: y - EDGE_LABEL_FONT_SIZE * 0.9,
          width,
          height: EDGE_LABEL_FONT_SIZE * 1.1,
        };
        for (const n of view.nodes) {
          const covered = nodeBody(n).some((part) => rectOverlaps(box, part));
          expect(covered, `label of ${edge.id} over ${n.id}`).toBe(false);
        }
      }
    },
  );
});
