import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { SAMPLES } from '../../samples';
import {
  framePose,
  HOLD_MS,
  h,
  type Size,
  stepFrame,
  visibleWorld,
  wholeDiagramFrame,
} from '../../scene';
import { exportSvg, planCamera, schedule } from '../svg';
import { toXml } from '../xml';

const CANVAS: Size = { width: 960, height: 540 };

const STEPPED = `dav 1
title "Checkout"
node browser "Browser" [icon: browser]
node api "API" [icon: api]
node db "DB" [icon: database]
browser --> api : "HTTPS"
api --> db : "SQL"
step "Order" {
  animate browser --> api : "POST"
  animate api --> db : "Insert"
}
step "Nothing moves" {
  state db [badge: "down", color: red]
}
`;

function attrs(svg: string, tag: string): Array<Record<string, string>> {
  return [...svg.matchAll(new RegExp(`<${tag}\\s([^>]*?)/?>`, 'g'))].map((m) =>
    Object.fromEntries([...(m[1] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])),
  );
}

function sampleDsl(id: string): string {
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`no sample ${id}`);
  return sample.dsl;
}

describe('exportSvg', () => {
  it('draws a still picture of the whole diagram without steps', () => {
    const svg = exportSvg('dav 1\ntitle "Plain"\nnode a\nnode b\na --> b');

    expect(svg).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<svg xmlns=/);
    expect(svg).toContain('<title>Plain</title>');
    expect(svg).not.toContain('<animate');
  });

  it('draws a still picture when asked, even with steps', () => {
    expect(exportSvg(STEPPED, { animate: false })).not.toContain('<animate');
  });

  it('runs no script and requests nothing', () => {
    for (const sample of SAMPLES) {
      const svg = exportSvg(sample.dsl);
      expect(svg).not.toMatch(/<script|<foreignObject|\shref="(?!#)|url\((?!#)|@import/i);
    }
  });

  it('escapes user text', () => {
    const svg = exportSvg(
      'dav 1\ntitle "<script>alert(1)</script>"\nnode a "a & <c>"\nstep "</svg>" {\n  state a [badge: "x"]\n}',
    );

    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;/svg&gt;');
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(svg).toContain('a &amp; &lt;c&gt;');
  });

  it('loops over every step, each one its phases plus a hold', () => {
    const { document } = parse(STEPPED);
    const layout = computeLayout(document);
    const { steps, total } = schedule(document, layout);

    const [order, idle] = steps;
    const phases = order?.view.phaseDurations ?? [];
    expect(phases).toHaveLength(2);
    expect(order?.end).toBe(phases.reduce((sum, ms) => sum + ms, 0) + HOLD_MS);
    // The last phase stays on screen through the hold, as in the preview.
    expect(order?.phases[1]?.end).toBe(order?.end);
    expect(idle?.end).toBe(total);
    expect(total).toBe((order?.end ?? 0) + HOLD_MS);

    const durations = new Set(
      [
        ...attrs(exportSvg(STEPPED), 'animate'),
        ...attrs(exportSvg(STEPPED), 'animateTransform'),
      ].map((a) => a.dur),
    );
    expect([...durations]).toEqual([`${total}ms`]);
  });

  it.each(SAMPLES.map((s) => [s.id]))('writes consistent SMIL timing for %s', (id) => {
    const svg = exportSvg(sampleDsl(id));
    const animations = [...attrs(svg, 'animate'), ...attrs(svg, 'animateTransform')];
    expect(animations.length).toBeGreaterThan(0);
    for (const a of animations) {
      const values = (a.values ?? '').split(';');
      const times = (a.keyTimes ?? '').split(';').map(Number);
      expect(times).toHaveLength(values.length);
      expect(times[0]).toBe(0);
      // Only interpolated values must reach the end; a discrete one holds its last value.
      if (a.calcMode !== 'discrete') expect(times[times.length - 1]).toBe(1);
      expect(times[times.length - 1]).toBeLessThanOrEqual(1);
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1] ?? 0);
      }
      if (a.calcMode === 'spline') {
        expect((a.keySplines ?? '').split(';')).toHaveLength(values.length - 1);
      }
      if (a.calcMode === 'discrete') {
        expect(values.every((v) => v === 'inline' || v === 'none')).toBe(true);
      }
    }
  });

  it('shows the first moment to viewers that do not run SMIL', () => {
    const svg = exportSvg(STEPPED);
    // The first step's header is visible from the start, the second one's is not.
    const headers = [
      ...svg.matchAll(/<g( display="none")?><text[^>]*class="dav-mono"[^>]*>(Step \d)/g),
    ];
    expect(headers.map((m) => [m[2], m[1] === undefined])).toEqual([
      ['Step 1', true],
      ['Step 2', false],
    ]);
  });

  it('labels steps in the chosen language', () => {
    expect(exportSvg(STEPPED, { locale: 'ja' })).toContain('ステップ 1 / 2');
  });
});

describe('planCamera', () => {
  it('starts each step where the preview frames it', () => {
    const { document } = parse(STEPPED);
    const layout = computeLayout(document);
    const { steps } = schedule(document, layout);

    const first = steps[0];
    if (!first) throw new Error('no step');

    const events = planCamera(CANVAS, layout, steps);

    expect(events[0]).toEqual([
      0,
      framePose(
        CANVAS,
        stepFrame(CANVAS, layout, first.view, { follow: first.phases[0]?.packets ?? [] }),
      ),
    ]);
    expect(events.map(([t]) => t)).toContain(steps[1]?.start);
  });

  it('moves closer than the whole diagram on a wide one', () => {
    const { document } = parse(sampleDsl('enterprise-zero-trust-10anim'));
    const layout = computeLayout(document);
    const { steps } = schedule(document, layout);
    const first = steps[0];
    if (!first) throw new Error('no step');
    const whole = wholeDiagramFrame(layout, first.view).rect;

    const worlds = planCamera(CANVAS, layout, steps).map(([, pose]) => visibleWorld(CANVAS, pose));

    expect(worlds.length).toBeGreaterThan(steps.length);
    expect(worlds.some((w) => w.width < whole.width * 0.8)).toBe(true);
  });
});

describe('toXml', () => {
  it('escapes text and attribute values', () => {
    expect(toXml(h('text', { 'data-x': '"<&>' }, '</text><script>'))).toBe(
      '<text data-x="&quot;&lt;&amp;&gt;">&lt;/text&gt;&lt;script&gt;</text>',
    );
  });

  it('drops characters XML does not allow', () => {
    expect(toXml(h('text', {}, 'a\u0000b\u0008c'))).toBe('<text>abc</text>');
  });

  it('rejects element and attribute names that a scene never builds', () => {
    expect(() => toXml(h('a b', {}))).toThrow();
    expect(() => toXml(h('g', { 'on load': 'x' }))).toThrow();
  });
});
