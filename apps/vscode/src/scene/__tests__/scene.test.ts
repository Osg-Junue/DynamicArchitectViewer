import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect, rectOverlaps, stationRect } from '../../layout';
import { ICON_NAMES } from '../../model/types';
import { SAMPLE_TEMPLATES } from '../../samples';
import { type Bezier, pointAt, type Rail, type Route, railEnds } from '../geometry';
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
  wrapText,
} from '../index';
import { nodeBody, zoneNameArea } from '../rails';
import { collectAttrs, collectText, findAll, overlap } from './helpers';

const buildScene = (view: ResolvedView) => buildSceneWith(view, ICON_SHAPES);
const buildPacket = (packet: Packet, t?: number) => buildPacketWith(packet, ICON_SHAPES, t);

const DSL = `title "T"
group vpc {
  node api
  node db [badge: "STANDBY"]
}
node client [icon: browser]
node hidden [visible: false]

step "one" {
  focus client
  state db [badge: "DOWN"]
  static db <-> client : "REPL"
  animate client --> api : "GET"
  animate api --> db [parallel: true]
  animate db --> client : "back"
}
step "two" {
  animate api ..> hidden : "Failover"
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
  it('shows the base state in overview without dimming or edge labels', () => {
    const v = view(null);
    expect(v.stepIndex).toBeNull();
    expect(v.phases).toEqual([]);
    expect(v.nodes.every((n) => !n.dimmed && !n.focused)).toBe(true);
    expect(node(null, 'db')).toMatchObject({ badge: 'STANDBY' });
    expect(node(null, 'hidden')).toBeUndefined();
    expect(v.edges.every((e) => e.label === undefined && e.labelAt === undefined)).toBe(true);
  });

  it('applies state overrides and focus for the step', () => {
    expect(node(0, 'db')).toMatchObject({ badge: 'DOWN', focused: true });
    expect(node(0, 'client')).toMatchObject({ focused: true, dimmed: false });
  });

  it('does not carry state overrides across steps', () => {
    expect(node(0, 'db')).toMatchObject({ badge: 'DOWN' });
    expect(node(1, 'db')).toMatchObject({ badge: 'STANDBY' });
    expect(node(2, 'db')).toMatchObject({ badge: 'STANDBY' });
  });

  it('renders static labels only in the step that declares them, not on overview', () => {
    expect(edge(0, 'db->client')).toMatchObject({
      label: 'REPL',
      direction: 'bidirectional',
      active: true,
    });
    expect(edge(0, 'db->client')?.labelAt).toBeDefined();
    expect(edge(null, 'db->client')).toMatchObject({
      direction: 'bidirectional',
      style: 'solid',
      active: false,
    });
    expect(edge(null, 'db->client')?.label).toBeUndefined();
    expect(edge(2, 'db->client')).toBeUndefined();
  });

  it('preserves unanimous explicit edge colors in overview while keeping mixed step colors neutral', () => {
    const colorDsl = `
node a
node b
node c
node d
step "Normal" {
  animate a --> b : "Main"
  animate a ..> c : "Auth" [color: purple]
  static b ..> d : "Repl" [color: blue]
}
step "Failure" {
  animate a --> b : "503" [color: red]
  animate a ..> c : "Verify" [color: purple]
  static b ..> d : "Repl" [color: blue]
}
`;
    const colorDoc = parse(colorDsl).document;
    const overview = resolveView(colorDoc, computeLayout(colorDoc), null);
    const byId = new Map(overview.edges.map((e) => [e.id, e]));
    // Mixed default + red across steps stays neutral in overview.
    expect(byId.get('a->b')?.color).toBe('var(--dav-edge)');
    // Unanimous explicit colors across every occurrence are preserved in overview.
    expect(byId.get('a->c')?.color).toBe('purple');
    expect(byId.get('b->d')?.color).toBe('blue');
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

  it('reverses the path when a packet travels against a bidirectional connection', () => {
    const bidiDoc = parse(
      'node a\nnode b\nstep "S" {\n  animate a --> b\n  animate b --> a\n}\n',
    ).document;
    const bidiView = resolveView(bidiDoc, computeLayout(bidiDoc), 0);
    const packet = bidiView.phases[1]?.[0];
    const e = bidiView.edges.find((item) => item.id === 'a->b');
    expect(e?.direction).toBe('bidirectional');
    expect(packet && railEnds(packet.path).start).toEqual(e && railEnds(e.path).end);
    expect(e?.active).toBe(true);
  });

  it('makes animated endpoints and their edges visible for that step only', () => {
    expect(node(null, 'hidden')).toBeUndefined();
    expect(edge(null, 'api->hidden')).toBeUndefined();
    expect(node(1, 'hidden')).toBeDefined();
    expect(edge(1, 'api->hidden')).toMatchObject({ active: true, style: 'dashed' });
    expect(node(2, 'hidden')).toBeUndefined();
    expect(edge(2, 'api->hidden')).toBeUndefined();
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
      'node a\nnode b\nnode c\nstep "1" {\n  animate a --> b\n  animate b --> c\n}\nstep "2" {\n  desc "Nothing"\n}\n';
    const { document } = parse(dsl);
    const layout = computeLayout(document);
    expect(resolveView(document, layout, 1).edges.map((e) => e.id)).toEqual(['a->b', 'b->c']);
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

describe('buildScene', () => {
  it('renders every visible node, group and edge', () => {
    const scene = buildScene(view(0));
    const ids = findAll(scene, (e) => 'data-id' in e.attrs).map((e) => e.attrs['data-id']);
    expect(ids).toEqual(expect.arrayContaining(['vpc', 'api', 'db', 'client', 'client->api']));
    expect(collectText(scene)).toEqual(expect.arrayContaining(['REPL', 'DOWN']));

    const overviewScene = buildScene(view(null));
    expect(collectText(overviewScene)).not.toContain('REPL');
  });

  it('carries user text only as text nodes, never as markup', () => {
    const evil = parse(
      'node x "<img src=x onerror=alert(1)>" [sub: "</text><script>", badge: "\\"><b>"]\nstep "S" {}',
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
      'node a\nnode b\nstep "S" {\n  animate a --> b [icon: key, color: red]\n  animate a --> b\n}\n',
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
      'node a "A"\nnode b "B"\nstep "S" {\n  animate a --> b : "POST /v1/charges" [desc: "Edge WAF inspects payload and verifies mTLS before forwarding"]\n}\n',
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
      'node a [color: orange]\nnode b [color: yellow]\nstep "S" {\n  focus a\n  static a --> b [color: orange]\n  animate a --> b\n}\n',
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
      'node a [icon: database, badge: "A"]\nnode b [color: Red, badge: "B"]\nnode c [badge: "C"]\nstep "S" {}\n',
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

  it('clears a declared color with color: none in that step only', () => {
    const doc = parse(
      'node a [color: blue]\nnode b\nstep "1" {\n  state a [color: red]\n  state b [color: red]\n}\nstep "2" {\n  state a [color: none]\n  state b [color: none]\n}\nstep "3" {\n  focus a\n}\n',
    ).document;
    const layout = computeLayout(doc);
    const accent = (step: number, id: string) =>
      resolveView(doc, layout, step).nodes.find((n) => n.id === id)?.accent;
    expect([accent(0, 'a'), accent(0, 'b')]).toEqual(['red', 'red']);
    expect([accent(1, 'a'), accent(1, 'b')]).toEqual([undefined, undefined]);
    expect([accent(2, 'a'), accent(2, 'b')]).toEqual(['blue', undefined]);
  });

  it('routes a rail around stations in its way', () => {
    const doc = parse(
      'node a\nnode b\nnode c\nnode d\nstep "S" {\n  static a --> b\n  static b --> c\n  static a --> d\n  static d --> c\n  static a --> c\n}\n',
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
      'node a\nnode b\nnode c\nstep "S" {\n  static b --> c\n  animate a --> c\n}\n',
    ).document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), 0));
    const layers = scene.children.map((c) => (typeof c === 'string' ? '' : c.attrs.class));
    expect(layers.indexOf('dav-layer-flows')).toBe(layers.indexOf('dav-layer-edges') + 1);
    const rails = findAll(scene, (e) => String(e.attrs.class).startsWith('dav-edge'));
    expect(rails.flatMap((rail) => findAll(rail, (e) => e.attrs.class === 'dav-flow'))).toEqual([]);
    expect(findAll(scene, (e) => e.attrs.class === 'dav-flow')[0]?.attrs['data-edge']).toBe('a->c');
  });

  it('draws zone names above the rails', () => {
    const doc = parse(
      'group g "Zone" {\n  node a\n}\nnode b\nstep "S" {\n  animate a --> b\n}\n',
    ).document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), null));
    const layerOf = (name: string) =>
      scene.children.findIndex((c) => typeof c !== 'string' && c.attrs.class === name);
    const labels = scene.children[layerOf('dav-layer-labels')];
    expect(layerOf('dav-layer-labels')).toBeGreaterThan(layerOf('dav-layer-flows'));
    expect(labels && findAll(labels, (e) => e.attrs.class === 'dav-group-label')).toHaveLength(1);
  });

  it('makes a round trip only when the animate arrow is bidirectional', () => {
    const packetFor = (arrow: string) => {
      const doc = parse(`node a\nnode b\nstep "S" {\n  animate a ${arrow} b\n}\n`).document;
      const packet = resolveView(doc, computeLayout(doc), 0).phases[0]?.[0];
      if (!packet) throw new Error('missing packet');
      return packet;
    };

    const roundTrip = packetFor('<->');
    expect(packetPosition(roundTrip, 0)).toEqual(railEnds(roundTrip.path).start);
    expect(packetPosition(roundTrip, 0.5)).toEqual(railEnds(roundTrip.path).end);
    expect(packetPosition(roundTrip, 1)).toEqual(railEnds(roundTrip.path).start);

    const oneWay = packetFor('-->');
    expect(packetPosition(oneWay, 0.5)).not.toEqual(railEnds(oneWay.path).end);
    expect(packetPosition(oneWay, 1)).toEqual(railEnds(oneWay.path).end);
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
          // Where each zone's name is written.
          for (const group of view.groups) {
            const header = zoneNameArea(group.label, group.rect);
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

  const CLOSE_PARALLEL = `node a
node b
node c
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
            expect(overlap(a, b)).toBe(false);
          }
        });
      }
    });
  });

  it('marks only active edge labels for emphasis', () => {
    const doc = parse(
      'node a\nnode b\nnode c\nstep "S" {\n  static a --> b : "on"\n  static b --> c : "off"\n  animate a --> b\n}\n',
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
      'node a\nnode b\nstep "S" {\n  animate a --> b [color: red]\n  animate a --> b [color: blue]\n}\n',
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
      'node a\nnode b\nstep "S" {\n  animate a --> b [desc: "first\\n\\n  second\\nthird"]\n}\n',
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

  it('cuts and wraps a text by the style it is set in, and offers geometry helpers', () => {
    // A space before the ellipsis is dropped, except in code, where every column counts.
    expect(fitText('ab cdef', 10, 30)).toBe('ab…');
    expect(fitText('ab cdef', 10, 30, 'mono')).toBe('ab …');
    // Bold text is wider, so less of it fits.
    expect(fitText('abcdefghijklmnop', 10, 60)).toBe('abcdefghi…');
    expect(fitText('abcdefghijklmnop', 10, 60, 'bold')).toBe('abcdefgh…');
    // A line may break at an arrow.
    expect(wrapText('alpha→beta→gamma', 10, 45, 3)).toEqual(['alpha→', 'beta→', 'gamma']);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(round(12.34)).toBe(12.3);
  });

  it('keeps the child groups of a focused group undimmed', () => {
    const doc = parse(
      'group parent {\n  group child {}\n}\ngroup other {}\nnode a\nstep "S" {\n  focus parent\n}\n',
    ).document;
    const dimmed = (id: string) =>
      resolveView(doc, computeLayout(doc), 0).groups.find((g) => g.id === id)?.dimmed;
    expect(dimmed('parent')).toBe(false);
    expect(dimmed('child')).toBe(false);
    expect(dimmed('other')).toBe(true);
  });

  it('colors a running stop like its flow', () => {
    const doc = parse(
      'node a\nnode b\nnode c\nstep "S" {\n  animate a --> b\n  animate b --> c [color: red]\n}\n',
    ).document;
    const stops = findAll(
      buildScene(resolveView(doc, computeLayout(doc), 0)),
      (e) => e.attrs.class === 'dav-stop',
    );
    expect(stops.map((s) => s.attrs['data-active-fill'])).toEqual([
      'var(--dav-accent)',
      'var(--dav-c-red)',
    ]);
    expect(stops.map((s) => s.attrs['data-active-text'])).toEqual([
      'var(--dav-on-accent)',
      'var(--dav-bg)',
    ]);
  });

  it('starts two rails of one station at different points', () => {
    const doc = parse(
      'node a\nnode b\nnode c\nstep "S" {\n  static a --> b\n  static a --> c\n}\n',
    ).document;
    const v = resolveView(doc, computeLayout(doc), null);
    const [first, second] = v.edges;
    expect(first && railEnds(first.path).start).not.toEqual(second && railEnds(second.path).start);
  });

  it('runs opposite directions in reverse along the shared merged rail', () => {
    const doc = parse(
      'node a\nnode b\nstep "S" {\n  animate a --> b\n  animate b --> a\n}\n',
    ).document;
    const v = resolveView(doc, computeLayout(doc), 0);
    expect(v.edges).toHaveLength(1);
    const edge = v.edges[0];
    expect(edge).toMatchObject({ id: 'a->b', direction: 'bidirectional', active: true });
    const fwd = v.phases[0]?.[0];
    const back = v.phases[1]?.[0];
    expect(fwd && edge && railEnds(fwd.path).start).toEqual(edge && railEnds(edge.path).start);
    expect(back && edge && railEnds(back.path).start).toEqual(edge && railEnds(edge.path).end);
  });

  it('numbers the phases of a multi-phase step', () => {
    const scene = buildScene(view(0));
    const stops = findAll(scene, (e) => e.attrs.class === 'dav-stop');
    expect(stops.map((s) => s.attrs['data-phase'])).toEqual([0, 0, 1]);
    expect(findAll(buildScene(view(2)), (e) => e.attrs.class === 'dav-stop')).toEqual([]);
  });

  it('puts a callout next to its rail, off the stations and labels at its ends', () => {
    const doc = parse(
      'node a "A"\nnode b [icon: modal]\nstep "S" {\n  animate a --> b : "x" [desc: "long description"]\n}\n',
    ).document;
    const layout = computeLayout(doc);
    const stepView = resolveView(doc, layout, 0);
    const packet = stepView.phases[0]?.[0];
    const box = packet && computePacketCalloutBox(packet);
    if (!packet || !box) throw new Error('missing callout');
    const rect = {
      x: box.cx - box.halfW,
      y: box.boxTop,
      width: box.halfW * 2,
      height: box.boxBottom - box.boxTop,
    };
    for (const part of stepView.nodes.flatMap(nodeBody))
      expect(rectOverlaps(rect, part)).toBe(false);
    // Just above the rail, not above the cells of both nodes.
    const railY = pointAt(packet.path, 0.5).y;
    expect(railY - box.boxBottom).toBeGreaterThanOrEqual(21.9);
    expect(railY - box.boxBottom).toBeLessThan(40);
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
    const dsl = [...ICON_NAMES.map((icon, i) => `node n${i} [icon: ${icon}]`), 'step "S" {}'].join(
      '\n',
    );
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
    const { document, layout } = sourced(
      'node a\nnode b\nstep "S" {\n  animate a --> a\n  static a --> b\n}',
    );
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

  it('runs a packet around the loop and shares the self-loop rail with static', () => {
    const { document, layout } = sourced(
      'node a\nstep "s" {\n  static a ..> a : "check"\n  animate a --> a : "tick"\n}',
    );
    const view = resolveView(document, layout, 0);
    expect(view.edges).toHaveLength(1);
    const [loop] = view.edges;
    expect(loop).toMatchObject({ id: 'a->a', style: 'solid', active: true, label: 'check' });
    expect(loop?.labelAt).toBeDefined();
    expect(view.phases[0]?.[0]?.path).toEqual(loop?.path);
  });

  it('reserves room above the node, and keeps rows level and groups around the loop', () => {
    const plain = sourced('node a\nnode b\nstep "S" {\n  animate a --> b\n}').layout;
    const looped = sourced(
      'node a\nnode b\nstep "S" {\n  animate a --> a\n  animate a --> b\n}',
    ).layout;
    expect((looped.nodes.a as Rect).y).toBeGreaterThan((plain.nodes.a as Rect).y);
    expect((looped.nodes.a as Rect).y).toBe((looped.nodes.b as Rect).y);

    const grouped = sourced('group g { node a }\nstep "S" {\n  animate a --> a\n}').layout;
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
    ['one direction', 'animate a --> b\n  animate a --> b\n  animate a --> b'],
    ['both directions of a shared rail', 'animate a --> b\n  animate b --> a'],
    ['a self-loop', 'animate a --> a\n  animate a --> a\n  animate a --> a'],
  ])('keeps the numbers apart on %s', (_name, animations) => {
    const stops = stopCenters(`node a\nnode b\nstep "S" {\n  ${animations}\n}\n`);
    expect(stops.length).toBeGreaterThanOrEqual(2);
    expect(closestPair(stops)).toBeGreaterThanOrEqual(22);
  });

  it('keeps a lone number at the middle of its rail', () => {
    const { document } = parse(
      'node a\nnode b\nnode c\nstep "S" {\n  animate a --> b\n  animate b --> c\n}\n',
    );
    const view = resolveView(document, computeLayout(document), 0);
    const circle = findAll(buildScene(view), (e) => e.attrs.class === 'dav-stop')[0]?.children[0];
    const mid = pointAt(view.phases[0]?.[0]?.path as Rail, 0.5);
    expect((circle as VElement).attrs.cx).toBe(mid.x);
    expect((circle as VElement).attrs.cy).toBe(mid.y);
  });
});

describe('connections between stations', () => {
  const build = (dsl: string, step: number | null = null) => {
    const { document } = parse(dsl);
    return resolveView(document, computeLayout(document), step);
  };

  it('collapses multiple statements on the same pair into one merged overview rail', () => {
    const dsl = `node a
node b
step "1" {
  animate a ..> b
}
step "2" {
  animate b --> a
}
`;
    const overview = build(dsl, null);
    expect(overview.edges).toHaveLength(1);
    expect(overview.edges[0]).toMatchObject({
      id: 'a->b',
      style: 'solid',
      direction: 'bidirectional',
      active: false,
    });
    expect(overview.edges[0]?.label).toBeUndefined();

    const step0 = build(dsl, 0);
    expect(step0.edges[0]).toMatchObject({
      id: 'a->b',
      from: 'a',
      to: 'b',
      style: 'dashed',
      direction: 'forward',
      active: true,
    });
    const step1 = build(dsl, 1);
    expect(step1.edges[0]).toMatchObject({
      id: 'a->b',
      from: 'b',
      to: 'a',
      style: 'solid',
      direction: 'forward',
      active: true,
    });
    expect(step1.phases[0]?.[0]?.path).toEqual(step1.edges[0]?.path);
  });

  it('leaves a station level or upright, and meets the next one the same way', () => {
    const { document } = parse(
      'node a\nnode x\nnode y\nnode z\nstep "S" {\n  animate a --> x\n  animate a --> y\n  animate a --> z\n}\n',
    );
    const view = resolveView(document, computeLayout(document), null);
    expect(view.edges).toHaveLength(3);
    for (const edge of view.edges) {
      const { points } = edge.path as Route;
      for (let i = 0; i + 1 < points.length; i++) {
        const p = points[i];
        const q = points[i + 1];
        expect(p && q && (p.x === q.x || p.y === q.y)).toBe(true);
      }
    }
  });
});

describe('focus from state and static', () => {
  const stepView = (dsl: string, step = 0) => {
    const { document } = parse(dsl);
    return resolveView(document, computeLayout(document), step);
  };

  it('does not dim the diagram for a step that only hides something', () => {
    const view = stepView(
      'node a\nnode b\nnode c\nstep "0" {\n  animate a --> b\n}\nstep "1" {\n  state c [visible: false]\n}\n',
      1,
    );
    expect(view.nodes.map((n) => [n.id, n.dimmed])).toEqual([
      ['a', false],
      ['b', false],
    ]);
  });

  it('lights both nodes of a static connection and colors its line', () => {
    const view = stepView('node a\nnode b\nnode c\nstep "S" {\n  static a --> b [color: red]\n}\n');
    expect(view.nodes.map((n) => [n.id, n.dimmed])).toEqual([
      ['a', false],
      ['b', false],
      ['c', true],
    ]);
    expect(view.edges.map((e) => [e.id, e.color])).toEqual([['a->b', 'red']]);
  });

  it('still focuses an ordinary state target', () => {
    const view = stepView('node a\nnode b\nstep "S" {\n  state a [badge: "x"]\n}\n');
    expect(view.nodes.map((n) => [n.id, n.focused, n.dimmed])).toEqual([
      ['a', true, false],
      ['b', false, true],
    ]);
  });
});

describe('self-loop room', () => {
  it('is kept for a node placed under a child group', () => {
    const { document } = parse(
      'group o {\n  group i {\n    node b\n    node x\n    node y\n    node d\n  }\n  node c\n}\nstep "S" {\n  static b --> d\n  static x --> c\n  static y --> c\n  animate c --> c\n}\n',
    );
    const layout = computeLayout(document);
    const inner = layout.groups.i as Rect;
    const node = layout.nodes.c as Rect;
    expect(node.y - (inner.y + inner.height)).toBeGreaterThanOrEqual(58);
  });
});
