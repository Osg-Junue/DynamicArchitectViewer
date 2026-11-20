import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { synthesizedConnections } from '../../model/connections';
import { pushToMap } from '../../model/text';
import { parentMap, zoneOfGroups } from '../../model/zones';
import { computeColumnLayout } from '../columns';
import { analyzeFlow, countCorridorIntrusions, flowPairKey, isLateAuxAlert } from '../flow';
import {
  adoptZonePlan,
  backEdgesOf,
  computeLayout,
  countCrossings,
  pendingZoneSearch,
  type Rect,
  rectContains,
  rectOverlaps,
  searchZones,
  zonesPlacedFreely,
} from '../index';
import { linksOf, primaryCrossingsOf } from '../links';
import { enclosingRect, STATION_CENTER } from '../metrics';
import { type Block, buildBlocks, type Placed, toLayout } from '../zoneBlocks';
import { longLinkExcess, structureKey } from '../zoned';
import { straighten, tighten } from '../zoneFinish';
import {
  buildZoneSlackMeta,
  deriveRefineBudget,
  nodeOrderOf,
  optimizeZoneFlips,
  optimizeZoneSlackRanks,
  polishZoneCoordinates,
  refineZoneNodeOrder,
} from '../zoneRefine';
import {
  buildFlowContext,
  buildLinks,
  countBackwardPrimary,
  createFastCrossingEvaluator,
  evaluateAnchoredObjective,
  evaluateArrangementScore,
  evaluateMove,
  extent,
  isClear,
  linkCost,
  refreshSegments,
} from '../zoneScore';

/** The larger diagrams of the scene's tests: five zones and over twenty nodes each. */
const FIXTURES = resolve(__dirname, '../../scene/__tests__/fixtures');
const LARGE_DIAGRAMS = readdirSync(FIXTURES)
  .sort()
  .map((file) => [file, readFileSync(resolve(FIXTURES, file), 'utf8')] as const);

/** Zones of `size` chained nodes in a row, with links from the first zone to all the others. */
function bigDiagram(size = 6, zones = 8): string {
  const lines: string[] = [];
  const initLinks: string[] = [];
  for (let z = 0; z < zones; z++) {
    lines.push(`group z${z} "Zone ${z}" {`);
    for (let n = 0; n < size; n++) lines.push(`  node z${z}n${n} "Node ${n}"`);
    lines.push('}');
    for (let n = 1; n < size; n++) initLinks.push(`  animate z${z}n${n - 1} --> z${z}n${n}`);
    if (z > 0) initLinks.push(`  animate z${z - 1}n${size - 1} <-> z${z}n0`);
    if (z > 1) initLinks.push(`  animate z0n0 --> z${z}n${size - 1}`);
  }
  lines.push('step "Init" {', ...initLinks, '}');
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
    // than high. Row-wrapping collapses the strip aspect below 5 while keeping crossings bounded.
    const doc = parse(bigDiagram(size, zones)).document;
    const placed = computeLayout(doc);
    const rects = Object.values(placed.groups);
    const { width, height } = enclosingRect(rects);
    expect(width / height).toBeLessThan(5);
    expect(countCrossings(doc, placed)).toBeLessThan(doc.nodes.length);
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
    const lines = ['group entrances {'];
    const links: string[] = [];
    for (let n = 0; n < 8; n++) lines.push(`  node e${n}`);
    lines.push('}', 'group front {', '  node f0', '  node f1', '  node f2', '  node f3', '}');
    links.push(
      '  animate f0 --> f2',
      '  animate f1 --> f2',
      '  animate f2 --> f3',
      '  animate e0 --> f0',
    );
    for (let n = 0; n < 8; n++) links.push(`  animate e${n} --> f${n < 2 ? 1 : 2}`);
    for (let z = 0; z < 7; z++) {
      lines.push(`group z${z} {`);
      for (let n = 0; n < 5; n++) lines.push(`  node z${z}n${n}`);
      lines.push('}');
      for (let n = 1; n < 5; n++) links.push(`  animate z${z}n${n - 1} --> z${z}n${n}`);
      links.push(z === 0 ? '  animate f2 --> z0n0' : `  animate z${z - 1}n4 --> z${z}n0`);
      if (z > 1 && z < 6) links.push(`  animate z0n1 --> z${z}n4`);
    }
    lines.push('step "Flow" {', ...links, '}');
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
    const lines: string[] = [];
    const links: string[] = [];
    for (let z = 0; z < 12; z++) {
      lines.push(`group z${z} {`);
      for (let n = 0; n < 6; n++) lines.push(`  node z${z}n${n}`);
      lines.push('}');
      for (let n = 1; n < 6; n++)
        links.push(`  animate z${z}n${n - (n % 3 === 0 ? 2 : 1)} --> z${z}n${n}`);
      if (z > 0) links.push(`  animate z${z - 1}n5 --> z${z}n0`);
      if (z > 2) links.push(`  animate z${z - 3}n1 --> z${z}n5`);
    }
    lines.push('step "Flow" {', ...links, '}');
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
    const between = synthesizedConnections(document).filter(
      (e) => zoneOf.get(e.from) !== zoneOf.get(e.to),
    );
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

  it('keeps shared columns for <= 1 top-level group and places >= 2 top-level groups freely', () => {
    const { document: singleTop } = parse(`group root {
  group a { node a1
  node a2 }
  group b { node b1
  node b2 }
}
step "S" {
  static a1 --> a2
  static b1 --> b2
}`);
    expect(zonesPlacedFreely(singleTop)).toBe(false);
    const { nodes } = computeLayout(singleTop);
    expect(nodes.a1?.x).toBe(nodes.b1?.x);
    expect(nodes.a2?.x).toBe(nodes.b2?.x);

    const { document: twoTop } = parse(`group a { node a1
node a2 }
group b { node b1
node b2 }
step "S" {
  static a1 --> a2
  static b1 --> b2
}`);
    expect(zonesPlacedFreely(twoTop)).toBe(true);
    expect(pendingZoneSearch(twoTop)).toBeDefined();
  });

  it('places >= 2 top-level zones freely even when short links cross in shared columns', () => {
    // Every node of one zone is linked to every node of the other: no link is long, but two
    // columns cannot hold that without crossings.
    const lines = [
      'group a { node a1',
      'node a2',
      'node a3 }',
      'group b { node b1',
      'node b2',
      'node b3 }',
      'step "S" {',
    ];
    for (const from of ['a1', 'a2', 'a3'])
      for (const to of ['b1', 'b2', 'b3']) lines.push(`  static ${from} --> ${to}`);
    lines.push('}');
    const { document: crossed } = parse(lines.join('\n'));
    const columns = computeColumnLayout(crossed);
    expect(longLinkExcess(crossed, columns)).toBe(0);
    expect(countCrossings(crossed, columns)).toBeGreaterThan(0);
    adoptZonePlan('', undefined);
    expect(pendingZoneSearch(crossed)).toBeDefined();
    expect(zonesPlacedFreely(crossed)).toBe(true);
  });

  it('gives the same layout every time', () => {
    // Laying out another diagram first, so that this is computed again and not remembered.
    computeLayout(parse(bigDiagram(7)).document);
    expect(computeLayout(parse(bigDiagram()).document)).toEqual(layout);
  });

  it('places the zones the same when adding descriptions, focus, states or existing-pair animations', () => {
    // Annotations and return/repeat animations on existing connections do not rearrange zones.
    const dsl = bigDiagram().replace(
      'step "Hop" {',
      'step "Round trips" {\n  desc "Reply"\n  state z0n0 [badge: "OK"]\n  animate z3n5 --> z0n0\n  animate z5n5 --> z0n0\n}\nstep "Hop" {',
    );
    const decorated = parse(dsl).document;
    const base = parse(bigDiagram()).document;
    expect(structureKey(decorated)).toBe(structureKey(base));
    expect(searchZones(decorated)).toEqual(searchZones(base));
  });

  it('leaves out only the edges of loops inside a zone, since links between zones set no column', () => {
    // A loop inside z1, and one through z0, z1 and z2 that a link between zones closes.
    const dsl = bigDiagram().replace(
      'step "Hop"',
      'step "Loops" {\n  static z1n4 --> z1n1\n  static z2n5 --> z0n3\n}\nstep "Hop"',
    );
    const doc = parse(dsl).document;
    // Placed freely: in columns, the frames would be others.
    expect(computeLayout(doc).groups).not.toEqual(computeColumnLayout(doc).groups);
    // Each zone is laid out on its own, from its own node declared first.
    expect(backEdgesOf(doc)).toEqual([
      { from: 'z1n4', to: 'z1n1', loop: ['z1n1', 'z1n2', 'z1n3', 'z1n4'], root: 'z1n0' },
    ]);

    // Animated cycle whose return node is declared first reports the return edge, never forward links.
    const animCycle = parse(
      'node c\nnode a\nnode b\nstep "S" {\n  animate a --> b\n  animate b --> c\n  animate c --> a\n}',
    ).document;
    adoptZonePlan('', undefined);
    const animLayout = computeLayout(animCycle);
    expect((animLayout.nodes.a as Rect).x).toBeLessThan((animLayout.nodes.b as Rect).x);
    expect((animLayout.nodes.b as Rect).x).toBeLessThan((animLayout.nodes.c as Rect).x);
    expect(backEdgesOf(animCycle)).toEqual([
      { from: 'c', to: 'a', loop: ['a', 'b', 'c'], root: 'a' },
    ]);
  });

  it('refreshes segments in tighten, keeps 3-block coupled straighten shifts coherent, and guards extent([])', () => {
    expect(extent([])).toEqual({ width: 0, height: 0 });

    const doc = parse(`
group g0 "G0" { node a0; node a1 }
group g1 "G1" { node b0; node b1 }
group g2 "G2" { node c0; node c1 }
group g3 "G3" { node d0 }
step "S" {
  animate d0 --> a0
  animate a0 --> b0
  static a1 --> c0
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const ctx = buildFlowContext(flow, owners, true);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const g0 = byId.get('g0');
    const g1 = byId.get('g1');
    const g2 = byId.get('g2');
    const g3 = byId.get('g3');
    if (!g0 || !g1 || !g2 || !g3) throw new Error('missing blocks');

    const placedT: Placed[] = [
      { block: g3, x: 0, y: 0, flip: 0 },
      { block: g0, x: 900, y: 0, flip: 0 },
      { block: g1, x: 1800, y: 0, flip: 0 },
      { block: g2, x: 900, y: 500, flip: 0 },
    ];
    const linksT = buildLinks(doc, placedT, flow);
    const widthBefore = extent(placedT).width;
    tighten(linksT, placedT, ctx);
    expect(extent(placedT).width).toBeLessThan(widthBefore - 500);

    const a0Y = g0.nodes.get('a0')?.y ?? 0;
    const d0Y = g3.nodes.get('d0')?.y ?? 0;
    const placedS: Placed[] = [
      { block: g3, x: 0, y: 16 + (a0Y - d0Y), flip: 0 },
      { block: g0, x: 320, y: 0, flip: 0 },
      { block: g1, x: 320 + g0.width + 80, y: 0, flip: 0 },
      { block: g2, x: 340, y: g0.height + 34, flip: 0 },
    ];
    const linksS = buildLinks(doc, placedS, flow);
    straighten(linksS, placedS, 300, ctx);
    expect(placedS[1]?.y).toBe(placedS[2]?.y);
    expect((placedS[3]?.y ?? 0) - ((placedS[1]?.y ?? 0) + g0.height)).toBeGreaterThanOrEqual(34);
  });

  describe('static labels', () => {
    const LONG = 'A label long enough to widen the gap between two columns';
    const labeled = (label: string) =>
      parse(
        bigDiagram().replace(
          'step "Hop"',
          `step "Static" {\n  static z1n0 --> z1n1 : "${label}"\n}\nstep "Hop"`,
        ),
      ).document;

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
step "Extra" {
  static z0n0 --> deep
  static deep --> loose
}`;
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

  it('moves no zone up, down or to the left for a static label, however long', () => {
    // Zones were moved once more after a placement was applied, to put stations level again:
    // with the sizes the labels give, so that typing a label could shift a zone by tens of
    // units. A label may only widen its zone, which pushes the zones beside it to the right.
    const [, dsl] = LARGE_DIAGRAMS.find(([file]) => file.startsWith('09-')) ?? ['', ''];
    const doc = parse(dsl).document;
    const before = computeLayout(doc);
    const zones = doc.groups.filter((g) => !g.parentId).map((g) => g.id);
    doc.steps.forEach((step, sIdx) => {
      step.statics.forEach((st, i) => {
        if (st.from === st.to) return;
        const steps = doc.steps.map((s, sk) =>
          sk === sIdx
            ? {
                ...s,
                statics: s.statics.map((item, k) =>
                  k === i ? { ...item, label: 'A label that is rather long to type in' } : item,
                ),
              }
            : s,
        );
        const after = computeLayout({ ...doc, steps });
        for (const zone of zones) {
          const was = before.groups[zone] as Rect;
          const is = after.groups[zone] as Rect;
          expect(is.y, `${zone} for the label of ${st.from} to ${st.to}`).toBe(was.y);
          expect(is.x, `${zone} for the label of ${st.from} to ${st.to}`).toBeGreaterThanOrEqual(
            was.x,
          );
        }
      });
    });
  });
});

describe('zoneScore and flow scoring unification (M1)', () => {
  it('classifies isLateAuxAlert at exact role, block, step, and stage boundaries', () => {
    const owners = new Map([
      ['a1', 'aux'],
      ['a2', 'aux'],
      ['p0', 'z0'],
      ['p1', 'z1'],
      ['x1', 'aux2'],
    ]);
    const flow = {
      auxiliaryZones: new Set(['aux', 'aux2']),
      pairFirstStep: new Map([
        [flowPairKey('a1', 'p0'), 2],
        [flowPairKey('a1', 'p1'), 2],
        [flowPairKey('a2', 'p0'), 1],
        [flowPairKey('a1', 'x1'), 3],
        [flowPairKey('a1', 'a2'), 2],
      ]),
      zoneStage: new Map([
        ['z0', 0],
        ['aux', 1],
        ['z1', 2],
        ['aux2', 1],
      ]),
    };

    // Positive: primary, distinct blocks, aux -> non-aux, firstStep >= 2, stage(aux) >= stage(target)
    expect(isLateAuxAlert({ from: 'a1', to: 'p0', role: 'primary' }, flow, owners)).toBe(true);
    expect(
      isLateAuxAlert(
        { from: 'a1', to: 'p0', role: 'primary' },
        { ...flow, zoneStage: new Map([...flow.zoneStage, ['aux', 0]]) },
        owners,
      ),
    ).toBe(true);

    // Negative boundaries
    expect(isLateAuxAlert({ from: 'a1', to: 'p0', role: 'return' }, flow, owners)).toBe(false);
    expect(isLateAuxAlert({ from: 'a1', to: 'p0', role: 'static' }, flow, owners)).toBe(false);
    expect(isLateAuxAlert({ from: 'a1', to: 'a2', role: 'primary' }, flow, owners)).toBe(false);
    expect(isLateAuxAlert({ from: 'a2', to: 'p0', role: 'primary' }, flow, owners)).toBe(false);
    expect(isLateAuxAlert({ from: 'p0', to: 'a1', role: 'primary' }, flow, owners)).toBe(false);
    expect(isLateAuxAlert({ from: 'a1', to: 'x1', role: 'primary' }, flow, owners)).toBe(false);
    expect(isLateAuxAlert({ from: 'a1', to: 'p1', role: 'primary' }, flow, owners)).toBe(false);
  });

  it('suppresses cross-row backward, stageOverlap, and corridor penalties only when wrapped is true', () => {
    const doc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group z3 "Z3" { node n3 }
step "S" {
  animate n0 --> n1
  animate n1 --> n2
  animate n0 --> n3
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const b0 = byId.get('z0');
    const b1 = byId.get('z1');
    const b2 = byId.get('z2');
    const b3 = byId.get('z3');
    if (!b0 || !b1 || !b2 || !b3) throw new Error('missing blocks');

    const rowOfBlock = new Map([
      ['z0', 0],
      ['z1', 0],
      ['z2', 1],
      ['z3', 1],
    ]);
    const ctxDefault = buildFlowContext(flow, owners, true);
    const ctxExplicitFalse = buildFlowContext(flow, owners, true, false, rowOfBlock);
    const ctxWrapped = buildFlowContext(flow, owners, true, true, rowOfBlock);

    expect(ctxDefault.wrapped).toBe(false);
    expect(ctxWrapped.wrapped).toBe(true);

    // z0 -> z1 on row 0 is forward; z1 -> z2 wraps from right of row 0 to left of row 1.
    const placed: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: b1, x: 400, y: 0, flip: 0 },
      { block: b2, x: 0, y: 240, flip: 0 },
      { block: b3, x: 200, y: 80, flip: 0 },
    ];
    const links = buildLinks(doc, placed, flow);
    refreshSegments(links);

    expect(countBackwardPrimary(links, ctxDefault)).toBe(1);
    expect(countBackwardPrimary(links, ctxWrapped)).toBe(0);

    const costDefault = linkCost(links, placed, ctxDefault);
    const costExplicitFalse = linkCost(links, placed, ctxExplicitFalse);
    const costWrapped = linkCost(links, placed, ctxWrapped);
    expect(costExplicitFalse).toBe(costDefault);
    expect(costDefault - costWrapped).toBeGreaterThan(4000);

    const fullDefault = evaluateArrangementScore(doc, placed, links, flow, ctxDefault, {
      mode: 'full',
    });
    const fullWrapped = evaluateArrangementScore(doc, placed, links, flow, ctxWrapped, {
      mode: 'full',
    });
    expect(fullDefault - fullWrapped).toBeGreaterThan(10000);

    // evaluateMove preserves same-row penalties while suppressing cross-row penalties when wrapped.
    const targetP = placed[2] as Placed;
    const origX = targetP.x;
    const moveWrapped = evaluateMove(
      links,
      placed,
      targetP,
      -100,
      240,
      0,
      undefined,
      0,
      0,
      0,
      ctxWrapped,
    );
    targetP.x = origX;
    refreshSegments(links);
    const moveDefault = evaluateMove(
      links,
      placed,
      targetP,
      -100,
      240,
      0,
      undefined,
      0,
      0,
      0,
      ctxDefault,
    );
    expect(moveDefault - moveWrapped).toBeGreaterThan(300);
    targetP.x = origX;
    refreshSegments(links);

    // Same-row backward edge (z0 right of z1 on row 0) is still penalized even when wrapped.
    if (placed[0] && placed[1]) {
      placed[0].x = 400;
      placed[1].x = 0;
    }
    refreshSegments(links);
    expect(countBackwardPrimary(links, ctxWrapped)).toBe(1);

    // countCorridorIntrusions skips cross-row corridors and cross-row intruders, keeps same-row.
    const rectMap = new Map(
      placed.map((p) => [
        p.block.id,
        { x: p.x, y: p.y, width: p.block.width, height: p.block.height },
      ]),
    );
    rectMap.set('z3', { x: 200, y: 0, width: b3.width, height: b3.height });
    const corridors = [
      { a: 'z0', b: 'z1', allowed: new Set<string>() },
      { a: 'z0', b: 'z2', allowed: new Set<string>() },
    ];
    expect(countCorridorIntrusions(corridors, rectMap)).toBe(2);
    expect(countCorridorIntrusions(corridors, rectMap, rowOfBlock)).toBe(0);
    expect(
      countCorridorIntrusions(
        corridors,
        rectMap,
        new Map([
          ['z0', 0],
          ['z1', 0],
          ['z2', 1],
          ['z3', 0],
        ]),
      ),
    ).toBe(1);
  });

  it('evaluates crossings and objectives consistently across evaluateArrangementScore and FastCrossingEvaluator', () => {
    const doc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group z3 "Z3" { node n3 }
step "S" {
  animate n0 --> n2
  animate n1 --> n3
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const b0 = byId.get('z0');
    const b1 = byId.get('z1');
    const b2 = byId.get('z2');
    const b3 = byId.get('z3');
    if (!b0 || !b1 || !b2 || !b3) throw new Error('missing blocks');

    const ctx = buildFlowContext(flow, owners, true);
    const docLinks = linksOf(doc);

    const uncrossed: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: b1, x: 0, y: 200, flip: 0 },
      { block: b2, x: 300, y: 0, flip: 0 },
      { block: b3, x: 300, y: 200, flip: 0 },
    ];
    const crossed: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: b1, x: 0, y: 200, flip: 0 },
      { block: b2, x: 300, y: 200, flip: 0 },
      { block: b3, x: 300, y: 0, flip: 0 },
    ];

    const uLinks = buildLinks(doc, uncrossed, flow);
    const cLinks = buildLinks(doc, crossed, flow);
    refreshSegments(uLinks);
    refreshSegments(cLinks);

    const evalU = createFastCrossingEvaluator(uncrossed, docLinks, flow);
    const evalC = createFastCrossingEvaluator(crossed, docLinks, flow);
    expect(evalU.syncAndCountCrossings(uncrossed)).toEqual({ totalCross: 0, priCross: 0 });
    expect(evalC.syncAndCountCrossings(crossed)).toEqual({ totalCross: 1, priCross: 1 });

    const objU = evaluateAnchoredObjective(evalU, uncrossed, uLinks, ctx, 0);
    const objC = evaluateAnchoredObjective(evalC, crossed, cLinks, ctx, 0);
    const objBack = evaluateAnchoredObjective(evalU, uncrossed, uLinks, ctx, 1);
    expect(objC).toBeGreaterThan(objU + 1000);
    expect(objBack - objU).toBeCloseTo(8000, 6);

    for (const mode of ['flip', 'staged', 'intrusion', 'full'] as const) {
      const scoreU = evaluateArrangementScore(doc, uncrossed, uLinks, flow, ctx, { mode });
      const scoreC = evaluateArrangementScore(doc, crossed, cLinks, flow, ctx, { mode });
      expect(Number.isFinite(scoreU)).toBe(true);
      expect(scoreC).toBeGreaterThan(scoreU);
    }
  });

  it('refreshes link segments at entry of evaluateArrangementScore so full mode is idempotent on fresh links and post-move mutations', () => {
    const doc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group z3 "Z3" { node n3 }
step "S" {
  animate n0 --> n1
  animate n1 --> n2
  animate n0 --> n2
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const ctx = buildFlowContext(flow, owners, true);

    const placed: Placed[] = [
      { block: byId.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: byId.get('z1') as Block, x: 300, y: 0, flip: 0 },
      { block: byId.get('z2') as Block, x: 600, y: 0, flip: 0 },
      { block: byId.get('z3') as Block, x: 300, y: 120, flip: 0 },
    ];
    const links = buildLinks(doc, placed, flow);

    const firstFresh = evaluateArrangementScore(doc, placed, links, flow, ctx, { mode: 'full' });
    const secondFresh = evaluateArrangementScore(doc, placed, links, flow, ctx, { mode: 'full' });
    const expectedFreshLinks = buildLinks(doc, placed, flow);
    refreshSegments(expectedFreshLinks);
    const expectedFresh = evaluateArrangementScore(doc, placed, expectedFreshLinks, flow, ctx, {
      mode: 'full',
    });
    expect(Number.isFinite(firstFresh)).toBe(true);
    expect(firstFresh).toBe(secondFresh);
    expect(firstFresh).toBe(expectedFresh);

    // Mutate block position without manually calling refreshSegments(links).
    (placed[1] as Placed).y = 250;
    const firstMoved = evaluateArrangementScore(doc, placed, links, flow, ctx, { mode: 'full' });
    const secondMoved = evaluateArrangementScore(doc, placed, links, flow, ctx, { mode: 'full' });
    const expectedMovedLinks = buildLinks(doc, placed, flow);
    refreshSegments(expectedMovedLinks);
    const expectedMoved = evaluateArrangementScore(doc, placed, expectedMovedLinks, flow, ctx, {
      mode: 'full',
    });
    expect(Number.isFinite(firstMoved)).toBe(true);
    expect(firstMoved).toBe(secondMoved);
    expect(firstMoved).toBe(expectedMoved);
    expect(firstMoved).not.toBe(firstFresh);
  });
});

describe('zoneRefine intra-zone refinement & flip safety (M2)', () => {
  it('optimizes zone flips via bitmask, entryMask penalty, tie preservation, and greedy fallback', () => {
    const doc = parse(`
group z0 "Z0" { node a0; node a1 }
group z1 "Z1" { node b0; node b1 }
group z2 "Z2" { node c0; node c1 }
step "S" {
  animate a0 --> b0
  animate a1 --> b1
  animate b0 --> c0
  animate b1 --> c1
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const b0 = byId.get('z0') as Block;
    const b1 = byId.get('z1') as Block;
    const b2 = byId.get('z2') as Block;
    const ctx = buildFlowContext(flow, owners, true);

    // Reverse z1 relative to z0 and z2 by setting z0/z2 flipped or building reversed nodes:
    // Start with z1 flipped=1 while z0/z2 are unflipped -> b0/b1 swapped relative to a/c, creating crossings.
    const placedExact: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: b1, x: 300, y: 0, flip: 1 },
      { block: b2, x: 600, y: 0, flip: 0 },
    ];
    const linksExact = buildLinks(doc, placedExact, flow);
    refreshSegments(linksExact);
    expect(countCrossings(doc, toLayout(placedExact))).toBeGreaterThan(0);

    const changed = optimizeZoneFlips(
      { doc, placed: placedExact, links: linksExact, flow, flowCtx: ctx, fallback: 'none' },
      5,
    );
    expect(changed).toBe(true);
    expect(countCrossings(doc, toLayout(placedExact))).toBe(0);

    // Tie preservation: if all blocks are already aligned with flip=1 (symmetric 0 crossings),
    // optimizeZoneFlips preserves flip=1 instead of flipping back to 0 on tie.
    for (const p of placedExact) p.flip = 1;
    refreshSegments(linksExact);
    expect(countCrossings(doc, toLayout(placedExact))).toBe(0);
    const tieChanged = optimizeZoneFlips(
      { doc, placed: placedExact, links: linksExact, flow, flowCtx: ctx, fallback: 'none' },
      5,
    );
    expect(tieChanged).toBe(false);
    expect(placedExact.every((p) => p.flip === 1)).toBe(true);

    // entryMask (+120) prevents flipping z0 when its uncrossed flip benefit is smaller than +120.
    const entryDoc = parse(`
group z0 "Z0" { node a0; node a1 }
group z1 "Z1" { node b0 }
step "E" {
  animate a1 --> b0
}
`).document;
    const eFlow = analyzeFlow(entryDoc);
    const eBuilt = buildBlocks(entryDoc, computeColumnLayout, undefined, eFlow);
    const eMap = new Map(eBuilt.blocks.map((b) => [b.id, b]));
    const ePlaced: Placed[] = [
      { block: eMap.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: eMap.get('z1') as Block, x: 300, y: 120, flip: 0 },
    ];
    const eLinks = buildLinks(entryDoc, ePlaced, eFlow);
    refreshSegments(eLinks);
    const eCtx = buildFlowContext(eFlow, eBuilt.owners, true);
    const entryMask = new Uint8Array([1, 0]);
    optimizeZoneFlips(
      {
        doc: entryDoc,
        placed: ePlaced,
        links: eLinks,
        flow: eFlow,
        flowCtx: eCtx,
        fallback: 'none',
      },
      5,
      entryMask,
    );
    expect(ePlaced[0]?.flip).toBe(0);

    // Greedy fallback when targets.length > budgetCap (budgetCap = 1 < 3 targets).
    const placedGreedy: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: b1, x: 300, y: 0, flip: 1 },
      { block: b2, x: 600, y: 0, flip: 0 },
    ];
    const linksGreedy = buildLinks(doc, placedGreedy, flow);
    refreshSegments(linksGreedy);
    const beforeGreedyCross = countCrossings(doc, toLayout(placedGreedy));
    const greedyChanged = optimizeZoneFlips(
      {
        doc,
        placed: placedGreedy,
        links: linksGreedy,
        flow,
        flowCtx: ctx,
        fallback: 'score-greedy',
      },
      1,
    );
    expect(greedyChanged).toBe(true);
    expect(countCrossings(doc, toLayout(placedGreedy))).toBeLessThan(beforeGreedyCross);

    // Greedy fallback for non-flippable multi-row blocks (`flippable: false`).
    const nonFlipB1: Block = { ...b1, flippable: false };
    const placedNonFlip: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: nonFlipB1, x: 300, y: 0, flip: 1 },
      { block: b2, x: 600, y: 0, flip: 0 },
    ];
    const linksNonFlip = buildLinks(doc, placedNonFlip, flow);
    refreshSegments(linksNonFlip);
    const nonFlipChanged = optimizeZoneFlips(
      {
        doc,
        placed: placedNonFlip,
        links: linksNonFlip,
        flow,
        flowCtx: ctx,
        flippability: 'unflippable',
        fallback: 'score-greedy',
      },
      0,
    );
    expect(nonFlipChanged).toBe(true);
    expect(placedNonFlip[1]?.flip).toBe(0);
    expect(countCrossings(doc, toLayout(placedNonFlip))).toBe(0);
  });

  it('selects the global minimum bitmask regardless of mask index order under hysteresis', () => {
    const doc = parse(`
group z0 "Z0" { node a0; node a1; node a2 }
group z1 "Z1" { node b0; node b1 }
group z2 "Z2" { node c0; node c1 }
step "S" {
  animate a0 --> c0
  animate a1 --> c1
  animate b0 --> c1
  animate b1 --> c0
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const b0 = byId.get('z0') as Block;
    const b1 = byId.get('z1') as Block;
    const b2 = byId.get('z2') as Block;
    const ctx = buildFlowContext(flow, owners, true);

    const placed: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: b1, x: 0, y: 200, flip: 0 },
      { block: b2, x: 300, y: 12.8, flip: 0 },
    ];
    const links = buildLinks(doc, placed, flow);
    refreshSegments(links);

    // Evaluate mask=2 (0,1,0) vs mask=5 (1,0,1) directly to verify mask=5 is strictly lower
    // by < 1 unit while both beat mask=0 (0,0,0) by > 1 unit.
    const scoreOf = (flips: readonly [0 | 1, 0 | 1, 0 | 1]) => {
      flips.forEach((f, i) => {
        const p = placed[i];
        if (p) p.flip = f;
      });
      refreshSegments(links);
      return evaluateArrangementScore(doc, placed, links, flow, ctx, { mode: 'flip' });
    };
    const s0 = scoreOf([0, 0, 0]);
    const s2 = scoreOf([0, 1, 0]);
    const s5 = scoreOf([1, 0, 1]);
    expect(s2).toBeLessThan(s0 - 1);
    expect(s5).toBeLessThan(s2);
    expect(s2 - s5).toBeLessThan(1);

    // Reset to mask=0 and run optimizeZoneFlips: must choose global minimum mask=5 (flip = 1, 0, 1).
    for (const p of placed) p.flip = 0;
    refreshSegments(links);
    const changed = optimizeZoneFlips(
      { doc, placed, links, flow, flowCtx: ctx, fallback: 'none' },
      5,
    );
    expect(changed).toBe(true);
    expect(placed.map((p) => p.flip)).toEqual([1, 0, 1]);
  });

  it('evaluates nested-group flips without stale FastCrossingEvaluator intra-cache', () => {
    const doc = parse(`
group outer "Outer" {
  node o0 "O0"
  node o1 "O1"
  group inner "Inner" {
    node i0 "I0"
    node i1 "I1"
  }
}
group ext "Ext" {
  node e0 "E0"
  node e1 "E1"
}
step "S" {
  animate o0 --> i1
  animate o1 --> i0
  animate i0 --> e0
  animate i1 --> e1
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const outer = byId.get('outer') as Block;
    const ext = byId.get('ext') as Block;
    expect(outer.groups.size).toBeGreaterThan(1);

    const placed: Placed[] = [
      { block: outer, x: 0, y: 0, flip: 0 },
      { block: ext, x: 480, y: 0, flip: 0 },
    ];
    const docLinks = linksOf(doc);
    const fastEval = createFastCrossingEvaluator(placed, docLinks, flow);

    // Verify FastCrossingEvaluator matches exact countCrossings/primaryCrossingsOf both before and after flip.
    for (const flipVal of [0, 1] as const) {
      placed[0] = { block: outer, x: 0, y: 0, flip: flipVal };
      const layout = toLayout(placed);
      expect(fastEval.syncAndCountCrossings(placed)).toEqual({
        totalCross: countCrossings(doc, layout),
        priCross: primaryCrossingsOf(flow.connections, layout),
      });
    }

    // Verify optimizeZoneFlips on the nested block matches fresh evaluateArrangementScore.
    const ctx = buildFlowContext(flow, owners, true);
    const links = buildLinks(doc, placed, flow);
    refreshSegments(links);
    optimizeZoneFlips(
      {
        doc,
        placed,
        links,
        flow,
        flowCtx: ctx,
        flippability: 'unflippable',
        fallback: 'score-greedy',
      },
      0,
    );
    const finalScore = evaluateArrangementScore(doc, placed, links, flow, ctx, { mode: 'flip' });
    const freshLinks = buildLinks(doc, placed, flow);
    refreshSegments(freshLinks);
    expect(finalScore).toBe(
      evaluateArrangementScore(doc, placed, freshLinks, flow, ctx, { mode: 'flip' }),
    );
  });

  it('polishes coordinates monotonically with RefineBudget and honors zero-pass no-op', () => {
    const doc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group z3 "Z3" { node n3 }
step "S" {
  animate n0 --> n2
  animate n1 --> n3
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const ctx = buildFlowContext(flow, owners, true);
    const docLinks = linksOf(doc);

    const makePlaced = (): Placed[] => [
      { block: byId.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: byId.get('z1') as Block, x: 0, y: 200, flip: 0 },
      { block: byId.get('z2') as Block, x: 300, y: 128, flip: 0 },
      { block: byId.get('z3') as Block, x: 300, y: 328, flip: 0 },
    ];

    const noopPlaced = makePlaced();
    const noopLinks = buildLinks(doc, noopPlaced, flow);
    refreshSegments(noopLinks);
    const noopChanged = polishZoneCoordinates(noopPlaced, noopLinks, docLinks, flow, ctx, {
      polishSteps: [],
      polishPasses: 0,
    });
    expect(noopChanged).toBe(false);
    expect(noopPlaced.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [0, 200],
      [300, 128],
      [300, 328],
    ]);

    const activePlaced = makePlaced();
    const activeLinks = buildLinks(doc, activePlaced, flow);
    refreshSegments(activeLinks);
    const evalBefore = createFastCrossingEvaluator(activePlaced, docLinks, flow);
    const backBefore = countBackwardPrimary(activeLinks, ctx);
    const objBefore = evaluateAnchoredObjective(
      evalBefore,
      activePlaced,
      activeLinks,
      ctx,
      backBefore,
    );

    const activeChanged = polishZoneCoordinates(activePlaced, activeLinks, docLinks, flow, ctx, {
      polishSteps: [64, 32, 16],
      polishPasses: 2,
    });
    expect(activeChanged).toBe(true);
    const evalAfter = createFastCrossingEvaluator(activePlaced, docLinks, flow);
    const backAfter = countBackwardPrimary(activeLinks, ctx);
    const objAfter = evaluateAnchoredObjective(
      evalAfter,
      activePlaced,
      activeLinks,
      ctx,
      backAfter,
    );
    expect(backAfter).toBeLessThanOrEqual(backBefore);
    expect(objAfter).toBeLessThan(objBefore);
    for (const p of activePlaced) {
      expect(isClear(p, activePlaced)).toBe(true);
    }
  });

  it('optimizes intra-zone slack ranks and node order without threshold discontinuities', () => {
    const slackDoc = parse(`
group z0 "Z0" {
  node a "A"
  node b "B"
  node c "C"
  node s "Slack"
}
group z1 "Z1" {
  node t "T"
}
step "S" {
  animate a --> b
  animate b --> c
  animate a --> s
  animate s --> t
  animate c --> t
}
`).document;
    const sFlow = analyzeFlow(slackDoc);
    const sBuilt = buildBlocks(slackDoc, computeColumnLayout, undefined, sFlow);
    const sMap = new Map(sBuilt.blocks.map((b) => [b.id, b]));
    const sPlaced: Placed[] = [
      { block: sMap.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: sMap.get('z1') as Block, x: 1000, y: 0, flip: 0 },
    ];
    const sAdj = new Map<string, string[]>();
    for (const e of synthesizedConnections(slackDoc)) {
      if (e.from === e.to) continue;
      pushToMap(sAdj, e.from, e.to);
      pushToMap(sAdj, e.to, e.from);
    }
    const slackMeta = buildZoneSlackMeta(
      slackDoc,
      synthesizedConnections(slackDoc),
      sBuilt.blocks,
      sFlow,
      sBuilt.owners,
      sAdj,
    );
    expect(slackMeta.has('z0')).toBe(true);
    const baseOrders = new Map(sBuilt.blocks.map((b) => [b.id, nodeOrderOf(b.nodes)]));
    const blockCache = new Map<string, Block>();
    const sCtx = buildFlowContext(sFlow, sBuilt.owners, true);
    const zoneOf = zoneOfGroups(slackDoc.groups);
    const nParent = parentMap(slackDoc.nodes);

    const skipped = optimizeZoneSlackRanks(
      slackDoc,
      computeColumnLayout,
      sPlaced,
      sBuilt.owners,
      zoneOf,
      nParent,
      sAdj,
      new Map(baseOrders),
      slackMeta,
      blockCache,
      sFlow,
      sCtx,
      { slackRanks: false },
    );
    expect(skipped.size).toBe(0);

    const chosen = optimizeZoneSlackRanks(
      slackDoc,
      computeColumnLayout,
      sPlaced,
      sBuilt.owners,
      zoneOf,
      nParent,
      sAdj,
      baseOrders,
      slackMeta,
      blockCache,
      sFlow,
      sCtx,
      { slackRanks: true },
    );
    expect(chosen.get('z0')).toEqual({ s: 2 });
    expect(isClear(sPlaced[0] as Placed, sPlaced)).toBe(true);

    // refineZoneNodeOrder uncrosses inter-zone links inside a zone column and honors orderSweeps=0.
    const orderDoc = parse(`
group z0 "Z0" { node a; node b }
group z1 "Z1" { node c; node d }
step "S" {
  animate a --> d
  animate b --> c
}
`).document;
    const oFlow = analyzeFlow(orderDoc);
    const oBuilt = buildBlocks(orderDoc, computeColumnLayout, undefined, oFlow);
    const oMap = new Map(oBuilt.blocks.map((b) => [b.id, b]));
    const oPlaced: Placed[] = [
      { block: oMap.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: oMap.get('z1') as Block, x: 300, y: 0, flip: 0 },
    ];
    const oAdj = new Map<string, string[]>();
    for (const e of synthesizedConnections(orderDoc)) {
      pushToMap(oAdj, e.from, e.to);
      pushToMap(oAdj, e.to, e.from);
    }
    const oLinks = linksOf(orderDoc);
    expect(countCrossings(orderDoc, toLayout(oPlaced))).toBe(1);
    expect(
      refineZoneNodeOrder(
        oPlaced,
        parentMap(orderDoc.nodes),
        oBuilt.owners,
        oAdj,
        oLinks,
        { orderSweeps: 0, verticalSwapPasses: 0, coupledSwapPasses: 0 },
        oFlow,
      ),
    ).toBe(false);
    expect(
      refineZoneNodeOrder(
        oPlaced,
        parentMap(orderDoc.nodes),
        oBuilt.owners,
        oAdj,
        oLinks,
        deriveRefineBudget(2, 4, true),
        oFlow,
      ),
    ).toBe(true);
    expect(countCrossings(orderDoc, toLayout(oPlaced))).toBe(0);

    // deriveRefineBudget has no regime cliff at 14->15 zones or 35->36 nodes.
    expect(deriveRefineBudget(14, 35, true)).toEqual(deriveRefineBudget(15, 36, true));
  });

  it('symmetrically skips cross-row corridor intruders when only one corridor endpoint has a row assignment', () => {
    const doc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group z3 "Z3" { node n3 }
step "S" {
  animate n0 --> n1
  animate n1 --> n2
  animate n0 --> n3
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const placed: Placed[] = [
      { block: byId.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: byId.get('z1') as Block, x: 400, y: 0, flip: 0 },
      { block: byId.get('z2') as Block, x: 800, y: 0, flip: 0 },
      { block: byId.get('z3') as Block, x: 200, y: 0, flip: 0 },
    ];
    const links = buildLinks(doc, placed, flow);
    refreshSegments(links);

    // Only z1 (rb) and z3 (intruder rc) have rows, while z0 (ra) is unmapped -> still recognized as cross-row.
    const ctxAsymmetric = buildFlowContext(
      flow,
      owners,
      true,
      true,
      new Map([
        ['z1', 0],
        ['z3', 1],
      ]),
    );
    const ctxSameRow = buildFlowContext(
      flow,
      owners,
      true,
      true,
      new Map([
        ['z0', 0],
        ['z1', 0],
        ['z3', 0],
      ]),
    );
    expect(
      linkCost(links, placed, ctxSameRow) - linkCost(links, placed, ctxAsymmetric),
    ).toBeGreaterThanOrEqual(1200);
  });
});
