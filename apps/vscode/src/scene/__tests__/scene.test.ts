import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { ICON_NAMES } from '../../model/types';
import { SAMPLE_TEMPLATES } from '../../samples';
import { pointAt } from '../geometry';
import {
  buildPacket,
  buildScene,
  computePacketCalloutBox,
  packetPosition,
  resolveView,
  type VElement,
  type VNode,
} from '../index';

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

  it('dims edges that are not part of the focus', () => {
    expect(edge(0, 'client->api')?.dimmed).toBe(false);
    expect(edge(2, 'client->api')?.dimmed).toBe(true);
    expect(edge(2, 'api->db')?.dimmed).toBe(false);
  });

  it('is deterministic regardless of navigation order', () => {
    expect(view(2)).toEqual(view(2));
    expect(JSON.stringify(view(1))).toBe(JSON.stringify(resolveView(document, layout, 1)));
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

  it('renders a stationary speech-bubble callout whose pointer tip tracks the moving dot', () => {
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

    // Text elements stay stationary while bubble tail path and dot transform move from t=0 to t=1
    const label0 = findAll(v0, (e) => e.attrs.class === 'dav-packet-label')[0];
    const label1 = findAll(v1, (e) => e.attrs.class === 'dav-packet-label')[0];
    expect(label0?.attrs).toEqual(label1?.attrs);

    const bubble0 = findAll(v0, (e) => e.attrs.class === 'dav-packet-bubble')[0];
    const bubble1 = findAll(v1, (e) => e.attrs.class === 'dav-packet-bubble')[0];
    expect(bubble0?.attrs.d).not.toEqual(bubble1?.attrs.d);

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
        for (const packet of resolveView(doc, l, i).phases.flat()) {
          const box = computePacketCalloutBox(packet);
          if (!box) continue;
          for (const area of packet.labelAreas) {
            const overlaps =
              box.cx - box.halfW < area.x + area.width &&
              box.cx + box.halfW > area.x &&
              box.boxTop < area.y + area.height &&
              box.boxBottom > area.y;
            expect(overlaps).toBe(false);
          }
        }
      });
    },
  );

  it('marks only active edge labels for emphasis', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\nnode c\na --> b : "on"\nb --> c : "off"\nstep "S" {\n  animate a --> b\n}\n',
    ).document;
    const scene = buildScene(resolveView(doc, computeLayout(doc), 0));
    const [on, off] = findAll(scene, (e) => String(e.attrs.class).startsWith('dav-edge-label')).map(
      (g) => findAll(g, (e) => e.tag === 'text')[0]?.attrs,
    );
    expect(on?.['data-active-fill']).toBe('var(--dav-accent-text)');
    expect(on?.['data-edge']).toBe('a->b');
    expect(off?.['data-active-fill']).toBeUndefined();
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

  it('renders all 25 built-in icons', () => {
    const dsl = ['dav 1', ...ICON_NAMES.map((icon, i) => `node n${i} [icon: ${icon}]`)].join('\n');
    const { document, diagnostics } = parse(dsl);
    expect(diagnostics).toEqual([]);
    const scene = buildScene(resolveView(document, computeLayout(document), null));
    const stations = findAll(scene, (e) => e.attrs.class === 'dav-station');
    expect(stations).toHaveLength(25);
  });
});
