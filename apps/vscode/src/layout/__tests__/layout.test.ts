import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { SAMPLE_TEMPLATES } from '../../samples';
import {
  backEdgesOf,
  computeLayout,
  countCrossings,
  NODE_SIZE,
  type Rect,
  rectContains,
  rectOverlaps,
} from '../index';

describe('edge label spacing', () => {
  const gapFor = (label: string) => {
    const { nodes } = computeLayout(
      parse(`node a\nnode b\nstep "S" {\n  static a --> b : "${label}"\n}`).document,
    );
    return (nodes.b?.x ?? 0) - ((nodes.a?.x ?? 0) + NODE_SIZE.width);
  };

  it('widens the column gap so a long label fits between its nodes', () => {
    expect(gapFor('HTTPS / Polling, then WebSocket')).toBeGreaterThan(gapFor('x'));
  });

  it('keeps the base gap for short labels', () => {
    expect(gapFor('x')).toBe(gapFor('y'));
  });
});

describe('column gaps around nested groups', () => {
  const nested = (depth: number) => {
    const open = Array.from({ length: depth }, (_, i) => `group g${i} {`).join('\n');
    const close = '}\n'.repeat(depth);
    return computeLayout(
      parse(
        `node a\nnode b\nnode c\n${open}\nnode d\n${close}\nstep "S" {\n  static a --> b\n  static b --> c\n  static c --> d\n}`,
      ).document,
    );
  };
  const gap = (depth: number, from: string, to: string) => {
    const { nodes } = nested(depth);
    return (nodes[to]?.x ?? 0) - (nodes[from]?.x ?? 0);
  };

  it('adds nothing between columns that no frame edge separates', () => {
    expect(gap(3, 'a', 'b')).toBe(NODE_SIZE.width + 36);
  });

  it('makes room for a frame edge, however deep the nesting', () => {
    expect(gap(1, 'c', 'd')).toBe(NODE_SIZE.width + 36 + 16);
    expect(gap(5, 'c', 'd')).toBe(gap(1, 'c', 'd'));
  });

  it('shares the padding between frames nested along one edge', () => {
    const { nodes, groups } = nested(4);
    const left = (nodes.d?.x ?? 0) - (groups.g0?.x ?? 0);
    expect(left).toBeCloseTo(16);
    expect((groups.g3?.x ?? 0) - (groups.g0?.x ?? 0)).toBeCloseTo(12);
  });
});

const layoutOf = (dsl: string) => {
  const { document } = parse(dsl);
  return { document, layout: computeLayout(document) };
};

describe('crossing reduction', () => {
  const EXAMPLES = resolve(__dirname, '../../../../../examples');
  /** Upper bounds, so that a change to the layout cannot add crossings to a sample unnoticed. */
  const CROSSING_BUDGET: Record<string, number> = {
    'infra-ha-failover': 0,
    'screen-flow-checkout': 0,
    'event-driven-async': 1,
    'enterprise-zero-trust-10anim': 0,
    'sequence-payment-retry': 0,
    'lan-office-network': 0,
    'dynamic-architect-viewer': 0,
    '01-infra-ha-failover.dav': 0,
    '02-screen-flow-checkout.dav': 0,
    '03-event-driven-async.dav': 1,
    '04-enterprise-zero-trust-payment.dav': 0,
    '05-sequence-payment-retry.dav': 0,
    '06-lan-office-network.dav': 0,
    '07-dynamic-architect-viewer.dav': 0,
  };
  const diagrams = [
    ...SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const),
    ...readdirSync(EXAMPLES).map((f) => [f, readFileSync(resolve(EXAMPLES, f), 'utf8')] as const),
  ];

  it('has a budget for every diagram', () => {
    expect(diagrams.map(([id]) => id).sort()).toEqual(Object.keys(CROSSING_BUDGET).sort());
  });

  it.each(diagrams)('%s: stays within its crossing budget', (id, dsl) => {
    const { document, layout } = layoutOf(dsl);
    expect(countCrossings(document, layout)).toBeLessThanOrEqual(CROSSING_BUDGET[id] as number);
  });

  it.each(diagrams)('%s: is deterministic', (_, dsl) => {
    const { document } = parse(dsl);
    expect(computeLayout(document)).toEqual(computeLayout(document));
  });

  it('counts only proper crossings, not rails that share a station', () => {
    const fan = layoutOf(
      'node a\nnode b\nnode c\nstep "S" {\n  static a --> b\n  static a --> c\n}',
    );
    expect(countCrossings(fan.document, fan.layout)).toBe(0);
  });

  it('reorders stacked groups to remove a crossing', () => {
    const { document, layout } = layoutOf(`node top
node bottom
group first {
  node r1
}
group second {
  node r2
}
step "S" {
  static top --> r2
  static bottom --> r1
}`);
    expect(countCrossings(document, layout)).toBe(0);
  });

  it('keeps connected rows on one line', () => {
    const { layout } = layoutOf(
      'node a\nnode b\nnode c\nnode d\nstep "S" {\n  static a --> b\n  static c --> d\n}',
    );
    expect(layout.nodes.a?.y).toBe(layout.nodes.b?.y);
    expect(layout.nodes.c?.y).toBe(layout.nodes.d?.y);
  });
});

describe('layout', () => {
  it('gives every node the same size, whatever its icon', () => {
    const { layout } = layoutOf('node a\nnode s [icon: modal]\nstep "S" {}');
    expect(layout.nodes.a).toMatchObject(NODE_SIZE);
    expect(layout.nodes.s).toMatchObject(NODE_SIZE);
  });

  it('ranks nodes left to right along edges', () => {
    const { layout } = layoutOf(
      'node c\nnode b\nnode a\nstep "S" {\n  static a --> b\n  static b --> c\n  static a --> c\n}',
    );
    const x = (id: string) => layout.nodes[id]?.x ?? Number.NaN;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });

  it('places disjoint-rank groups side-by-side horizontally and stacks overlapping-rank groups vertically', () => {
    const { layout: sideBySide } = layoutOf(`group root {
  node client
  group edge_net {
    node cdn
  }
  group vpc {
    node alb
  }
}
step "S" {
  static client --> cdn
  static cdn --> alb
}`);
    expect(sideBySide.groups.edge_net?.y).toBe(sideBySide.groups.vpc?.y);
    expect(sideBySide.groups.edge_net?.x).toBeLessThan(sideBySide.groups.vpc?.x ?? 0);

    const { layout: stacked } = layoutOf(`group app {
  group frontend {
    node login
    node catalog
  }
  group backend {
    node auth
    node shop
  }
}
step "S" {
  static login --> catalog
  static login --> auth
  static catalog --> shop
}`);
    expect(stacked.groups.backend?.y).toBeGreaterThan(
      (stacked.groups.frontend?.y ?? 0) + (stacked.groups.frontend?.height ?? 0),
    );
  });

  it('terminates on cycles', () => {
    const { layout } = layoutOf(
      'node a\nnode b\nnode c\nstep "S" {\n  static a --> b\n  static b --> c\n  static c --> a\n}',
    );
    expect(Object.keys(layout.nodes)).toHaveLength(3);
  });

  it('names the edge it leaves out of a loop, the loop, and where the search came into it', () => {
    // The search reaches b from x first, so the loop runs b, c, a, and a --> b closes it.
    const { document, layout } = layoutOf(
      'node x\nnode a\nnode b\nnode c\nstep "S" {\n  static x --> b\n  static a --> b\n  static b --> c\n  static c --> a\n}',
    );
    expect(backEdgesOf(document)).toEqual([
      { from: 'a', to: 'b', loop: ['b', 'c', 'a'], root: 'x' },
    ]);
    // Left out, the edge points back: a, declared before b, stands at the far end of the loop.
    const x = (id: string) => layout.nodes[id]?.x ?? Number.NaN;
    expect(x('x')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
    expect(x('c')).toBeLessThan(x('a'));
    // A self-loop closes no loop of columns, and a two-way edge counts one way only.
    expect(
      backEdgesOf(
        layoutOf('node a\nnode b\nstep "S" {\n  static a --> a\n  static a <-> b\n}').document,
      ),
    ).toEqual([]);
  });

  it('wraps groups around their (nested) members', () => {
    const { document, layout } = layoutOf(`node client
group vpc {
  node api
  group data {
    node db
    node cache
  }
}
step "S" {
  static client --> api
  static api --> db
  static api --> cache
}`);
    for (const n of document.nodes) {
      if (n.parentId)
        expect(rectContains(layout.groups[n.parentId] as Rect, layout.nodes[n.id] as Rect)).toBe(
          true,
        );
    }
    expect(rectContains(layout.groups.vpc as Rect, layout.groups.data as Rect)).toBe(true);
    expect(rectOverlaps(layout.groups.vpc as Rect, layout.nodes.client as Rect)).toBe(false);
  });

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s: lays out every element',
    (_, dsl) => {
      const { document, layout } = layoutOf(dsl);
      expect(Object.keys(layout.nodes).sort()).toEqual(document.nodes.map((n) => n.id).sort());
      expect(Object.keys(layout.groups).sort()).toEqual(document.groups.map((g) => g.id).sort());
    },
  );

  it('places groups nested in a zone that has no nodes', () => {
    // Found by the property below: the zone search wins here, and the empty zone g2 used to
    // get only its own frame, leaving g3 without a rectangle.
    const { document, layout } = layoutOf(`node n0
node n1
node n2
node n3
node n4
node n5
node n7
group g1 {
  node n6
}
group g2 {
  group g3 {
  }
}
step "S" {
  static n6 --> n0
  static n1 --> n0
}`);
    expect(Object.keys(layout.groups).sort()).toEqual(document.groups.map((g) => g.id).sort());
    expect(rectContains(layout.groups.g2 as Rect, layout.groups.g3 as Rect)).toBe(true);
  });

  it('auto layout never overlaps nodes or puts foreign nodes inside groups', () => {
    const graph = fc.record({
      nodes: fc.array(fc.nat(3), { minLength: 1, maxLength: 14 }),
      edges: fc.array(fc.tuple(fc.nat(13), fc.nat(13)), { maxLength: 20 }),
    });
    fc.assert(
      fc.property(graph, ({ nodes, edges }) => {
        // group index 0 = ungrouped; 1..3 = groups g1..g3 (g3 nested in g2).
        const lines: string[] = [];
        const members = (g: number) =>
          nodes.flatMap((grp, i) => (grp === g ? [`  node n${i}`] : []));
        lines.push(...nodes.flatMap((g, i) => (g === 0 ? [`node n${i}`] : [])));
        lines.push('group g1 {', ...members(1), '}');
        lines.push('group g2 {', ...members(2), '  group g3 {', ...members(3), '  }', '}');
        const stepLines = new Set<string>();
        for (const [a, b] of edges) {
          if (a < nodes.length && b < nodes.length && a !== b) {
            stepLines.add(`  static n${a} --> n${b}`);
          }
        }
        lines.push('step "S" {', ...stepLines, '}');
        const { document, layout } = layoutOf(lines.join('\n'));
        const ids = document.nodes.map((n) => n.id);
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            expect(
              rectOverlaps(
                layout.nodes[ids[i] as string] as Rect,
                layout.nodes[ids[j] as string] as Rect,
              ),
            ).toBe(false);
          }
        }
        for (const g of document.groups) {
          const rect = layout.groups[g.id] as Rect;
          const descendants = new Set<string>([g.id]);
          for (const other of document.groups)
            if (other.parentId && descendants.has(other.parentId)) descendants.add(other.id);
          for (const n of document.nodes) {
            const inside = n.parentId !== undefined && descendants.has(n.parentId);
            if (!inside) expect(rectOverlaps(rect, layout.nodes[n.id] as Rect)).toBe(false);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('keeps existing 0-group connected nodes at 0.0 drift when a larger disconnected component is appended', () => {
    const baseDsl = `node a "A"
node b "B"
step "S" {
  animate a --> b
}`;
    const extendedDsl = `${baseDsl}
node x1 "X1"
node x2 "X2"
node x3 "X3"
step "D" {
  animate x1 --> x2
  animate x2 --> x3
}`;
    const { layout: base } = layoutOf(baseDsl);
    const { layout: extended } = layoutOf(extendedDsl);

    expect(extended.nodes.a).toEqual(base.nodes.a);
    expect(extended.nodes.b).toEqual(base.nodes.b);
    expect(extended.nodes.x1?.y).toBeGreaterThan((base.nodes.a?.y ?? 0) + NODE_SIZE.height);
  });

  it('keeps existing 0-group isolated nodes at 0.0 drift when an isolated self-loop node is appended', () => {
    const baseDsl = `node m "M"
node p "P"`;
    const extendedDsl = `${baseDsl}
node z_loop "ZL"
step "SL" {
  animate z_loop --> z_loop
}`;
    const { layout: base } = layoutOf(baseDsl);
    const { layout: extended } = layoutOf(extendedDsl);

    expect(extended.nodes.m).toEqual(base.nodes.m);
    expect(extended.nodes.p).toEqual(base.nodes.p);
    expect(extended.nodes.z_loop?.y).toBe((base.nodes.m?.y ?? 0) + 30);

    const singleBase = layoutOf('node m "M"').layout;
    const singleExtended = layoutOf(`node m "M"
node z_loop "ZL"
step "SL" {
  animate z_loop --> z_loop
}`).layout;
    expect(singleExtended.nodes.m).toEqual(singleBase.nodes.m);
    expect(singleExtended.nodes.z_loop?.y).toBe((singleBase.nodes.m?.y ?? 0) + 30);
  });

  it('keeps multi-row 0-group isolated nodes at 0.0 drift without double-counting self-loop room', () => {
    const base9 = Array.from({ length: 9 }, (_, i) => {
      const id = `n${String(i + 1).padStart(2, '0')}`;
      return `node ${id} "${id.toUpperCase()}"`;
    }).join('\n');
    const ext9 = `${base9}
node z_loop "ZL"
step "SL" {
  animate z_loop --> z_loop
}`;
    const { layout: lBase9 } = layoutOf(base9);
    const { document: docExt9, layout: lExt9 } = layoutOf(ext9);

    for (let i = 1; i <= 9; i++) {
      const id = `n${String(i).padStart(2, '0')}`;
      expect(lExt9.nodes[id]).toEqual(lBase9.nodes[id]);
    }
    expect(lExt9.nodes.n08?.y).toBe(202);
    expect(lExt9.nodes.z_loop?.y).toBe(232);

    const rects9 = docExt9.nodes.map((n) => {
      const r = lExt9.nodes[n.id] as Rect;
      return n.id === 'z_loop' ? { ...r, y: r.y - 30, height: r.height + 30 } : r;
    });
    for (let i = 0; i < rects9.length; i++) {
      for (let j = i + 1; j < rects9.length; j++) {
        expect(rectOverlaps(rects9[i] as Rect, rects9[j] as Rect)).toBe(false);
      }
    }

    // Also verify when z_loop itself wraps onto row 2 (14 preceding nodes -> 2 full rows of 7).
    const base14 = Array.from({ length: 14 }, (_, i) => {
      const id = `n${String(i + 1).padStart(2, '0')}`;
      return `node ${id} "${id.toUpperCase()}"`;
    }).join('\n');
    const ext14 = `${base14}
node z_loop "ZL"
step "SL" {
  animate z_loop --> z_loop
}`;
    const { layout: lBase14 } = layoutOf(base14);
    const { layout: lExt14 } = layoutOf(ext14);
    for (let i = 1; i <= 14; i++) {
      const id = `n${String(i).padStart(2, '0')}`;
      expect(lExt14.nodes[id]).toEqual(lBase14.nodes[id]);
    }
    expect(lExt14.nodes.z_loop?.y).toBe(394);
  });

  it('keeps pre-existing isolated nodes at 0.0 drift when appending isolated self-loops in <= 1 and >= 2 modes', () => {
    const assertNoExternalOverlaps = (
      doc: ReturnType<typeof parse>['document'],
      layout: ReturnType<typeof computeLayout>,
      loopNodes: ReadonlySet<string>,
    ) => {
      for (let i = 0; i < doc.nodes.length; i++) {
        for (let j = i + 1; j < doc.nodes.length; j++) {
          const a = doc.nodes[i];
          const b = doc.nodes[j];
          if (!a || !b) continue;
          const ra = layout.nodes[a.id] as Rect;
          const rb = layout.nodes[b.id] as Rect;
          expect(rectOverlaps(ra, rb)).toBe(false);
          if (loopNodes.has(a.id) && !a.parentId) {
            expect(rectOverlaps({ ...ra, y: ra.y - 30, height: ra.height + 30 }, rb)).toBe(false);
          }
          if (loopNodes.has(b.id) && !b.parentId) {
            expect(rectOverlaps(ra, { ...rb, y: rb.y - 30, height: rb.height + 30 })).toBe(false);
          }
        }
      }
      for (let i = 0; i < doc.groups.length; i++) {
        for (let j = i + 1; j < doc.groups.length; j++) {
          const ga = doc.groups[i];
          const gb = doc.groups[j];
          if (!ga || !gb) continue;
          expect(rectOverlaps(layout.groups[ga.id] as Rect, layout.groups[gb.id] as Rect)).toBe(
            false,
          );
        }
      }
      for (const g of doc.groups) {
        const gr = layout.groups[g.id] as Rect;
        for (const n of doc.nodes) {
          const nr = layout.nodes[n.id] as Rect;
          if (n.parentId === g.id) {
            expect(rectContains(gr, nr)).toBe(true);
          } else {
            expect(rectOverlaps(gr, nr)).toBe(false);
            if (loopNodes.has(n.id) && !n.parentId) {
              expect(rectOverlaps(gr, { ...nr, y: nr.y - 30, height: nr.height + 30 })).toBe(false);
            }
          }
        }
      }
    };

    // <= 1 mode: connected a -> b + pre-existing isolated m, then append z_loop -> z_loop
    const singleBaseDsl = `node a "A"
node b "B"
node m "M"
step "S" {
  animate a --> b
}`;
    const singleExtDsl = `${singleBaseDsl}
node z_loop "ZL"
step "SL" {
  animate z_loop --> z_loop
}`;
    const { layout: singleBase } = layoutOf(singleBaseDsl);
    const { document: singleExtDoc, layout: singleExt } = layoutOf(singleExtDsl);
    expect(singleExt.nodes.a).toEqual(singleBase.nodes.a);
    expect(singleExt.nodes.b).toEqual(singleBase.nodes.b);
    expect(singleExt.nodes.m).toEqual(singleBase.nodes.m);
    expect(singleExt.nodes.z_loop?.y).toBe((singleBase.nodes.m?.y ?? 0) + 30);
    assertNoExternalOverlaps(singleExtDoc, singleExt, new Set(['z_loop']));

    // >= 2 mode: connected z1 -> z2 + pre-existing isolated m
    const multiBaseDsl = `group z1 "Z1" { node a "A" }
group z2 "Z2" { node b "B" }
node m "M"
step "S" {
  animate a --> b
}`;
    const { layout: multiBase } = layoutOf(multiBaseDsl);

    // Append ungrouped isolated self-loop z_loop -> z_loop
    const multiLoopDsl = `${multiBaseDsl}
node z_loop "ZL"
step "SL" {
  animate z_loop --> z_loop
}`;
    const { document: multiLoopDoc, layout: multiLoop } = layoutOf(multiLoopDsl);
    expect(multiLoop.nodes.a).toEqual(multiBase.nodes.a);
    expect(multiLoop.nodes.b).toEqual(multiBase.nodes.b);
    expect(multiLoop.groups.z1).toEqual(multiBase.groups.z1);
    expect(multiLoop.groups.z2).toEqual(multiBase.groups.z2);
    expect(multiLoop.nodes.m).toEqual(multiBase.nodes.m);
    expect(multiLoop.nodes.z_loop?.y).toBe((multiBase.nodes.m?.y ?? 0) + 30);
    assertNoExternalOverlaps(multiLoopDoc, multiLoop, new Set(['z_loop']));

    // Append isolated group containing a self-loop z_iso_grp { x -> x }
    const multiGrpDsl = `${multiBaseDsl}
group z_iso_grp "ZIG" { node x "X" }
step "SL" {
  animate x --> x
}`;
    const { document: multiGrpDoc, layout: multiGrp } = layoutOf(multiGrpDsl);
    expect(multiGrp.nodes.a).toEqual(multiBase.nodes.a);
    expect(multiGrp.nodes.b).toEqual(multiBase.nodes.b);
    expect(multiGrp.groups.z1).toEqual(multiBase.groups.z1);
    expect(multiGrp.groups.z2).toEqual(multiBase.groups.z2);
    expect(multiGrp.nodes.m).toEqual(multiBase.nodes.m);
    expect(multiGrp.groups.z_iso_grp?.y).toBe(multiBase.nodes.m?.y);
    assertNoExternalOverlaps(multiGrpDoc, multiGrp, new Set(['x']));
  });
});
