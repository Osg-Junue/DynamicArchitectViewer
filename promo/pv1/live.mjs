// What happens in the live pages of each scene: the real preview and the real exported HTML file,
// driven as a user drives them (button clicks) and as the extension host does (docChanged, cursorMoved).
// setup(ctx) returns { events: [[seconds, fn]], active: (t) => [live ids to redraw] }.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');
const FLOW = [
  'examples/01-infra-ha-failover.dav',
  'examples/05-sequence-payment-retry.dav',
  'examples/04-enterprise-zero-trust-payment.dav',
];
const FLOW_KEYS = ['infra', 'seq', 'ent'];
const ARCH = { ja: 'promo/pv1/architecture-ja.dav', en: 'promo/pv1/architecture-en.dav' };

/** Offset of `line`:1 (1-based) in the source, as the host reports a cursor. */
const offsetOf = (source, line) =>
  source
    .split('\n')
    .slice(0, line - 1)
    .join('\n').length + (line > 1 ? 1 : 0);

/** The real preview in its own tab, sized like the pane it is shown in, with `source` and the cursor on `line`. */
async function openPreview(ctx, id, source, line = null) {
  const page = await ctx.live.newPage();
  await page.setViewportSize({ width: 1032, height: 707 });
  await page.goto(`${ctx.VITE}/`);
  for (let i = 0; i < 100 && !(await page.$('[data-testid=btn-play]')); i++)
    await ctx.clock.runFor(100);
  await page.evaluate((dsl) => window.postMessage({ type: 'docChanged', dsl }, '*'), source);
  await ctx.clock.runFor(600);
  // With the cursor in a step, the preview shows that step; otherwise the overview is chosen, as it
  // is when a file is opened.
  if (line)
    await page.evaluate(
      (offset) => window.postMessage({ type: 'cursorMoved', offset }, '*'),
      offsetOf(source, line),
    );
  else await page.selectOption('[data-testid=select-step]', 'overview');
  await ctx.clock.runFor(1500);
  ctx.lives[id] = page;
  return page;
}

/** Center of an element of a live page, in the pixels of the device it is shown in. */
async function center(ctx, id, locator) {
  const box = await locator.boundingBox();
  const [ox, oy] = ctx.offsets[id];
  return [ox + box.x + box.width / 2, oy + box.y + box.height / 2];
}

const architecture = (ctx) => {
  return openPreview(ctx, 'live-arch-0', read(ARCH[ctx.lang]));
};

export const LIVE = {
  async flow(ctx) {
    const { d } = ctx.T;
    // Three samples played from their first step, then the step of the first sample with code.
    const files = [...FLOW, FLOW[0]];
    const keys = [...FLOW_KEYS, 'code'];
    const pages = [];
    for (const [i, path] of files.entries()) {
      pages.push(await openPreview(ctx, `live-flow-${i}`, read(path), ctx.meta.flow[keys[i]].line));
    }
    // "Play all" for the samples; "play" for the one step.
    const button = (i) =>
      pages[i].locator(`[data-testid=${i === 3 ? 'btn-play' : 'btn-play-all'}]`);
    const events = d.map((item, i) => [item.play, () => button(i).click()]);
    // The step with code is paused on its first packet, the one that carries the code, so that it
    // can be read; in the main video it then plays on.
    events.push([d[3].play + 1.0, () => button(3).click()]);
    if (!ctx.short) events.push([d[3].play + 4.9, () => button(3).click()]);
    if (!ctx.short) {
      // The first diagram is started with the pointer; the others are already playing when they appear.
      const [x, y] = await center(ctx, 'live-flow-0', button(0));
      await ctx.setPointer('flow', [
        [d[0].play - 1.0, 1180, 520],
        [d[0].play, x, y, true],
        [d[0].play + 0.9, x, y],
        [d[0].play + 1.7, x + 240, y + 330],
      ]);
    }
    return {
      events,
      active: (t) => [`live-flow-${d.findLastIndex((item, i) => i === 0 || t >= item.at - 0.05)}`],
    };
  },

  async svg(ctx) {
    const { exp: X, hub: H } = ctx.T;
    const events = [
      [H.light, () => ctx.page.emulateMedia({ colorScheme: 'light' })],
      [H.dark, () => ctx.page.emulateMedia({ colorScheme: 'dark' })],
    ];
    if (!X) return { events, active: () => [] };
    const page = await architecture(ctx);
    const button = page.locator('[data-testid=btn-export]');
    const item = page.locator('[data-testid=export-svg-animated]');
    // The menu is opened once to find where its item is, and closed again.
    await button.click();
    await ctx.clock.runFor(200);
    const [bx, by] = await center(ctx, 'live-arch-0', button);
    const [ix, iy] = await center(ctx, 'live-arch-0', item);
    await button.click();
    await ctx.clock.runFor(200);
    await ctx.setPointer('arch', [
      [X.at, 1240, 380],
      [X.open, bx, by, true],
      [X.open + 0.25, bx, by],
      [X.item, ix, iy],
      [X.pick, ix, iy, true],
      [X.out + 0.4, ix, iy],
    ]);
    // The dev page has no extension host to save the file: the click itself is what the cut shows, and
    // the file on the next screen is what the same exporter writes (prepare.mjs).
    events.push(
      [X.open, () => button.click()],
      [X.item, () => item.hover()],
      [X.pick, () => item.click()],
    );
    return {
      events,
      active: (t) => (t < X.out + 0.5 ? ['live-arch-0'] : []),
      first: ['live-arch-0'],
    };
  },

  async html(ctx) {
    const TT = ctx.T;
    const page = await ctx.live.newPage();
    await page.setViewportSize({ width: 1240, height: 756 });
    await page.goto(`${ctx.STATIC}/promo/pv1/out/architecture-${ctx.lang}.html`);
    for (let i = 0; i < 100 && !(await page.$('[data-testid=btn-play-all]')); i++)
      await ctx.clock.runFor(100);
    await ctx.clock.runFor(800);
    ctx.lives['live-web-0'] = page;
    const playAll = page.locator('[data-testid=btn-play-all]');
    const events = [[TT.play, () => playAll.click()]];
    if (!ctx.short) {
      const ticks = page.locator('[data-testid=step-timeline] button');
      const count = await ticks.count();
      const tick = ticks.nth(Math.min(count - 1, Math.round(count * 0.55)));
      const zoomIn = page.locator('[data-testid=btn-zoom-in]');
      const [px, py] = await center(ctx, 'live-web-0', playAll);
      const [tx, ty] = await center(ctx, 'live-web-0', tick);
      const [zx, zy] = await center(ctx, 'live-web-0', zoomIn);
      const [z1, z2] = TT.zoom;
      await ctx.setPointer('web', [
        [TT.play - 0.9, 820, 420],
        [TT.play, px, py, true],
        [TT.tick - 1.0, px, py],
        [TT.tick, tx, ty, true],
        [z1 - 0.9, tx, ty],
        [z1, zx, zy, true],
        [z2, zx, zy, true],
        [z2 + 0.7, zx, zy],
        [TT.out, zx - 160, zy - 120],
      ]);
      events.push(
        [TT.tick, () => tick.click()],
        [z1, () => zoomIn.click()],
        [z2, () => zoomIn.click()],
      );
    }
    return { events, active: () => ['live-web-0'], first: ['live-web-0'] };
  },
};
