import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { edgeLabelArea, nodeBody, stationArea } from '../rails';
import { type RouteEdge, type RouteNode, routeEdges } from '../route';
import { crossesAt, passage, RAIL_WIDTH } from '../routeGrid';
import { LARGE_DIAGRAMS } from './helpers';

/** A node whose station is centered on the point, with its labels below. */
const node = (x: number, y: number): RouteNode => ({
  station: { x: x - 22, y: y - 22, width: 44, height: 44 },
  area: { x: x - 48, y: y - 34, width: 96, height: 102 },
  badge: { x: x - 48, y: y - 55, width: 96, height: 28 },
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

  it('runs level above the room of a badge rather than through it', () => {
    // The node between the two closes the straight way, so the rail goes over it.
    const nodes = [node(0, 300), node(200, 300), node(400, 300)];
    const points = routeEdges(nodes, [], [], [edge('e', 0, 2)]).get('e')?.points ?? [];
    const level = stretches(points).filter(([p, q]) => p.y === q.y);
    expect(level.length).toBeGreaterThan(0);
    for (const { badge } of nodes) {
      expect(level.some(([p, q]) => segmentIntersectsRect(p, q, expandRect(badge, -1)))).toBe(
        false,
      );
    }
  });

  it('does not turn so near the node it ends at that its arrowhead would hide the rail', () => {
    // The way over the node between the two is closed, so the rail goes under it. Turning up
    // on the line right under the last node's labels would leave 6 for an arrowhead 11 long.
    const nodes = [node(0, 0), node(150, 0), node(300, 0), node(150, 150)];
    const wall = { x: 100, y: -200, width: 100, height: 164 };
    const points = routeEdges(nodes, [], [wall], [edge('e', 0, 2)]).get('e')?.points ?? [];
    const [turn, end] = points.slice(-2);
    expect(points.length).toBeGreaterThan(2);
    expect(turn && end && Math.hypot(turn.x - end.x, turn.y - end.y)).toBeGreaterThanOrEqual(16);
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

describe('two routes at a crossing', () => {
  // A grid ten crossings wide: the crossing in column x of row y is y * 10 + x.
  const [RIGHT, DOWN, UP] = [0, 1, 3];
  const noWayBack = () => -1;
  /** The way back from a crossing, for `crossesAt`: each crossing with the heading it was reached with. */
  const wayBack = (...steps: Array<[crossing: number, heading: number]>) => {
    const left = steps.map(([crossing, heading]) => crossing * 4 + heading);
    return () => left.shift() ?? -1;
  };

  it('cross where both go straight through', () => {
    const other = passage(1, DOWN, DOWN);
    expect(crossesAt([], other, RIGHT, RIGHT, noWayBack)).toBe(true);
  });

  it('do not cross where both turn, each in a corner of its own', () => {
    const other = passage(1, DOWN, RIGHT);
    expect(crossesAt([], other, RIGHT, DOWN, noWayBack)).toBe(false);
  });

  it('are not said to cross while they run on together', () => {
    const other = passage(1, RIGHT, RIGHT);
    expect(crossesAt([], other, RIGHT, RIGHT, noWayBack)).toBe(false);
  });

  describe('that have run together', () => {
    // The other route comes down to crossing 54, turns right and runs on along row 5. Ours
    // comes along that row from the left: the other one joined it from above.
    const routes: Array<number[] | undefined> = [];
    routes[54] = [passage(1, DOWN, RIGHT)];
    routes[55] = [passage(1, RIGHT, RIGHT)];
    routes[56] = [passage(1, RIGHT, RIGHT)];
    const back = () => wayBack([55, RIGHT], [54, RIGHT], [53, RIGHT]);

    it('cross where ours leaves to the side the other one came from', () => {
      expect(crossesAt(routes, passage(1, RIGHT, RIGHT), RIGHT, UP, back())).toBe(true);
    });

    it('part without crossing where ours leaves to the other side', () => {
      expect(crossesAt(routes, passage(1, RIGHT, RIGHT), RIGHT, DOWN, back())).toBe(false);
    });

    it('do not cross where the other one started on the line, at its station', () => {
      // No passage at 54: the other route starts there.
      const started: Array<number[] | undefined> = [];
      started[55] = routes[55];
      started[56] = routes[56];
      expect(crossesAt(started, passage(1, RIGHT, RIGHT), RIGHT, UP, back())).toBe(false);
    });
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

  it.each(
    LARGE_DIAGRAMS.filter(([, dsl]) => parse(dsl).document.edges.some((e) => e.from === e.to)),
  )('%s: no label of another edge is written over the label of a loop', (_, dsl) => {
    // A loop's label has a place of its own, above its curve, where the rails that leave the
    // same station run past: their labels must keep clear of it.
    const view = viewOf(dsl);
    const areaOf = (e: ResolvedView['edges'][number]): Rect[] =>
      e.label && e.labelAt ? [edgeLabelArea(e.label, e.labelAt)] : [];
    const ofLoops = view.edges.filter((e) => e.from === e.to).flatMap(areaOf);
    expect(ofLoops.length).toBeGreaterThan(0);
    for (const e of view.edges.filter((e) => e.from !== e.to)) {
      for (const area of areaOf(e)) {
        expect(
          ofLoops.some((loop) => rectOverlaps(area, loop)),
          `label of ${e.id} over the label of a loop`,
        ).toBe(false);
      }
    }
  });

  it('is drawn as wide as the routing takes a rail to be', () => {
    // The width is in the stylesheet, and the least distance between two rails is worked
    // out from it: the two were 4 and 3.5 once, and rails set that near were one band.
    const css = readFileSync(resolve(__dirname, '../../runtime/scene.css'), 'utf8');
    const rule = /\.dav-rail,\s*\.dav-flow\s*\{\s*stroke-width:\s*([\d.]+)px/.exec(css);
    expect(Number(rule?.[1])).toBe(RAIL_WIDTH);
  });

  it.each(LARGE_DIAGRAMS)('%s: no rail is drawn on another one', (_, dsl) => {
    // Lines of the grid stood nearer to each other than rails are set apart, and each line
    // spread its rails on its own: two rails ran half a unit apart for hundreds of units, as
    // one thick line. A station that many rails meet on one side still sets them nearer than
    // the 7 they keep elsewhere, but never so near that they touch.
    const rails = viewOf(dsl).edges.flatMap((e) =>
      'points' in e.path ? [{ id: e.id, parts: stretches(e.path.points) }] : [],
    );
    const span = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)] as const;
    for (const [i, a] of rails.entries()) {
      for (const b of rails.slice(i + 1)) {
        for (const [p, q] of a.parts) {
          for (const [r, s] of b.parts) {
            const upright = p.x === q.x;
            if (upright !== (r.x === s.x)) continue;
            const [lo, hi] = upright ? span(p.y, q.y) : span(p.x, q.x);
            const [from, to] = upright ? span(r.y, s.y) : span(r.x, s.x);
            if (Math.min(hi, to) - Math.max(lo, from) < 20) continue;
            const apart = Math.abs(upright ? p.x - r.x : p.y - r.y);
            expect(apart, `${a.id} beside ${b.id}`).toBeGreaterThanOrEqual(RAIL_WIDTH + 0.5);
          }
        }
      }
    }
  });

  it('routes a rail that passes a station with a loop round the loop and its label', () => {
    // The rails beside a node took the room its loop is drawn in for a way through: the rail
    // from `job` down to `latest` ran through the loop of `svc`, and the one from `idp` over it.
    const view = viewOf(`dav 1
node sched "Scheduler"
node dev "Developer"
group app "Jobs" {
  node job "Sync job"
  node svc "Access service"
}
group data "Warehouse" {
  node latest "Latest snapshot"
  node raw "Raw table"
  node members "Members"
}
group ext "External" {
  node gitlab "GitLab"
  node idp "Identity"
  node audit "Audit log"
}
sched ..> job : "Scheduled"
dev --> svc : "Request"
job --> latest : "SELECT"
job --> raw : "Append to raw"
job --> audit : "Code / log"
latest --> svc : "Read"
idp --> svc : "Token"
svc ..> svc : "Re-check grant"
svc --> members : "Add member"
svc --> gitlab : "Invite"
raw --> members : "Merge"
gitlab --> audit : "Webhook"
job --> idp : "Service account"
`);
    const loop = view.edges.find((e) => e.from === e.to);
    if (!loop?.label || !loop.labelAt) throw new Error('no loop with a label');
    const curve = Array.from({ length: 25 }, (_, i) => pointAt(loop.path, i / 24));
    const xs = curve.map((p) => p.x);
    const ys = curve.map((p) => p.y);
    const [left, top] = [Math.min(...xs), Math.min(...ys)];
    const room: Rect[] = [
      { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top },
      edgeLabelArea(loop.label, loop.labelAt),
    ];
    const passing = view.edges.filter((e) => e.from !== loop.from && e.to !== loop.from);
    expect(passing.length).toBeGreaterThan(0);
    for (const e of passing) {
      const points = (e.path as Route).points;
      for (let i = 0; i + 1 < points.length; i++) {
        for (const box of room) {
          expect(
            segmentIntersectsRect(points[i] as Point, points[i + 1] as Point, box),
            `${e.id} through the loop on ${loop.from}`,
          ).toBe(false);
        }
      }
    }
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
