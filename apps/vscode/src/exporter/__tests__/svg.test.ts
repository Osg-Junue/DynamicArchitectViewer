import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { SAMPLE_TEMPLATES } from '../../samples';
import {
  calloutRect,
  computePacketCalloutBox,
  cornerShares,
  framePose,
  HOLD_MS,
  h,
  pointAt,
  resolveView,
  round,
  type Size,
  stepFrame,
  visibleWorld,
  wholeDiagramFrame,
} from '../../scene';
import { exportSvg, planCamera, schedule } from '../svg';
import { escapeHtml, toXml } from '../xml';

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
  const sample = SAMPLE_TEMPLATES.find((s) => s.id === id);
  if (!sample) throw new Error(`no sample ${id}`);
  return sample.dsl;
}

describe('exportSvg', () => {
  it('takes a packet round the corner of its rail instead of cutting across it', () => {
    const dsl =
      'dav 1\nnode a\nnode b\nnode c\na --> b\na --> c\nstep "S" {\n  animate a --> c\n}\n';
    const doc = parse(dsl).document;
    const packet = resolveView(doc, computeLayout(doc), 0).phases[0]?.[0];
    if (!packet) throw new Error('missing packet');
    const corners = cornerShares(packet.path);
    expect(corners.length).toBeGreaterThan(0);
    const svg = exportSvg(dsl);
    // The packet's recorded positions include the start, the middle and the end of each corner.
    for (const share of corners) {
      const { x, y } = pointAt(packet.path, share);
      expect(svg).toContain(`${round(x)},${round(y)}`);
    }
  });

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
    for (const sample of SAMPLE_TEMPLATES) {
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

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id]))('writes consistent SMIL timing for %s', (id) => {
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
      '<g class="dav-group" data-id="mid"><text x="319.3" y="246.1" class="dav-group-label" font-size="16" fill="var(--dav-fg)">Middle Zone</text>',
    );
    expect(zoneLayer).toContain(
      '<g class="dav-group dav-dimmed" data-id="lower"><text x="324.7" y="572" class="dav-group-label" font-size="16" fill="var(--dav-fg)">Lower Zone</text>',
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

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id]))(
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

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id]))(
    'frames every node, group and packet callout for %s',
    (id) => {
      const dsl = sampleDsl(id);
      const { document } = parse(dsl);
      const layout = computeLayout(document);
      const { steps } = schedule(document, layout);
      const [vx = 0, vy = 0, vw = 0, vh = 0] = (
        canvasOf(exportSvg(dsl, { camera: 'whole' }))?.viewBox ?? ''
      )
        .split(' ')
        .map(Number);

      for (const r of [...Object.values(layout.nodes), ...Object.values(layout.groups)]) {
        expect(r.x).toBeGreaterThanOrEqual(vx);
        expect(r.y).toBeGreaterThanOrEqual(vy);
        expect(r.x + r.width).toBeLessThanOrEqual(vx + vw);
        expect(r.y + r.height).toBeLessThanOrEqual(vy + vh);
      }

      const callouts = steps
        .flatMap((step) => step.view.phases.flat())
        .flatMap((packet) => computePacketCalloutBox(packet) ?? [])
        .map(calloutRect);
      expect(callouts.length).toBeGreaterThan(0);
      for (const r of callouts) {
        expect(r.x).toBeGreaterThanOrEqual(vx);
        expect(r.y).toBeGreaterThanOrEqual(vy);
        expect(r.x + r.width).toBeLessThanOrEqual(vx + vw);
        expect(r.y + r.height).toBeLessThanOrEqual(vy + vh);
      }
    },
  );

  it.each([
    ['event-driven-async', 2],
    ['lan-office-network', 2],
    ['lan-office-network', 4],
  ] as const)('keeps unshifted top-edge callouts inside viewBox for %s step %i', (id, step) => {
    const dsl = sampleDsl(id);
    const { document } = parse(dsl);
    const layout = computeLayout(document);
    const { steps } = schedule(document, layout, step);
    const [vx = 0, vy = 0, vw = 0, vh = 0] = (
      canvasOf(exportSvg(dsl, { step, camera: 'whole' }))?.viewBox ?? ''
    )
      .split(' ')
      .map(Number);

    const callouts = steps
      .flatMap((s) => s.view.phases.flat())
      .flatMap((packet) => computePacketCalloutBox(packet) ?? [])
      .map(calloutRect);
    expect(callouts.length).toBeGreaterThan(0);
    for (const r of callouts) {
      expect(r.x).toBeGreaterThanOrEqual(vx);
      expect(r.y).toBeGreaterThanOrEqual(vy);
      expect(r.x + r.width).toBeLessThanOrEqual(vx + vw);
      expect(r.y + r.height).toBeLessThanOrEqual(vy + vh);
    }
  });

  it('fits every node of a >6400px wide diagram without clamping zoom or showing a minimap', () => {
    const veryWide = [
      'dav 1',
      'group z "Zone" {',
      ...Array.from({ length: 65 }, (_, i) => `  node n${i} "Node ${i}"`),
      '}',
      ...Array.from({ length: 64 }, (_, i) => `n${i} --> n${i + 1}`),
      'step "Traverse" {',
      '  animate n0 --> n1 : "Hop"',
      '}',
    ].join('\n');

    const { document } = parse(veryWide);
    const layout = computeLayout(document);
    const { steps } = schedule(document, layout);
    const first = steps[0];
    if (!first) throw new Error('no step');
    expect(wholeDiagramFrame(layout, first.view).rect.width).toBeGreaterThan(6400);

    for (const svg of [
      exportSvg(veryWide, { camera: 'whole' }),
      exportSvg(veryWide, { step: 0, animate: false }),
    ]) {
      expect(svg).not.toContain('class="dav-minimap-view"');
      const [vx = 0, vy = 0, vw = 0, vh = 0] = (canvasOf(svg)?.viewBox ?? '')
        .split(' ')
        .map(Number);
      for (const r of [...Object.values(layout.nodes), ...Object.values(layout.groups)]) {
        expect(r.x).toBeGreaterThanOrEqual(vx);
        expect(r.y).toBeGreaterThanOrEqual(vy);
        expect(r.x + r.width).toBeLessThanOrEqual(vx + vw);
        expect(r.y + r.height).toBeLessThanOrEqual(vy + vh);
      }
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

describe('exportSvg with step', () => {
  const rootOf = (svg: string) => attrs(svg, 'svg')[0];
  const canvasOf = (svg: string) =>
    attrs(svg, 'svg').find((a) => a.preserveAspectRatio === 'xMidYMid meet');

  it('plays only that step, under its number in the diagram', () => {
    const { document } = parse(STEPPED);
    const layout = computeLayout(document);
    const only = schedule(document, layout, 0);
    const svg = exportSvg(STEPPED, { step: 0 });
    const transforms = attrs(svg, 'animateTransform');

    expect(only.steps.map((s) => s.index)).toEqual([0]);
    expect(only.total).toBe(schedule(document, layout).steps[0]?.end);
    expect(svg).toContain('Step 1 / 2');
    expect(svg).not.toContain('Step 2 / 2');
    expect(svg).toContain('<desc id="dav-desc">1. Order</desc>');
    expect(transforms.length).toBeGreaterThan(0);
    expect(new Set([...attrs(svg, 'animate'), ...transforms].map((a) => a.dur))).toEqual(
      new Set([`${only.total}ms`]),
    );
  });

  it('combines single-step playback with camera: whole', () => {
    const dsl = sampleDsl('enterprise-zero-trust-10anim');
    const followOne = exportSvg(dsl, { step: 0 });
    const wholeOne = exportSvg(dsl, { step: 0, camera: 'whole' });
    const stillOne = exportSvg(dsl, { step: 0, animate: false });

    expect(followOne).toContain('class="dav-minimap-view"');
    expect(wholeOne).toContain('Step 1 / ');
    expect(wholeOne).not.toContain('Step 2 / ');
    expect(wholeOne).not.toMatch(/font-size="10.5"/);
    expect(wholeOne).toContain('<animateTransform');
    expect(attrs(wholeOne, 'animate').map((a) => a.attributeName)).not.toContain('viewBox');
    expect(wholeOne).not.toContain('class="dav-minimap-view"');
    expect(canvasOf(wholeOne)?.viewBox).toBe(canvasOf(stillOne)?.viewBox);
  });

  it('leaves out the step ruler', () => {
    const one = exportSvg(STEPPED, { step: 0 });
    // The ruler numbers every step from 01.
    expect(exportSvg(STEPPED)).toMatch(/class="dav-mono" font-size="10.5"[^>]*>01</);
    expect(one).not.toMatch(/font-size="10.5"/);
  });

  it('omits the 36px zone strip when a step only animates between ungrouped nodes', () => {
    const partialZone = [
      'dav 1',
      'node client "Client"',
      'node edge "Edge"',
      'group backend "Backend" {',
      '  node db "DB"',
      '}',
      'client --> edge',
      'edge --> db',
      'step "Outside" {',
      '  animate client --> edge : "Ping"',
      '}',
      'step "Into zone" {',
      '  animate edge --> db : "Query"',
      '}',
    ].join('\n');

    const outsideFollow = exportSvg(partialZone, { step: 0 });
    const intoZoneFollow = exportSvg(partialZone, { step: 1 });
    const outside = exportSvg(partialZone, { step: 0, camera: 'whole' });
    const intoZone = exportSvg(partialZone, { step: 1, camera: 'whole' });

    expect(outsideFollow).not.toContain('● </tspan>');
    expect(outside).not.toContain('● </tspan>');
    expect(intoZoneFollow).toContain('● </tspan>');
    expect(intoZone).toContain('● </tspan>');
    expect(Number(canvasOf(intoZoneFollow)?.y) - Number(canvasOf(outsideFollow)?.y)).toBe(36);
    expect(Number(canvasOf(intoZone)?.y) - Number(canvasOf(outside)?.y)).toBe(36);
  });

  it('draws a still step with its state and every flow lit, and nothing animated', () => {
    const order = exportSvg(STEPPED, { step: 0, animate: false });
    const failed = exportSvg(STEPPED, { step: 1, animate: false });

    expect(order).not.toContain('<animate');
    expect(order).toContain('Step 1 / 2');
    expect(attrs(order, 'path').filter((a) => a.class === 'dav-flow')).toHaveLength(2);
    // State carries over from earlier steps, as in the preview.
    expect(failed).toContain('>down</text>');
    expect(attrs(failed, 'path').filter((a) => a.class === 'dav-flow')).toHaveLength(0);
  });

  it('draws the still-step header divider at head.height + 0.5 after the header background', () => {
    const still = exportSvg(STEPPED, { step: 0, animate: false });
    const wholeAnim = exportSvg(STEPPED, { step: 0, camera: 'whole' });
    const canvas = canvasOf(still);
    const headHeight = Number(canvas?.y) - 1;
    const divider = `<path d="M 0 ${headHeight + 0.5} H 960" stroke="var(--dav-border)"/>`;

    expect(still).toContain(
      `<g><rect x="0" y="0" width="960" height="${headHeight}" fill="var(--dav-bg)"/>`,
    );
    expect(still).toContain(divider);
    expect(still).not.toContain(`<path d="M 0 ${headHeight} H 960"`);
    expect(still.indexOf(divider)).toBeGreaterThan(still.indexOf('Step 1 / 2'));
    expect(rootOf(still)?.height).toBe(String(headHeight + 1 + Number(canvas?.height)));
    expect(rootOf(still)?.height).toBe(rootOf(wholeAnim)?.height);
  });

  it('omits a trailing dot and space in <desc> when a step has an empty title', () => {
    const untitled = [
      'dav 1',
      'node a',
      'node b',
      'a --> b',
      'step "" {',
      '  animate a --> b : "Go"',
      '}',
      'step "Named" {',
      '  state b [badge: "ok"]',
      '}',
    ].join('\n');

    expect(exportSvg(untitled)).toContain('<desc id="dav-desc">1\n2. Named</desc>');
    expect(exportSvg(untitled, { step: 0 })).toContain('<desc id="dav-desc">1</desc>');
    expect(exportSvg(untitled, { step: 0, animate: false })).toContain(
      '<desc id="dav-desc">1</desc>',
    );
  });

  it('rejects a step the diagram does not have', () => {
    expect(() => exportSvg(STEPPED, { step: 2 })).toThrow(RangeError);
    expect(() => exportSvg(STEPPED, { step: -1, animate: false })).toThrow(RangeError);
    expect(() => exportSvg(STEPPED, { step: 0.5 })).toThrow(RangeError);
    expect(() => exportSvg(STEPPED, { step: Number.NaN })).toThrow(RangeError);
    expect(() => exportSvg(STEPPED, { step: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => exportSvg(STEPPED, { step: Number.NEGATIVE_INFINITY, animate: false })).toThrow(
      RangeError,
    );
    expect(() => exportSvg('dav 1\nnode a', { step: 0 })).toThrow(RangeError);
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

  it('frames tall and parallel code callouts inside the exported SVG viewBox in both camera modes', () => {
    const { document } = parse(
      [
        'dav 1',
        'title "Code Export"',
        'group client "Browser" { node web "Web" [icon: browser] }',
        'group edge "Edge" { node api "Order API" [icon: api] }',
        'group data "Data" { node db "Primary DB" [icon: database] }',
        'web --> api : "HTTPS"',
        'api --> db : "SQL"',
        'step "No code" {',
        '  animate web --> api : "GET /health" [desc: "ヘルスチェック"]',
        '}',
        'step "With code" {',
        '  animate web --> api : "POST /v1/orders" [desc: "注文送信 — 金額 ¥14,800 → 決済開始…"]',
        '  animate api --> db : "INSERT orders" [parallel: true, desc: "トランザクション書込"]',
        '}',
      ].join('\n'),
    );
    const step1 = document.steps[1];
    if (!step1?.animations[0] || !step1.animations[1]) throw new Error('missing step animations');
    step1.animations[0].code = {
      lang: 'json',
      title: 'Order Request',
      body: '{\n  "orderId": "ord_01J9X",\n  "amount": 14800,\n  "items": ["sku_1", "sku_2"]\n}',
    };
    step1.animations[1].code = {
      lang: 'sql',
      body: 'INSERT INTO orders (id, amount)\nVALUES ($1, 14800);',
    };

    const svgNoCode = exportSvg(document, { step: 0, locale: 'ja' });
    expect(svgNoCode).not.toContain('dav-packet-code"');
    expect(svgNoCode.toLowerCase()).not.toContain('>copy<');

    const svgFollow = exportSvg(document, { step: 1, locale: 'ja', camera: 'follow' });
    const svgWhole = exportSvg(document, { step: 1, locale: 'ja', camera: 'whole' });

    for (const svg of [svgFollow, svgWhole]) {
      expect(svg).toContain('class="dav-packet-code"');
      expect(svg).toContain('xml:space="preserve"');
      expect(svg).toContain('--dav-code-bg:light-dark(#f4f3ec,#14171b)');
      expect(svg).toContain('white-space: pre');
      expect(svg).toContain('  <tspan fill="var(--dav-code-key)">"orderId"</tspan>');
      expect(svg).not.toMatch(/<script|<foreignObject|copy/i);

      const canvasSvg = attrs(svg, 'svg').find((a) => a.preserveAspectRatio === 'xMidYMid meet');
      const [vx = 0, vy = 0, vw = 0, vh = 0] = (canvasSvg?.viewBox ?? '').split(' ').map(Number);
      const layout = computeLayout(document);
      const { steps } = schedule(document, layout, 1);
      const callouts = steps
        .flatMap((s) => s.view.phases.flat())
        .flatMap((p) => computePacketCalloutBox(p) ?? [])
        .map(calloutRect);
      expect(callouts).toHaveLength(2);
      for (const r of callouts) {
        expect(r.x).toBeGreaterThanOrEqual(vx);
        expect(r.y).toBeGreaterThanOrEqual(vy);
        expect(r.x + r.width).toBeLessThanOrEqual(vx + vw);
        expect(r.y + r.height).toBeLessThanOrEqual(vy + vh);
      }
    }
  });
});

describe('toXml', () => {
  it('escapes text and attribute values', () => {
    expect(toXml(h('text', { 'data-x': '"<&>' }, '</text><script>'))).toBe(
      '<text data-x="&quot;&lt;&amp;&gt;">&lt;/text&gt;&lt;script&gt;</text>',
    );
    expect(escapeHtml('A & "B" <C>')).toBe('A &amp; &quot;B&quot; &lt;C&gt;');
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
