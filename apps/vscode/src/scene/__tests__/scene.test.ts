import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect, stationRect } from '../../layout';
import { ICON_NAMES } from '../../model/types';
import { SAMPLE_TEMPLATES } from '../../samples';
import { CALLOUT_GAP, separatePhaseCallouts } from '../callout';
import { type Bezier, pointAt } from '../geometry';
import { ICON_SHAPES } from '../icons';
import {
  activeLabelFill,
  buildPacket as buildPacketWith,
  buildScene as buildSceneWith,
  clamp,
  computePacketCalloutBox,
  DEFAULT_FLOW_COLOR,
  fitText,
  flowColors,
  type Packet,
  packetPosition,
  type ResolvedView,
  resolveView,
  round,
  type VElement,
  type VNode,
  wrapText,
} from '../index';

const buildScene = (view: ResolvedView) => buildSceneWith(view, ICON_SHAPES);
const buildPacket = (packet: Packet, t?: number) => buildPacketWith(packet, ICON_SHAPES, t);

const DSL = `dav 1
title "T"
group vpc {
  node api
  node db [badge: "STANDBY"]
}
node client [icon: browser]
node hidden [visible: false]
client --> api : "HTTPS"
api --> db
api ..> hidden [id: failover, visible: false]
client <-> db

step "one" {
  focus client
  state db [badge: "DOWN"]
  animate client --> api : "GET"
  animate api --> db [parallel: true]
  animate db --> client : "back"
}
step "two" {
  state failover [visible: true]
  animate api --> hidden
}
step "three" {
  focus vpc
}
`;

const { document } = parse(DSL);
const layout = computeLayout(document);
const view = (i: number | null) => resolveView(document, layout, i);
const node = (i: number | null, id: string) => view(i).nodes.find((n) => n.id === id);
const edge = (i: number | null, id: string) => view(i).edges.find((e) => e.id === id);

describe('resolveView', () => {
  it('shows the base state in overview without dimming', () => {
    const v = view(null);
    expect(v.stepIndex).toBeNull();
    expect(v.phases).toEqual([]);
    expect(v.nodes.every((n) => !n.dimmed && !n.focused)).toBe(true);
    expect(node(null, 'db')).toMatchObject({ badge: 'STANDBY' });
    expect(node(null, 'hidden')).toBeUndefined();
  });

  it('applies state overrides and focus for the step', () => {
    expect(node(0, 'db')).toMatchObject({ badge: 'DOWN', focused: true });
    expect(node(0, 'client')).toMatchObject({ focused: true, dimmed: false });
  });

  it('accumulates state overrides across steps', () => {
    expect(node(1, 'db')).toMatchObject({ badge: 'DOWN' });
    expect(node(2, 'db')).toMatchObject({ badge: 'DOWN' });
    expect(edge(1, 'failover')).toBeDefined();
    // Still overridden to visible, but hidden because its endpoint is hidden again.
    expect(edge(2, 'failover')).toBeUndefined();
  });

  it('does not carry focus or animations to later steps', () => {
    expect(node(1, 'client')).toMatchObject({ focused: false, dimmed: true });
    expect(view(2).phases).toEqual([]);
  });

  it('groups packets into sequential and parallel phases', () => {
    const phases = view(0).phases;
    expect(phases.map((p) => p.map((x) => `${x.from}>${x.to}`))).toEqual([
      ['client>api', 'api>db'],
      ['db>client'],
    ]);
  });

  it('reverses the path when a packet travels against a bidirectional edge', () => {
    const packet = view(0).phases[1]?.[0];
    const e = edge(0, 'client->db');
    expect(packet && e && packet.path.p0).toEqual(e?.path.p3);
    expect(e?.active).toBe(true);
  });

  it('makes animated endpoints and their edges visible for that step only', () => {
    expect(node(1, 'hidden')).toBeDefined();
    expect(edge(1, 'failover')?.active).toBe(true);
    expect(node(2, 'hidden')).toBeUndefined();
  });

  it('focusing a group keeps its subtree undimmed', () => {
    expect(node(2, 'api')?.dimmed).toBe(false);
    expect(node(2, 'client')?.dimmed).toBe(true);
    expect(view(2).groups.find((g) => g.id === 'vpc')?.dimmed).toBe(false);
  });

  it('draws only the edges that are part of the focus', () => {
    expect(edge(0, 'client->api')).toBeDefined();
    expect(edge(2, 'client->api')).toBeUndefined();
    // Nothing runs on it in this step, but both of its nodes are in the focused group.
    expect(edge(2, 'api->db')).toBeDefined();
    expect(edge(2, 'api->db')?.active).toBe(false);
  });

  it('draws every edge on the overview and in a step that focuses on nothing', () => {
    const dsl =
      'dav 1\nnode a\nnode b\nnode c\na --> b\nb --> c\nstep "S" {\n  desc "Nothing"\n}\n';
    const { document } = parse(dsl);
    const layout = computeLayout(document);
    expect(resolveView(document, layout, 0).edges.map((e) => e.id)).toEqual(['a->b', 'b->c']);
    expect(resolveView(document, layout, null).edges).toHaveLength(2);
  });

  it('is deterministic regardless of navigation order', () => {
    const source = JSON.stringify(document);
    const direct = JSON.stringify(view(1));
    view(2);
    view(0);
    view(null);
    expect(JSON.stringify(view(1))).toBe(direct);
    expect(JSON.stringify(document)).toBe(source);
  });
});

function collectText(node: VNode): string[] {
  if (typeof node === 'string') return [node];
  return node.children.flatMap(collectText);
}

function collectAttrs(node: VNode): string[] {
  if (typeof node === 'string') return [];
  return [
    ...Object.entries(node.attrs).map(([k, v]) => `${k}=${v}`),
    ...node.children.flatMap(collectAttrs),
  ];
}

function findAll(node: VNode, pred: (e: VElement) => boolean): VElement[] {
  if (typeof node === 'string') return [];
  return [...(pred(node) ? [node] : []), ...node.children.flatMap((c) => findAll(c, pred))];
}

describe('buildScene', () => {
  it('renders every visible node, group and edge', () => {
    const scene = buildScene(view(0));
    const ids = findAll(scene, (e) => 'data-id' in e.attrs).map((e) => e.attrs['data-id']);
    expect(ids).toEqual(expect.arrayContaining(['vpc', 'api', 'db', 'client', 'client->api']));
    expect(collectText(scene)).toEqual(expect.arrayContaining(['HTTPS', 'DOWN']));
  });

  it('carries user text only as text nodes, never as markup', () => {
    const evil = parse(
      'dav 1\nnode x "<img src=x onerror=alert(1)>" [sub: "</text><script>", badge: "\\"><b>"]',
    ).document;
    const scene = buildScene(resolveView(evil, computeLayout(evil), null));
    const texts = collectText(scene).join('|');
    expect(texts).toContain('<img');
    const attrs = collectAttrs(scene).join('|');
    expect(attrs).not.toContain('<');
    expect(attrs).not.toMatch(/on\w+=/);
  });

  it('draws an icon chip on a packet only when the animate names an icon', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\na --> b\nstep "S" {\n  animate a --> b [icon: key, color: red]\n  animate a --> b\n}\n',
    ).document;
    const phases = resolveView(doc, computeLayout(doc), 0).phases;
    const [withIcon, plain] = [phases[0]?.[0], phases[1]?.[0]];
    if (!withIcon || !plain) throw new Error('missing packet');
    expect(withIcon.icon).toBe('key');

    const chip = buildPacket(withIcon, 0.5);
    const icon = findAll(chip, (e) => e.attrs.class === 'dav-packet-icon')[0];
    expect(icon?.children.length).toBe(ICON_SHAPES.key.length);
    const marker = findAll(chip, (e) => e.tag === 'circle' && e.attrs.r === 16)[0];
    expect(marker?.attrs.stroke).toBe('var(--dav-c-red)');

    const dot = buildPacket(plain, 0.5);
    expect(findAll(dot, (e) => e.attrs.class === 'dav-packet-icon')).toEqual([]);
    expect(findAll(dot, (e) => e.tag === 'circle' && e.attrs.r === 8)).toHaveLength(1);
  });

  it('renders a callout that stays still while only the marker moves', () => {
    const doc = parse(
      'dav 1\nnode a "A"\nnode b "B"\na --> b\nstep "S" {\n  animate a --> b : "POST /v1/charges" [desc: "Edge WAF inspects payload and verifies mTLS before forwarding"]\n}\n',
    ).document;
    const pkt = resolveView(doc, computeLayout(doc), 0).phases[0]?.[0];
    expect(pkt).toBeDefined();
    if (!pkt) return;
    const v0 = buildPacket(pkt, 0);
    const v1 = buildPacket(pkt, 1);
    const callouts = findAll(v0, (e) => e.attrs.class === 'dav-packet-callout');
    expect(callouts).toHaveLength(1);
    const texts = collectText(v0).join(' ');
    expect(texts).toContain('POST /v1/charges');
    expect(texts).toContain('Edge WAF inspects payload');

    // The text and the box stay where they are while the marker moves from t=0 to t=1
    const label0 = findAll(v0, (e) => e.attrs.class === 'dav-packet-label')[0];
    const label1 = findAll(v1, (e) => e.attrs.class === 'dav-packet-label')[0];
    expect(label0?.attrs).toEqual(label1?.attrs);

    const bubble0 = findAll(v0, (e) => e.attrs.class === 'dav-packet-bubble')[0];
    const bubble1 = findAll(v1, (e) => e.attrs.class === 'dav-packet-bubble')[0];
    expect(bubble0?.attrs.d).toEqual(bubble1?.attrs.d);

    const dot0 = findAll(v0, (e) => e.attrs.class === 'dav-packet-dot')[0];
    const dot1 = findAll(v1, (e) => e.attrs.class === 'dav-packet-dot')[0];
    expect(dot0?.attrs.transform).not.toEqual(dot1?.attrs.transform);
  });

  it('keeps the accent independent of author colors', () => {
    const doc = parse(
      'dav 1\nnode a [color: orange]\nnode b [color: yellow]\na --> b [color: orange]\nstep "S" {\n  focus a\n  animate a --> b\n}\n',
    ).document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), 0));

    const [flow] = findAll(scene, (e) => e.attrs.class === 'dav-flow');
    expect(flow?.attrs.stroke).toBe('var(--dav-accent)');

    const strokes = collectAttrs(scene).filter((a) => a.startsWith('stroke='));
    expect(strokes).toContain('stroke=var(--dav-c-yellow)');
    expect(strokes).toContain('stroke=var(--dav-c-orange)');
  });

  it('shows an authored color on the station, icon and badge', () => {
    const doc = parse(
      'dav 1\nnode a [icon: database, badge: "A"]\nnode b [color: Red, badge: "B"]\nnode c [badge: "C"]\n',
    ).document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), null));
    const fills = findAll(scene, (e) => e.attrs.class === 'dav-badge').map(
      (b) => b.children.flatMap((c) => (typeof c === 'string' ? [] : [c.attrs.fill]))[0],
    );
    expect(fills).toEqual(['var(--dav-fg)', 'var(--dav-c-red)', 'var(--dav-fg)']);

    const [station] = findAll(scene, (e) => e.attrs['data-id'] === 'b');
    const strokes = station
      ? collectAttrs(station).filter((a) => a === 'stroke=var(--dav-c-red)')
      : [];
    expect(strokes.length).toBeGreaterThanOrEqual(2);
  });

  it('restores the declared color after color: none', () => {
    const doc = parse(
      'dav 1\nnode a [color: blue]\nnode b\nstep "1" {\n  state a [color: red]\n  state b [color: red]\n}\nstep "2" {\n  state a [color: none]\n  state b [color: none]\n}\nstep "3" {\n  focus a\n}\n',
    ).document;
    const layout = computeLayout(doc);
    const accent = (step: number, id: string) =>
      resolveView(doc, layout, step).nodes.find((n) => n.id === id)?.accent;
    expect([accent(0, 'a'), accent(0, 'b')]).toEqual(['red', 'red']);
    expect([accent(1, 'a'), accent(1, 'b')]).toEqual(['blue', undefined]);
    expect([accent(2, 'a'), accent(2, 'b')]).toEqual(['blue', undefined]);
  });

  it('routes a rail around stations in its way', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\nnode c\nnode d\na --> b\nb --> c\na --> d\nd --> c\na --> c\n',
    ).document;
    const layout = computeLayout(doc);
    const v = resolveView(doc, layout, null);
    const rail = v.edges.find((e) => e.id === 'a->c');
    expect(rail).toBeDefined();
    for (const id of ['b', 'd']) {
      const rect = layout.nodes[id];
      if (!rect || !rail) continue;
      const center = { x: rect.x + rect.width / 2, y: rect.y + 50 };
      for (let i = 0; i <= 40; i++) {
        const p = pointAt(rail.path, i / 40);
        expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeGreaterThan(22);
      }
    }
  });

  it('draws active flows above every rail', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\nnode c\na --> c\nb --> c\nstep "S" {\n  animate a --> c\n}\n',
    ).document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), 0));
    const layers = scene.children.map((c) => (typeof c === 'string' ? '' : c.attrs.class));
    expect(layers.indexOf('dav-layer-flows')).toBe(layers.indexOf('dav-layer-edges') + 1);
    const rails = findAll(scene, (e) => String(e.attrs.class).startsWith('dav-edge'));
    expect(rails.flatMap((rail) => findAll(rail, (e) => e.attrs.class === 'dav-flow'))).toEqual([]);
    expect(findAll(scene, (e) => e.attrs.class === 'dav-flow')[0]?.attrs['data-edge']).toBe('a->c');
  });

  it('draws zone names above the rails', () => {
    const doc = parse('dav 1\ngroup g "Zone" {\n  node a\n}\nnode b\na --> b\n').document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), null));
    const layerOf = (name: string) =>
      scene.children.findIndex((c) => typeof c !== 'string' && c.attrs.class === name);
    const labels = scene.children[layerOf('dav-layer-labels')];
    expect(layerOf('dav-layer-labels')).toBeGreaterThan(layerOf('dav-layer-flows'));
    expect(labels && findAll(labels, (e) => e.attrs.class === 'dav-group-label')).toHaveLength(1);
  });

  it('makes a round trip only when the animate arrow is bidirectional', () => {
    const packetFor = (arrow: string) => {
      const doc = parse(
        `dav 1\nnode a\nnode b\na <-> b\nstep "S" {\n  animate a ${arrow} b\n}\n`,
      ).document;
      const packet = resolveView(doc, computeLayout(doc), 0).phases[0]?.[0];
      if (!packet) throw new Error('missing packet');
      return packet;
    };

    const roundTrip = packetFor('<->');
    expect(packetPosition(roundTrip, 0)).toEqual(roundTrip.path.p0);
    expect(packetPosition(roundTrip, 0.5)).toEqual(roundTrip.path.p3);
    expect(packetPosition(roundTrip, 1)).toEqual(roundTrip.path.p0);

    const oneWay = packetFor('-->');
    expect(packetPosition(oneWay, 0.5)).not.toEqual(oneWay.path.p3);
    expect(packetPosition(oneWay, 1)).toEqual(oneWay.path.p3);
  });

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s: callouts never cover a zone name',
    (_, dsl) => {
      const doc = parse(dsl).document;
      const l = computeLayout(doc);
      doc.steps.forEach((_step, i) => {
        const view = resolveView(doc, l, i);
        for (const packet of view.phases.flat()) {
          const box = computePacketCalloutBox(packet);
          if (!box) continue;
          // The strip across the top of each zone, where its name is, wherever the camera
          // has slid the name to.
          for (const group of view.groups) {
            const header = { ...group.rect, height: 34 };
            const overlaps =
              box.cx - box.halfW < header.x + header.width &&
              box.cx + box.halfW > header.x &&
              box.boxTop < header.y + header.height &&
              box.boxBottom > header.y;
            expect(overlaps).toBe(false);
          }
        }
      });
    },
  );

  const CLOSE_PARALLEL = `dav 1
node a
node b
node c
a --> b
a --> c
step "S" {
  animate a --> b : "First" [desc: "A description long enough to make this callout wide"]
  animate a --> c : "Second" [parallel: true, desc: "Another description of a similar width"]
  animate a --> b : "Third" [parallel: true, desc: "And a third one over the same rail"]
}
`;

  it.each([
    ['close parallel packets', CLOSE_PARALLEL] as const,
    ...SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const),
  ])('%s: callouts of one phase never overlap', (_, dsl) => {
    const doc = parse(dsl).document;
    const l = computeLayout(doc);
    doc.steps.forEach((_step, i) => {
      for (const phase of resolveView(doc, l, i).phases) {
        const boxes = phase.flatMap((p) => computePacketCalloutBox(p) ?? []);
        boxes.forEach((a, ai) => {
          for (const b of boxes.slice(ai + 1)) {
            const overlaps =
              a.cx - a.halfW < b.cx + b.halfW &&
              a.cx + a.halfW > b.cx - b.halfW &&
              a.boxTop < b.boxBottom &&
              a.boxBottom > b.boxTop;
            expect(overlaps).toBe(false);
          }
        });
      }
    });
  });

  /** A packet parked at x, so that its callout sits at a chosen place. */
  const packetAt = (x: number): Packet => {
    const point = { x, y: 0 };
    return {
      from: 'a',
      to: 'b',
      fromLabel: 'A',
      toLabel: 'B',
      label: 'Callout',
      color: 'red',
      path: { p0: point, p1: point, p2: point, p3: point },
      roundTrip: false,
      clearTop: 0,
      labelAreas: [],
      durationMs: 2000,
    };
  };

  it('shifts clashing callouts symmetrically and leaves far ones in place', () => {
    const [first, far, clashing] = [packetAt(0), packetAt(1000), packetAt(0)] as const;
    separatePhaseCallouts([first, far, clashing]);
    expect(far).not.toHaveProperty('calloutShift');
    expect(first.calloutShift).toBeLessThan(0);
    expect(clashing.calloutShift).toBeGreaterThan(0);
    expect((first.calloutShift ?? 0) + (clashing.calloutShift ?? 0)).toBeCloseTo(0);
  });

  it('moves clashing callouts apart by the smallest symmetric distance', () => {
    const [first, second] = [packetAt(100), packetAt(100)] as const;
    separatePhaseCallouts([first, second]);
    const halfW = computePacketCalloutBox(first)?.halfW ?? 0;
    const expectedSpan = halfW * 2 + CALLOUT_GAP + 1;
    expect(first.calloutShift).toBeCloseTo(-expectedSpan / 2);
    expect(second.calloutShift).toBeCloseTo(expectedSpan / 2);
    expect((second.calloutShift ?? 0) - (first.calloutShift ?? 0)).toBeCloseTo(expectedSpan);
  });

  it('does not move callouts of packets that play one after another', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\na --> b\nstep "S" {\n  animate a --> b : "One"\n  animate a --> b : "Two"\n}\n',
    ).document;
    for (const phase of resolveView(doc, computeLayout(doc), 0).phases) {
      expect(phase[0]).not.toHaveProperty('calloutShift');
    }
  });

  it('marks only active edge labels for emphasis', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\nnode c\na --> b : "on"\nb --> c : "off"\nstep "S" {\n  animate a --> b\n}\n',
    ).document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), 0));
    const [on, off] = findAll(scene, (e) => String(e.attrs.class).startsWith('dav-edge-label')).map(
      (g) => findAll(g, (e) => e.tag === 'text')[0]?.attrs,
    );
    expect(on?.['data-edge']).toBe('a->b');
    expect(off?.['data-edge']).toBeUndefined();
  });

  it('gives an edge animated twice the color of each phase', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\na --> b\nstep "S" {\n  animate a --> b [color: red]\n  animate a --> b [color: blue]\n}\n',
    ).document;
    const { phases } = resolveView(doc, computeLayout(doc), 0);
    expect(phases.map((packets) => [...flowColors(packets)])).toEqual([
      [['a->b', 'red']],
      [['a->b', 'blue']],
    ]);
    expect(activeLabelFill('blue')).toBe('var(--dav-c-blue)');
    expect(activeLabelFill(DEFAULT_FLOW_COLOR)).toBe('var(--dav-accent-text)');
  });

  it('keeps the line breaks of a callout description', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\na --> b\nstep "S" {\n  animate a --> b [desc: "first\\n\\n  second\\nthird"]\n}\n',
    ).document;
    const packet = resolveView(doc, computeLayout(doc), 0).phases[0]?.[0];
    expect(packet && computePacketCalloutBox(packet)?.descLines).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('merges description lines beyond the limit into the last one', () => {
    expect(wrapText('1\n2\n3\n4', 13, 360, 3)).toEqual(['1', '2', '3 4']);
    const long = 'x'.repeat(200);
    const [, last] = wrapText(`a\nb\n${long}`, 13, 360, 2);
    expect(last).toMatch(/^b x+…$/);
  });

  it('supports custom fitText/wrapText options and geometry helpers without changing defaults', () => {
    const fixedMeasure = (s: string) => s.length * 10;
    // Default keeps trailing space before ellipsis (`trimBeforeEllipsis` false); opt-in trims it.
    expect(fitText('abc def', 10, 50, { measure: fixedMeasure })).toBe('abc …');
    expect(fitText('abc def', 10, 50, { measure: fixedMeasure, trimBeforeEllipsis: true })).toBe(
      'abc…',
    );
    expect(
      wrapText('alpha→beta→gamma', 10, 70, 3, {
        measure: fixedMeasure,
        isBreakable: (ch) => ch === '→',
        trimBeforeEllipsis: true,
      }),
    ).toEqual(['alpha→', 'beta→', 'gamma']);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(round(12.34)).toBe(12.3);
  });

  it('keeps the child groups of a focused group undimmed', () => {
    const doc = parse(
      'dav 1\ngroup parent {\n  group child {}\n}\ngroup other {}\nnode a\nstep "S" {\n  focus parent\n}\n',
    ).document;
    const dimmed = (id: string) =>
      resolveView(doc, computeLayout(doc), 0).groups.find((g) => g.id === id)?.dimmed;
    expect(dimmed('parent')).toBe(false);
    expect(dimmed('child')).toBe(false);
    expect(dimmed('other')).toBe(true);
  });

  it('colors a running stop like its flow', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\nnode c\nstep "S" {\n  animate a --> b\n  animate b --> c [color: red]\n}\n',
    ).document;
    const stops = findAll(
      buildScene(resolveView(doc, computeLayout(doc), 0)),
      (e) => e.attrs.class === 'dav-stop',
    );
    expect(stops.map((s) => s.attrs['data-active-fill'])).toEqual([
      'var(--dav-accent)',
      'var(--dav-c-red)',
    ]);
    expect(stops.map((s) => s.attrs['data-active-text'])).toEqual(['#ffffff', 'var(--dav-bg)']);
  });

  it('leaves stations along the direction of travel', () => {
    const doc = parse('dav 1\nnode a\nnode b\nnode c\na --> b\na --> c\n').document;
    const v = resolveView(doc, computeLayout(doc), null);
    const [first, second] = v.edges;
    expect(first?.path.p0).not.toEqual(second?.path.p0);
  });

  it('runs opposite directions on parallel tracks', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\na --> b\nb --> a\nstep "S" {\n  animate a --> b\n  animate b --> a\n}\n',
    ).document;
    const v = resolveView(doc, computeLayout(doc), 0);
    const y = (id: string) => v.edges.find((e) => e.id === id)?.path.p0.y ?? 0;
    expect(y('a->b')).toBeLessThan(y('b->a'));
    expect(v.phases[1]?.[0]?.path.p0.y).toBe(y('b->a'));
  });

  it('numbers the phases of a multi-phase step', () => {
    const scene = buildScene(view(0));
    const stops = findAll(scene, (e) => e.attrs.class === 'dav-stop');
    expect(stops.map((s) => s.attrs['data-phase'])).toEqual([0, 0, 1]);
    expect(findAll(buildScene(view(2)), (e) => e.attrs.class === 'dav-stop')).toEqual([]);
  });

  it('keeps callouts above their endpoint nodes', () => {
    const doc = parse(
      'dav 1\nnode a "A"\nnode b [icon: modal]\na --> b\nstep "S" {\n  animate a --> b : "x" [desc: "long description"]\n}\n',
    ).document;
    const layout = computeLayout(doc);
    const packet = resolveView(doc, layout, 0).phases[0]?.[0];
    const box = packet && computePacketCalloutBox(packet);
    const top = Math.min(layout.nodes.a?.y ?? 0, layout.nodes.b?.y ?? 0);
    expect(box?.boxBottom).toBeLessThanOrEqual(top - 8);
  });

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    '%s: renders every step',
    (_, dsl) => {
      const doc = parse(dsl).document;
      const l = computeLayout(doc);
      for (let i = -1; i < doc.steps.length; i++) {
        expect(() => buildScene(resolveView(doc, l, i < 0 ? null : i))).not.toThrow();
      }
    },
  );

  it('renders every built-in icon', () => {
    const dsl = ['dav 1', ...ICON_NAMES.map((icon, i) => `node n${i} [icon: ${icon}]`)].join('\n');
    const { document, diagnostics } = parse(dsl);
    expect(diagnostics).toEqual([]);
    const scene = buildScene(resolveView(document, computeLayout(document), null));
    const stations = findAll(scene, (e) => e.attrs.class === 'dav-station');
    expect(stations).toHaveLength(ICON_NAMES.length);
  });
});

describe('self-loops', () => {
  const sourced = (dsl: string) => {
    const { document } = parse(dsl);
    return { document, layout: computeLayout(document) };
  };

  it('draws a loop above and to the right of the station, without shifting tracks', () => {
    const { document, layout } = sourced('dav 1\nnode a\nnode b\na --> a\na --> b');
    const view = resolveView(document, layout, null);
    const rect = layout.nodes.a as Rect;
    const station = stationRect(rect, 'server');
    const path = view.edges[0]?.path as Bezier;
    const { p0, p1, p2, p3 } = path;
    const cx = station.x + station.width / 2;
    const cy = station.y + station.height / 2;
    expect(p0.x).toBeGreaterThan(cx);
    expect(p3.x).toBeGreaterThan(cx);
    expect(p0.y).toBeLessThan(cy);
    expect(p3.y).toBeLessThan(cy);
    expect(p1.y).toBeLessThan(p0.y);
    expect(p2.x).toBeGreaterThan(p3.x);
    expect(Math.hypot(p0.x - cx, p0.y - cy)).toBeCloseTo(station.width / 2);
  });

  it('runs a packet around the loop and nests later loops outside', () => {
    const { document, layout } = sourced(
      'dav 1\nnode a\na --> a\na ..> a [id: e2]\nstep "s" { animate a --> a : "tick" }',
    );
    const view = resolveView(document, layout, 0);
    const [first, second] = view.edges;
    expect(view.phases[0]?.[0]?.path).toEqual(first?.path);
    expect(second?.path.p1.y).toBeLessThan(first?.path.p1.y as number);
  });

  it('reserves room above the node, and keeps rows level and groups around the loop', () => {
    const plain = sourced('dav 1\nnode a\nnode b\na --> b').layout;
    const looped = sourced('dav 1\nnode a\nnode b\na --> a\na --> b').layout;
    expect((looped.nodes.a as Rect).y).toBeGreaterThan((plain.nodes.a as Rect).y);
    expect((looped.nodes.a as Rect).y).toBe((looped.nodes.b as Rect).y);

    const grouped = sourced('dav 1\ngroup g { node a }\na --> a').layout;
    expect((grouped.groups.g as Rect).y).toBeLessThanOrEqual((grouped.nodes.a as Rect).y - 30 - 34);
  });
});

describe('numbered stops on a shared rail', () => {
  const stopCenters = (dsl: string) => {
    const { document } = parse(dsl);
    const view = resolveView(document, computeLayout(document), 0);
    return findAll(buildScene(view), (e) => e.attrs.class === 'dav-stop').map((stop) => {
      const circle = findAll(stop, (e) => e.tag === 'circle')[0] as VElement;
      return { x: Number(circle.attrs.cx), y: Number(circle.attrs.cy) };
    });
  };
  const closestPair = (points: ReadonlyArray<{ x: number; y: number }>) =>
    Math.min(
      ...points.flatMap((a, i) => points.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))),
    );

  it.each([
    ['one direction', 'a --> b', 'animate a --> b\n  animate a --> b\n  animate a --> b'],
    ['both directions of a shared rail', 'a <-> b', 'animate a --> b\n  animate b --> a'],
    ['a self-loop', 'a --> a', 'animate a --> a\n  animate a --> a\n  animate a --> a'],
  ])('keeps the numbers apart on %s', (_name, edge, animations) => {
    const stops = stopCenters(`dav 1\nnode a\nnode b\n${edge}\nstep "S" {\n  ${animations}\n}\n`);
    expect(stops.length).toBeGreaterThanOrEqual(2);
    expect(closestPair(stops)).toBeGreaterThanOrEqual(22);
  });

  it('keeps a lone number at the middle of its rail', () => {
    const { document } = parse(
      'dav 1\nnode a\nnode b\nnode c\na --> b\nb --> c\nstep "S" {\n  animate a --> b\n  animate b --> c\n}\n',
    );
    const view = resolveView(document, computeLayout(document), 0);
    const circle = findAll(buildScene(view), (e) => e.attrs.class === 'dav-stop')[0]?.children[0];
    const mid = pointAt(view.phases[0]?.[0]?.path as Bezier, 0.5);
    expect((circle as VElement).attrs.cx).toBe(mid.x);
    expect((circle as VElement).attrs.cy).toBe(mid.y);
  });
});

describe('edges between the same stations', () => {
  const build = (dsl: string, step: number | null = null) => {
    const { document } = parse(dsl);
    return resolveView(document, computeLayout(document), step);
  };

  it('prefers the edge on screen when a step hides the first one', () => {
    const view = build(
      'dav 1\nnode a\nnode b\na --> b [id: primary]\na ..> b [id: failover, visible: false]\nstep "S" {\n  state primary [visible: false]\n  state failover [visible: true]\n  animate a --> b\n}\n',
      0,
    );
    expect(view.edges.map((e) => [e.id, e.active])).toEqual([['failover', true]]);
  });

  it.each([
    ['same direction', 'a --> b [id: x]\na ..> b [id: y]'],
    ['a bidirectional edge first', 'a <-> b\nb --> a [id: y]'],
    ['a bidirectional edge last', 'b --> a [id: x]\na <-> b'],
  ])('keeps them apart with %s', (_name, edges) => {
    const [first, second] = build(`dav 1\nnode a\nnode b\n${edges}\n`).edges;
    const a = pointAt(first?.path as Bezier, 0.5);
    const b = pointAt(second?.path as Bezier, 0.5);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20);
  });

  it('runs a packet along the edge it belongs to', () => {
    const view = build(
      'dav 1\nnode a\nnode b\na --> b [id: x, visible: false]\na ..> b [id: y]\nstep "S" {\n  animate a --> b\n}\n',
      0,
    );
    expect(view.phases[0]?.[0]?.path).toEqual(view.edges.find((e) => e.id === 'y')?.path);
  });

  it('starts a steep rail at the side of its station on a fan-out', () => {
    const { document } = parse(
      'dav 1\nnode a\nnode x\nnode y\nnode z\na --> x\na --> y\na --> z\n',
    );
    const layout = computeLayout(document);
    const view = resolveView(document, layout, null);
    const station = stationRect(layout.nodes.a as Rect, 'server');
    const rail = view.edges.find((e) => e.to === 'z')?.path as Bezier;
    const cx = station.x + station.width / 2;
    const cy = station.y + station.height / 2;
    const fromCenter = Math.hypot(rail.p0.x - cx, rail.p0.y - cy);
    expect(rail.p0.x === cx || Math.abs(fromCenter - station.width / 2) < 0.01).toBe(true);
  });
});

describe('focus from state', () => {
  const stepView = (dsl: string) => {
    const { document } = parse(dsl);
    return resolveView(document, computeLayout(document), 0);
  };

  it('does not dim the diagram for a step that only hides something', () => {
    const view = stepView(
      'dav 1\nnode a\nnode b\nnode c\na --> b\nstep "S" {\n  state c [visible: false]\n}\n',
    );
    expect(view.nodes.map((n) => [n.id, n.dimmed])).toEqual([
      ['a', false],
      ['b', false],
    ]);
  });

  it('lights both nodes of a state on an edge', () => {
    const view = stepView(
      'dav 1\nnode a\nnode b\nnode c\na --> b [id: e]\nstep "S" {\n  state e [color: red]\n}\n',
    );
    expect(view.nodes.map((n) => [n.id, n.dimmed])).toEqual([
      ['a', false],
      ['b', false],
      ['c', true],
    ]);
    expect(view.edges.map((e) => e.id)).toEqual(['e']);
  });

  it('still focuses an ordinary state target', () => {
    const view = stepView('dav 1\nnode a\nnode b\nstep "S" {\n  state a [badge: "x"]\n}\n');
    expect(view.nodes.map((n) => [n.id, n.focused, n.dimmed])).toEqual([
      ['a', true, false],
      ['b', false, true],
    ]);
  });
});

describe('self-loop room', () => {
  it('is kept for a node placed under a child group', () => {
    const { document } = parse(
      'dav 1\ngroup o {\n  group i {\n    node b\n    node x\n    node y\n    node d\n  }\n  node c\n}\nb --> d\nx --> c\ny --> c\nc --> c\n',
    );
    const layout = computeLayout(document);
    const inner = layout.groups.i as Rect;
    const node = layout.nodes.c as Rect;
    expect(node.y - (inner.y + inner.height)).toBeGreaterThanOrEqual(58);
  });
});
