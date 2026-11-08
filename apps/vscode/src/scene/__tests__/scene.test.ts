import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { SAMPLE_TEMPLATES } from '../../samples';
import { buildPacket, buildScene, resolveView, type VElement, type VNode } from '../index';

const DSL = `dav 1
title "T"
group vpc {
  node api
  node db [status: muted, badge: "STANDBY"]
}
node client [icon: browser]
node hidden [visible: false]
client --> api : "HTTPS"
api --> db
api -.-> hidden [id: failover, visible: false]
client <--> db

step "one" {
  focus client
  state db [status: error, badge: "DOWN"]
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
    expect(node(null, 'db')).toMatchObject({ status: 'muted', badge: 'STANDBY' });
    expect(node(null, 'hidden')).toBeUndefined();
  });

  it('applies state overrides and focus for the step', () => {
    expect(node(0, 'db')).toMatchObject({ status: 'error', badge: 'DOWN', focused: true });
    expect(node(0, 'client')).toMatchObject({ focused: true, dimmed: false });
  });

  it('accumulates state overrides across steps', () => {
    expect(node(1, 'db')).toMatchObject({ status: 'error', badge: 'DOWN' });
    expect(node(2, 'db')).toMatchObject({ status: 'error', badge: 'DOWN' });
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

  it('renders a speech-bubble callout with wrapped description on packets', () => {
    const doc = parse(
      'dav 1\nnode a "A"\nnode b "B"\na --> b\nstep "S" {\n  animate a --> b : "POST /v1/charges" [desc: "Edge WAF inspects payload and verifies mTLS before forwarding"]\n}\n',
    ).document;
    const pkt = resolveView(doc, computeLayout(doc), 0).phases[0]?.[0];
    expect(pkt).toBeDefined();
    if (!pkt) return;
    const vnode = buildPacket(pkt);
    const callouts = findAll(vnode, (e) => e.attrs.class === 'dav-packet-callout');
    expect(callouts).toHaveLength(1);
    const texts = collectText(vnode).join(' ');
    expect(texts).toContain('POST /v1/charges');
    expect(texts).toContain('Edge WAF inspects payload');
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
});
