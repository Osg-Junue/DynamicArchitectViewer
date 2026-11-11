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

  it('accepts an already-parsed document without re-parsing', () => {
    const { document } = parse(STEPPED);
    expect(exportSvg(document)).toBe(exportSvg(STEPPED));
  });

  it('links <desc> via aria-describedby only when a description is present', () => {
    const animated = exportSvg(STEPPED);
    expect(animated).toContain('aria-describedby="dav-desc"');
    expect(animated).toContain('<desc id="dav-desc">1. Order\n2. Nothing moves</desc>');

    const still = exportSvg(STEPPED, { animate: false });
    expect(still).not.toContain('aria-describedby');
    expect(still).not.toContain('<desc');
  });

  it('inlines only compacted scene styles scoped to .dav-svg', () => {
    const svg = exportSvg('dav 1\ntitle "Plain"\nnode a\nnode b\na --> b');
    const style = /<style>([\s\S]*?)<\/style>/.exec(svg)?.[1] ?? '';

    expect(style).toContain('.dav-svg{');
    expect(style).not.toMatch(/:root\b|(^|\})svg\{|\/\*|\n/);
    expect(style).not.toMatch(/\.dav-(app|topbar|btn|playback-bar|dock|timeline|zone-hud)\b/);
    expect(Buffer.byteLength(style, 'utf8')).toBeLessThan(2500);
  });

  it('paints translucent zones and minimap areas with fill-opacity rather than color-mix', () => {
    const svg = exportSvg(sampleDsl('enterprise-zero-trust-10anim'));

    expect(svg).not.toContain('fill="color-mix(');
    expect(svg).toContain('fill-opacity="0.55"');
    expect(svg).toMatch(/fill-opacity="0\.(14|07)"/);
  });

  it('fills a phase-free step ruler bar immediately without a width animation', () => {
    const svg = exportSvg('dav 1\nnode a\nstep "Idle" {\n  state a [badge: "ok"]\n}\n');

    expect(svg).toContain('width="960" height="3" fill="var(--dav-accent)"');
    expect(svg).not.toContain('attributeName="width"');
  });

  it('frames Step 1 from t=0 on both the canvas and the minimap', () => {
    const svg = exportSvg(sampleDsl('enterprise-zero-trust-10anim'));
    const canvasSvg = attrs(svg, 'svg').find((a) => a.preserveAspectRatio === 'xMidYMid meet');
    const viewBoxAnim = attrs(svg, 'animate').find((a) => a.attributeName === 'viewBox');
    const minimapRect = attrs(svg, 'rect').find((a) => a.class === 'dav-minimap-view');

    expect(canvasSvg?.viewBox).toBeDefined();
    const keyframes = (viewBoxAnim?.values ?? '').split(';');
    // Camera starts already on Step 1 and holds it until the next camera event (no t=0 fly-in).
    expect(keyframes[0]).toBe(canvasSvg?.viewBox);
    expect(keyframes[1]).toBe(canvasSvg?.viewBox);
    expect(keyframes[keyframes.length - 1]).not.toBe(canvasSvg?.viewBox);

    expect(`${minimapRect?.x} ${minimapRect?.y} ${minimapRect?.width} ${minimapRect?.height}`).toBe(
      canvasSvg?.viewBox,
    );
  });

  it('keeps zone names inside the visible viewBox as the camera zooms into a wide zone', () => {
    const wideZone = [
      'dav 1',
      'group g "Wide Zone" {',
      '  group inner "Inner Zone" {',
      ...Array.from({ length: 8 }, (_, i) => `    node n${i} "Node ${i}"`),
      '  }',
      '}',
      ...Array.from({ length: 7 }, (_, i) => `n${i} --> n${i + 1}`),
      'step "Right end" {',
      '  focus n7',
      '}',
      'step "Left end" {',
      '  focus n0',
      '}',
    ].join('\n');

    const svg = exportSvg(wideZone);
    const canvasSvg = attrs(svg, 'svg').find((a) => a.preserveAspectRatio === 'xMidYMid meet');
    const [vx = 0, vy = 0, vw = 0, vh = 0] = (canvasSvg?.viewBox ?? '').split(' ').map(Number);

    expect(svg).toContain('class="dav-layer-zone-labels"');
    const labels = attrs(svg, 'text').filter((a) => a.class === 'dav-group-label');
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(Number(label.x)).toBeGreaterThanOrEqual(vx);
      expect(Number(label.x)).toBeLessThanOrEqual(vx + vw);
      expect(Number(label.y)).toBeGreaterThanOrEqual(vy);
      expect(Number(label.y)).toBeLessThanOrEqual(vy + vh);
    }
    // Nested zone name stays below its enclosing zone's name, and slides horizontally between steps.
    expect(Number(labels[1]?.y)).toBeGreaterThanOrEqual(Number(labels[0]?.y) + 24);
    expect(svg).toContain('attributeName="x"');
  });

  it('hides exiting nested zone names before an enclosing label slides over them and omits flat tracks', () => {
    const nestedPan = [
      'dav 1',
      'node hub "Hub"',
      'group outer "Outer Zone" {',
      '  group mid "Middle Zone" {',
      '    group inner "Inner Zone" {',
      '      node n1 "Top"',
      '    }',
      '    node n2 "Mid"',
      '  }',
      '  group lower "Lower Zone" {',
      ...Array.from({ length: 6 }, (_, i) => `    node n${i + 3} "Row ${i + 3}"`),
      '  }',
      '}',
      ...Array.from({ length: 8 }, (_, i) => `hub --> n${i + 1}`),
      'step "Top" {',
      '  focus n1',
      '}',
      'step "Bottom" {',
      '  focus n8',
      '}',
    ].join('\n');

    const svg = exportSvg(nestedPan);
    const zoneLayer =
      /<g class="dav-layer-zone-labels">([\s\S]*?)<\/g><g class="dav-layer-packets"/.exec(
        svg,
      )?.[1] ?? '';
    expect(zoneLayer.length).toBeGreaterThan(0);

    // Inner zone leaves its room as soon as the downward pan starts, so no dimmed Step 2 copy is emitted.
    expect(zoneLayer).not.toContain('class="dav-group dav-dimmed" data-id="inner"');
    // Branches whose visible span has a constant coordinate emit no <animate attributeName="y">.
    expect(zoneLayer).toContain(
      '<g class="dav-group" data-id="mid"><text x="319.3" y="212.1" class="dav-group-label" font-size="16" fill="var(--dav-fg)">Middle Zone</text>',
    );
    expect(zoneLayer).toContain(
      '<g class="dav-group dav-dimmed" data-id="lower"><text x="324.7" y="538" class="dav-group-label" font-size="16" fill="var(--dav-fg)">Lower Zone</text>',
    );
  });

  it('omits coordinate animations when every step shares the same zoomed-in camera pose', () => {
    const staticZoom = [
      'dav 1',
      'group z1 "Zone 1" { node n0 "N0" }',
      'group z2 "Zone 2" {',
      ...Array.from({ length: 8 }, (_, i) => `  node m${i} "M${i}"`),
      '}',
      ...Array.from({ length: 7 }, (_, i) => `m${i} --> m${i + 1}`),
      'step "S1" { focus n0 }',
      'step "S2" {',
      '  focus n0',
      '  state n0 [badge: "2"]',
      '}',
    ].join('\n');

    const svg = exportSvg(staticZoom);
    expect(svg).toContain('class="dav-minimap-view"');
    expect(svg).toContain('class="dav-layer-zone-labels"');
    const animatedAttrs = attrs(svg, 'animate').map((a) => a.attributeName);
    expect(animatedAttrs.every((name) => name === 'display')).toBe(true);
  });

  it.each(SAMPLES.map((s) => [s.id]))(
    'matches root height attribute to viewBox height for %s',
    (id) => {
      const svg = exportSvg(sampleDsl(id));
      const root = attrs(svg, 'svg')[0];
      expect(root?.width).toBe('960');
      expect(root?.height).toMatch(/^\d+$/);
      expect(root?.viewBox).toBe(`0 0 960 ${root?.height}`);
    },
  );
});

describe("exportSvg with camera: 'whole'", () => {
  const rootOf = (svg: string) => attrs(svg, 'svg')[0];
  const canvasOf = (svg: string) =>
    attrs(svg, 'svg').find((a) => a.preserveAspectRatio === 'xMidYMid meet');

  it('keeps the camera still while the flows play', () => {
    const svg = exportSvg(STEPPED, { camera: 'whole' });

    expect(svg).toContain('<animate');
    expect(attrs(svg, 'animate').map((a) => a.attributeName)).not.toContain('viewBox');
    expect(svg).not.toContain('class="dav-minimap-view"');
  });

  it('frames everything every step draws', () => {
    const dsl = sampleDsl('enterprise-zero-trust-10anim');
    const { document } = parse(dsl);
    const layout = computeLayout(document);
    const { steps } = schedule(document, layout);
    const [vx = 0, vy = 0, vw = 0, vh = 0] = (
      canvasOf(exportSvg(dsl, { camera: 'whole' }))?.viewBox ?? ''
    )
      .split(' ')
      .map(Number);

    for (const step of steps) {
      const r = wholeDiagramFrame(layout, step.view).rect;
      expect(r.x).toBeGreaterThanOrEqual(vx - 0.1);
      expect(r.y).toBeGreaterThanOrEqual(vy - 0.1);
      expect(r.x + r.width).toBeLessThanOrEqual(vx + vw + 0.1);
      expect(r.y + r.height).toBeLessThanOrEqual(vy + vh + 0.1);
    }
  });

  it('sizes the canvas to the diagram instead of a fixed 960 × 540', () => {
    const flat = exportSvg(STEPPED, { camera: 'whole' });
    const follow = exportSvg(STEPPED);

    expect(canvasOf(flat)?.width).toBe('960');
    expect(Number(canvasOf(flat)?.height)).toBeLessThan(540);
    expect(canvasOf(follow)?.height).toBe('540');
    expect(rootOf(flat)?.viewBox).toBe(`0 0 960 ${rootOf(flat)?.height}`);
  });

  it('keeps a very tall diagram within a readable height', () => {
    const tall = [
      'dav 1',
      ...Array.from({ length: 30 }, (_, i) => `node n${i}`),
      'step "Go" {',
      '  state n0 [badge: "x"]',
      '}',
    ].join('\n');

    expect(Number(canvasOf(exportSvg(tall, { camera: 'whole' }))?.height)).toBeLessThanOrEqual(
      1200,
    );
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

  it('drops lone surrogates and U+FFFE/U+FFFF while preserving emoji and CJK surrogate pairs', () => {
    const input = 'Rocket 🚀 Kanji 𠮷\t\n\r\uD800\uDC00_lone:\uD800!\uDC00?\uFFFE\uFFFF';
    // Note: adjacent \uD800\uDC00 forms valid U+10000 (𐀀); separated \uD800 and \uDC00 are lone surrogates.
    expect(toXml(h('text', { 'aria-label': '🚀 𠮷 \uD83D!\uDE80' }, input))).toBe(
      '<text aria-label="🚀 𠮷 !">Rocket 🚀 Kanji 𠮷\t\n\r𐀀_lone:!?</text>',
    );
  });

  it('rejects element and attribute names that a scene never builds', () => {
    expect(() => toXml(h('a b', {}))).toThrow();
    expect(() => toXml(h('g', { 'on load': 'x' }))).toThrow();
  });
});
