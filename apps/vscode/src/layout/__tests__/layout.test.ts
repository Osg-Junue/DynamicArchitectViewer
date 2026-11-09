import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { SAMPLE_TEMPLATES } from '../../samples';
import { computeLayout, countCrossings, NODE_SIZE, type Rect } from '../index';

describe('edge label spacing', () => {
  const gapFor = (label: string) => {
    const { nodes } = computeLayout(parse(`dav 1\nnode a\nnode b\na --> b : "${label}"`).document);
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
      parse(`dav 1\nnode a\nnode b\nnode c\n${open}\nnode d\n${close}a --> b\nb --> c\nc --> d`)
        .document,
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

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

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
    const fan = layoutOf('dav 1\nnode a\nnode b\nnode c\na --> b\na --> c');
    expect(countCrossings(fan.document, fan.layout)).toBe(0);
  });

  it('reorders stacked groups to remove a crossing', () => {
    const { document, layout } = layoutOf(`dav 1
node top
node bottom
group first {
  node r1
}
group second {
  node r2
}
top --> r2
bottom --> r1`);
    expect(countCrossings(document, layout)).toBe(0);
  });

  it('keeps connected rows on one line', () => {
    const { layout } = layoutOf('dav 1\nnode a\nnode b\nnode c\nnode d\na --> b\nc --> d');
    expect(layout.nodes.a?.y).toBe(layout.nodes.b?.y);
    expect(layout.nodes.c?.y).toBe(layout.nodes.d?.y);
  });
});

describe('layout', () => {
  it('gives every node the same size, whatever its icon', () => {
    const { layout } = layoutOf('dav 1\nnode a\nnode s [icon: modal]');
    expect(layout.nodes.a).toMatchObject(NODE_SIZE);
    expect(layout.nodes.s).toMatchObject(NODE_SIZE);
  });

  it('ranks nodes left to right along edges', () => {
    const { layout } = layoutOf('dav 1\nnode c\nnode b\nnode a\na --> b\nb --> c\na --> c');
    const x = (id: string) => layout.nodes[id]?.x ?? Number.NaN;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });

  it('places disjoint-rank groups side-by-side horizontally and stacks overlapping-rank groups vertically', () => {
    const { layout: sideBySide } = layoutOf(`dav 1
node client
group edge_net {
  node cdn
}
group vpc {
  node alb
}
client --> cdn
cdn --> alb`);
    expect(sideBySide.groups.edge_net?.y).toBe(sideBySide.groups.vpc?.y);
    expect(sideBySide.groups.edge_net?.x).toBeLessThan(sideBySide.groups.vpc?.x ?? 0);

    const { layout: stacked } = layoutOf(`dav 1
group frontend {
  node login
  node catalog
}
group backend {
  node auth
  node shop
}
login --> catalog
login --> auth
catalog --> shop`);
    expect(stacked.groups.backend?.y).toBeGreaterThan(
      (stacked.groups.frontend?.y ?? 0) + (stacked.groups.frontend?.height ?? 0),
    );
  });

  it('terminates on cycles', () => {
    const { layout } = layoutOf('dav 1\nnode a\nnode b\nnode c\na --> b\nb --> c\nc --> a');
    expect(Object.keys(layout.nodes)).toHaveLength(3);
  });

  it('wraps groups around their (nested) members', () => {
    const { document, layout } = layoutOf(`dav 1
node client
group vpc {
  node api
  group data {
    node db
    node cache
  }
}
client --> api
api --> db
api --> cache`);
    for (const n of document.nodes) {
      if (n.parentId)
        expect(contains(layout.groups[n.parentId] as Rect, layout.nodes[n.id] as Rect)).toBe(true);
    }
    expect(contains(layout.groups.vpc as Rect, layout.groups.data as Rect)).toBe(true);
    expect(overlaps(layout.groups.vpc as Rect, layout.nodes.client as Rect)).toBe(false);
  });

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s: lays out every element',
    (_, dsl) => {
      const { document, layout } = layoutOf(dsl);
      expect(Object.keys(layout.nodes).sort()).toEqual(document.nodes.map((n) => n.id).sort());
      expect(Object.keys(layout.groups).sort()).toEqual(document.groups.map((g) => g.id).sort());
    },
  );

  it('auto layout never overlaps nodes or puts foreign nodes inside groups', () => {
    const graph = fc.record({
      nodes: fc.array(fc.nat(3), { minLength: 1, maxLength: 14 }),
      edges: fc.array(fc.tuple(fc.nat(13), fc.nat(13)), { maxLength: 20 }),
    });
    fc.assert(
      fc.property(graph, ({ nodes, edges }) => {
        // group index 0 = ungrouped; 1..3 = groups g1..g3 (g3 nested in g2).
        const lines = ['dav 1'];
        const members = (g: number) =>
          nodes.flatMap((grp, i) => (grp === g ? [`  node n${i}`] : []));
        lines.push(...nodes.flatMap((g, i) => (g === 0 ? [`node n${i}`] : [])));
        lines.push('group g1 {', ...members(1), '}');
        lines.push('group g2 {', ...members(2), '  group g3 {', ...members(3), '  }', '}');
        for (const [a, b] of edges) {
          if (a < nodes.length && b < nodes.length && a !== b)
            lines.push(`n${a} --> n${b} [id: e${a}_${b}]`);
        }
        const { document, layout } = layoutOf([...new Set(lines)].join('\n'));
        const ids = document.nodes.map((n) => n.id);
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            expect(
              overlaps(
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
            if (!inside) expect(overlaps(rect, layout.nodes[n.id] as Rect)).toBe(false);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
