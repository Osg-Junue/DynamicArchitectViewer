import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeColumnLayout } from '../columns';
import {
  adoptZonePlan,
  backEdgesOf,
  computeLayout,
  countCrossings,
  pendingZoneSearch,
  pickSeedSearch,
  type Rect,
  rectContains,
  rectOverlaps,
  searchZones,
  searchZonesFrom,
  ZONE_SEARCH_SEEDS,
} from '../index';
import { enclosingRect, STATION_CENTER } from '../metrics';
import { longLinkExcess, structureKey } from '../zoned';

/** The larger diagrams of the scene's tests: five zones and over twenty nodes each. */
const FIXTURES = resolve(__dirname, '../../scene/__tests__/fixtures');
const LARGE_DIAGRAMS = readdirSync(FIXTURES)
  .sort()
  .map((file) => [file, readFileSync(resolve(FIXTURES, file), 'utf8')] as const);

/** Zones of `size` chained nodes in a row, with links from the first zone to all the others. */
function bigDiagram(size = 6, zones = 8): string {
  const lines = ['dav 1'];
  for (let z = 0; z < zones; z++) {
    lines.push(`group z${z} "Zone ${z}" {`);
    for (let n = 0; n < size; n++) lines.push(`  node z${z}n${n} "Node ${n}"`);
    lines.push('}');
    for (let n = 1; n < size; n++) lines.push(`z${z}n${n - 1} --> z${z}n${n}`);
    if (z > 0) lines.push(`z${z - 1}n${size - 1} <-> z${z}n0`);
    if (z > 1) lines.push(`z0n0 --> z${z}n${size - 1}`);
  }
  lines.push('step "Hop" {');
  lines.push('  animate z0n0 --> z0n1 : "short"');
  lines.push('  animate z0n1 <-> z0n2 : "there and back"');
  lines.push('  animate z1n0 --> z1n1');
  lines.push('  animate z2n0 --> z2n1 [parallel: true]');
  lines.push('  animate z3n0 --> z3n1 [parallel: true]');
  lines.push('}');
  return lines.join('\n');
}

describe('zoned placement', () => {
  const { document } = parse(bigDiagram());
  const layout = computeLayout(document);

  it('moves zones off the shared columns when links are too long', () => {
    const columns = new Set(Object.values(layout.nodes).map((n) => n.x));
    expect(columns.size).toBeLessThan(document.nodes.length);
  });

  it('fills the canvas instead of stretching into a strip', () => {
    const rects = Object.values(layout.groups);
    const { width, height } = enclosingRect(rects);
    // The column layout of this diagram is 60 times as wide as it is high. How close to the
    // canvas's own 1.6 the zones come is a balance against the length of their links.
    expect(width / height).toBeLessThan(3.5);
    expect(width / height).toBeGreaterThan(1);
  });

  it.each([
    [4, 3],
    [4, 9],
    [6, 5],
    [8, 9],
    [10, 7],
  ])('frees %i zones of %i nodes from the strip their columns make', (zones, size) => {
    // In columns, each of these is a single row without crossings, dozens of times wider
    // than high. Freeing the zones costs a crossing or two and is worth it.
    const doc = parse(bigDiagram(size, zones)).document;
    const placed = computeLayout(doc);
    const rects = Object.values(placed.groups);
    const { width, height } = enclosingRect(rects);
    expect(width / height).toBeLessThan(5);
    expect(countCrossings(doc, placed)).toBeLessThanOrEqual(2);
  });

  it('leaves no zone further from the others than its clearance asks for', () => {
    // Every zone of this diagram is linked to another, so each is pulled next to one.
    const rects = Object.values(layout.groups);
    const gapTo = (a: Rect, b: Rect): number =>
      Math.hypot(
        Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width)),
        Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height)),
      );
    for (const a of rects) {
      const nearest = Math.min(...rects.filter((b) => b !== a).map((b) => gapTo(a, b)));
      // 60 across and 34 down are the clearances; a diagonal neighbor is a little further.
      expect(nearest).toBeLessThanOrEqual(70);
      expect(nearest).toBeGreaterThanOrEqual(34);
    }
  });

  it('leaves no band across the diagram that only links run through', () => {
    // Eight entrances hold the front zone by nine links, and a single link leads on from it to a
    // chain of zones. No zone moving alone closes the gap that link spans: the two parts have
    // to come together as wholes. Without that, a band 1285 wide is left between them.
    const lines = ['dav 1', 'group entrances {'];
    for (let n = 0; n < 8; n++) lines.push(`  node e${n}`);
    lines.push('}', 'group front {', '  node f0', '  node f1', '  node f2', '  node f3', '}');
    lines.push('f0 --> f2', 'f1 --> f2', 'f2 --> f3', 'e0 --> f0');
    for (let n = 0; n < 8; n++) lines.push(`e${n} --> f${n < 2 ? 1 : 2}`);
    for (let z = 0; z < 7; z++) {
      lines.push(`group z${z} {`);
      for (let n = 0; n < 5; n++) lines.push(`  node z${z}n${n}`);
      lines.push('}');
      for (let n = 1; n < 5; n++) lines.push(`z${z}n${n - 1} --> z${z}n${n}`);
      lines.push(z === 0 ? 'f2 --> z0n0' : `z${z - 1}n4 --> z${z}n0`);
      if (z > 1 && z < 6) lines.push(`z0n1 --> z${z}n4`);
    }
    const doc = parse(lines.join('\n')).document;
    const placed = computeLayout(doc);
    expect(placed).not.toEqual(computeColumnLayout(doc));
    for (const [start, size, clearance] of [
      ['x', 'width', 60],
      ['y', 'height', 34],
    ] as const) {
      const spans = Object.values(placed.groups)
        .map((r) => [r[start], r[start] + r[size]] as const)
        .sort((a, b) => a[0] - b[0]);
      let covered = (spans[0] as readonly [number, number])[1];
      for (const [from, to] of spans) {
        // Lining up edges and stations afterwards may open a little more than the clearance.
        expect(from - covered).toBeLessThan(clearance * 2);
        covered = Math.max(covered, to);
      }
    }
  });

  it('moves a part of the diagram past the zone in its way, into room that was empty', () => {
    // Twelve zones in a chain, each linked to the next and to the third after it. Moved only
    // straight towards the rest, the parts stop at the first zone they meet, and the zones
    // cover 37 % of the rectangle around them. Stepping past that zone, they cover 63 %.
    const lines = ['dav 1'];
    for (let z = 0; z < 12; z++) {
      lines.push(`group z${z} {`);
      for (let n = 0; n < 6; n++) lines.push(`  node z${z}n${n}`);
      lines.push('}');
      for (let n = 1; n < 6; n++) lines.push(`z${z}n${n - (n % 3 === 0 ? 2 : 1)} --> z${z}n${n}`);
      if (z > 0) lines.push(`z${z - 1}n5 --> z${z}n0`);
      if (z > 2) lines.push(`z${z - 3}n1 --> z${z}n5`);
    }
    const rects = Object.values(computeLayout(parse(lines.join('\n')).document).groups);
    const { width, height } = enclosingRect(rects);
    const covered = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(covered / (width * height)).toBeGreaterThan(0.5);
    // In shared columns the chain is a strip 40 times wider than high, which its zones cover
    // almost wholly: that is not what this is about.
    expect(width / height).toBeLessThan(5);
    rects.forEach((a, i) => {
      for (const b of rects.slice(i + 1)) expect(rectOverlaps(a, b)).toBe(false);
    });
  });

  it('puts the stations of linked zones level or straight above each other where it can', () => {
    const station = (id: string) => {
      const r = layout.nodes[id] as Rect;
      return { x: r.x + r.width / 2, y: r.y + STATION_CENTER };
    };
    const zoneOf = new Map(document.nodes.map((n) => [n.id, n.parentId]));
    const between = document.edges.filter((e) => zoneOf.get(e.from) !== zoneOf.get(e.to));
    const straight = between.filter((e) => {
      const a = station(e.from);
      const b = station(e.to);
      return Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5;
    });
    // Zones are rigid and most have several links, so only some of the 13 can be straight:
    // 5 are. Without the search's pull towards facing stations and the final move, 1 is;
    // with the final move alone, 3.
    expect(between).toHaveLength(13);
    expect(straight.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps shared columns when no link is too long', () => {
    const { document: compact } = parse(`dav 1
group a { node a1
node a2 }
group b { node b1
node b2 }
a1 --> a2
b1 --> b2`);
    const { nodes } = computeLayout(compact);
    expect(nodes.a1?.x).toBe(nodes.b1?.x);
    expect(nodes.a2?.x).toBe(nodes.b2?.x);
  });

  it('tries placing the zones freely where their short links cross in shared columns', () => {
    // Every node of one zone is linked to every node of the other: no link is long, but two
    // columns cannot hold that without crossings.
    const lines = [
      'dav 1',
      'group a { node a1',
      'node a2',
      'node a3 }',
      'group b { node b1',
      'node b2',
      'node b3 }',
    ];
    for (const from of ['a1', 'a2', 'a3'])
      for (const to of ['b1', 'b2', 'b3']) lines.push(`${from} --> ${to}`);
    const { document: crossed } = parse(lines.join('\n'));
    const columns = computeColumnLayout(crossed);
    expect(longLinkExcess(crossed, columns)).toBe(0);
    expect(countCrossings(crossed, columns)).toBeGreaterThan(0);
    adoptZonePlan('', undefined);
    expect(pendingZoneSearch(crossed)).toBeDefined();
  });

  it('finds seed by seed what the whole search finds', () => {
    // The seeds may run side by side, in any order, and must still come to the same answer.
    adoptZonePlan('', undefined);
    const search = pendingZoneSearch(document);
    if (!search) throw new Error('the diagram needs no search');
    const found = new Map(
      [...ZONE_SEARCH_SEEDS].reverse().map((seed) => [seed, searchZonesFrom(search.doc, seed)]),
    );
    const whole = searchZones(search.doc);
    expect(whole).toBeDefined();
    expect(pickSeedSearch(found)).toEqual(whole);
  });

  it('takes the earlier of two seeds that are as good, in whatever order they come back', () => {
    const [first, , , , , last] = ZONE_SEARCH_SEEDS as readonly [number, ...number[]];
    const at = (x: number) => new Map([['z0', { x, y: 0, flip: 0 as const }]]);
    const found = new Map([
      [last as number, { score: 1, placement: at(2) }],
      [first, { score: 1, placement: at(1) }],
    ]);
    expect(pickSeedSearch(found)).toEqual(at(1));
  });

  it('gives the same layout every time', () => {
    // Laying out another diagram first, so that this is computed again and not remembered.
    computeLayout(parse(bigDiagram(7)).document);
    expect(computeLayout(parse(bigDiagram()).document)).toEqual(layout);
  });

  it('places the zones the same whatever the steps, round trips between zones included', () => {
    // Long links between zones, travelled there and back: once, they counted double.
    const dsl = bigDiagram().replace(
      'step "Hop" {',
      'step "Round trips" {\n  animate z0n0 <-> z3n5\n  animate z0n0 <-> z5n5\n}\nstep "Hop" {',
    );
    const withSteps = parse(dsl).document;
    const withoutSteps = { ...withSteps, steps: [] };
    expect(structureKey(withSteps)).toBe(structureKey(withoutSteps));
    expect(searchZones(withSteps)).toEqual(searchZones(withoutSteps));
  });

  it('leaves out only the edges of loops inside a zone, since links between zones set no column', () => {
    // A loop inside z1, and one through z0, z1 and z2 that a link between zones closes.
    const dsl = bigDiagram().replace('step "Hop"', 'z1n4 --> z1n1\nz2n5 --> z0n3\nstep "Hop"');
    const doc = parse(dsl).document;
    // Placed freely: in columns, the frames would be others.
    expect(computeLayout(doc).groups).not.toEqual(computeColumnLayout(doc).groups);
    // Each zone is laid out on its own, from its own node declared first.
    expect(backEdgesOf(doc)).toEqual([
      { from: 'z1n4', to: 'z1n1', loop: ['z1n1', 'z1n2', 'z1n3', 'z1n4'], root: 'z1n0' },
    ]);
  });

  describe('edge labels', () => {
    const LONG = 'A label long enough to widen the gap between two columns';
    const labeled = (label: string) =>
      parse(`${bigDiagram().replace('z1n0 --> z1n1', `z1n0 --> z1n1 : "${label}"`)}`).document;

    it('leaves everything in place for a label that fits the gap', () => {
      expect(computeLayout(labeled('short'))).toEqual(layout);
    });

    it('moves zones aside for a label that widens its zone, without overlapping', () => {
      const widened = computeLayout(labeled(LONG));
      expect(widened.groups.z1?.width).toBeGreaterThan(layout.groups.z1?.width as number);
      const rects = Object.values(widened.groups);
      rects.forEach((a, i) => {
        for (const b of rects.slice(i + 1)) expect(rectOverlaps(a, b)).toBe(false);
      });
    });

    it('gives the same layout whether the label was typed or was already in the file', () => {
      computeLayout(document);
      const typed = computeLayout(labeled(LONG));
      computeLayout(parse(bigDiagram(7)).document);
      expect(computeLayout(labeled(LONG))).toEqual(typed);
    });
  });

  it('keeps nodes apart and inside their own zone', () => {
    const ids = Object.keys(layout.nodes);
    expect(ids).toHaveLength(document.nodes.length);
    ids.forEach((a, i) => {
      for (const b of ids.slice(i + 1)) {
        expect(rectOverlaps(layout.nodes[a] as Rect, layout.nodes[b] as Rect)).toBe(false);
      }
    });
    for (const n of document.nodes) {
      expect(
        rectContains(layout.groups[n.parentId as string] as Rect, layout.nodes[n.id] as Rect),
      ).toBe(true);
    }
  });

  it('never overlaps two zones', () => {
    const rects = Object.values(layout.groups);
    rects.forEach((a, i) => {
      for (const b of rects.slice(i + 1)) expect(rectOverlaps(a, b)).toBe(false);
    });
  });

  it('wraps nested groups and places zone-less nodes', () => {
    const source = `${bigDiagram()}
group outer "Outer" {
  group inner "Inner" {
    node deep "Deep"
  }
}
node loose "Loose"
z0n0 --> deep
deep --> loose`;
    const doc = parse(source).document;
    const result = computeLayout(doc);
    expect(rectContains(result.groups.inner as Rect, result.nodes.deep as Rect)).toBe(true);
    expect(rectContains(result.groups.outer as Rect, result.groups.inner as Rect)).toBe(true);
    expect(result.nodes.loose).toBeDefined();
    expect(result.groups.loose).toBeUndefined();
  });
});

describe('the zones of a large diagram', () => {
  // These diagrams take the moves the small ones never do: a node is put in a later column
  // than its edges give, towards its links to another zone, and a zone with groups in it is
  // turned upside down level by level.
  it.each(LARGE_DIAGRAMS)(
    '%s: keeps nodes apart, and every node and group inside its own',
    (_, dsl) => {
      const doc = parse(dsl).document;
      const layout = computeLayout(doc);
      const parentOfGroup = new Map(doc.groups.map((g) => [g.id, g.parentId]));
      const around = (id: string | undefined): string[] =>
        id === undefined ? [] : [id, ...around(parentOfGroup.get(id))];
      doc.nodes.forEach((a, i) => {
        const rect = layout.nodes[a.id] as Rect;
        for (const b of doc.nodes.slice(i + 1)) {
          expect(rectOverlaps(rect, layout.nodes[b.id] as Rect), `${a.id} on ${b.id}`).toBe(false);
        }
        const own = around(a.parentId);
        for (const g of doc.groups) {
          const zone = layout.groups[g.id] as Rect;
          if (own.includes(g.id)) expect(rectContains(zone, rect), `${a.id} in ${g.id}`).toBe(true);
          else expect(rectOverlaps(zone, rect), `${a.id} on ${g.id}`).toBe(false);
        }
      });
      for (const g of doc.groups) {
        const rect = layout.groups[g.id] as Rect;
        if (g.parentId) {
          expect(
            rectContains(layout.groups[g.parentId] as Rect, rect),
            `${g.id} in its group`,
          ).toBe(true);
        }
        for (const other of doc.groups) {
          if (
            other.id === g.id ||
            around(g.id).includes(other.id) ||
            around(other.id).includes(g.id)
          ) {
            continue;
          }
          expect(
            rectOverlaps(rect, layout.groups[other.id] as Rect),
            `${g.id} on ${other.id}`,
          ).toBe(false);
        }
      }
    },
  );

  it('moves no zone up, down or to the left for an edge label, however long', () => {
    // Zones were moved once more after a placement was applied, to put stations level again:
    // with the sizes the labels give, so that typing a label could shift a zone by tens of
    // units. A label may only widen its zone, which pushes the zones beside it to the right.
    const [, dsl] = LARGE_DIAGRAMS.find(([file]) => file.startsWith('09-')) ?? ['', ''];
    const doc = parse(dsl).document;
    const before = computeLayout(doc);
    const zones = doc.groups.filter((g) => !g.parentId).map((g) => g.id);
    doc.edges.forEach((edge, i) => {
      if (edge.from === edge.to) return;
      const edges = doc.edges.map((e, k) =>
        k === i ? { ...e, label: 'A label that is rather long to type in' } : e,
      );
      const after = computeLayout({ ...doc, edges });
      for (const zone of zones) {
        const was = before.groups[zone] as Rect;
        const is = after.groups[zone] as Rect;
        expect(is.y, `${zone} for the label of ${edge.from} to ${edge.to}`).toBe(was.y);
        expect(is.x, `${zone} for the label of ${edge.from} to ${edge.to}`).toBeGreaterThanOrEqual(
          was.x,
        );
      }
    });
  });
});
