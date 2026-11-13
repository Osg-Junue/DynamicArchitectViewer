// Cut definitions. `duration` in seconds. Cuts with `preview: true` drive the real preview the way
// the extension host does (docChanged / cursorMoved messages, real button clicks) and return a
// timeline of [seconds, async (ctx, t) => …] events from `setup`.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DAV, HIGHLIGHT, STEPS, UI } from './variant.mjs';

const here = import.meta.dirname;
const DSL = readFileSync(resolve(here, DAV), 'utf8');
const LINES = DSL.split('\n');
/** 1-based line of the first line containing `text`. */
/** Offset of `line`:`col` (both 1-based) in the source, as the host reports a cursor. */
const offsetOf = (line, col) =>
  LINES.slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0) + col - 1;

/** 1-based line of the n-th (1-based) step. Both diagrams have the same steps in the same order. */
const stepLine = (n) =>
  LINES.map((l, i) => [l, i + 1]).filter(([l]) => l.startsWith('step "'))[n - 1][1];
// Each diagram is what Claude Code generated in the take of that language (variant.mjs).
const STEP1 = stepLine(1); // the order is placed
const PAID = stepLine(STEPS.follow); // packets go far apart
const RETRY = stepLine(STEPS.retry); // the retries

// Editor geometry in stage.html: rows start at y = 113, 22 px each; text starts at x = 168, ~8.25 px a column.
const EDITOR_TOP = 113;
const ROW = 22;
const rowY = (line, top) => EDITOR_TOP + (line - 1 - top) * ROW + ROW / 2;
const colX = (col) => 168 + (col - 1) * 8.25;

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** Pointer keyframes [t, x, y, click?] → per-frame pointer, with a click ring after each click. */
function pointerTrack(keys) {
  return async ({ page }, t) => {
    let x = keys[0][1];
    let y = keys[0][2];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, x0, y0] = keys[i];
      const [t1, x1, y1] = keys[i + 1];
      if (t >= t0 && t <= t1) {
        const k = ease((t - t0) / (t1 - t0 || 1));
        x = x0 + (x1 - x0) * k;
        y = y0 + (y1 - y0) * k;
      } else if (t > t1) {
        x = x1;
        y = y1;
      }
    }
    const last = keys.filter(([tk, , , click]) => click && tk <= t).at(-1);
    const press = last ? Math.min(1, (t - last[0]) / 0.35) : 0;
    await page.evaluate(
      ([px, py, pr]) => window.stage.pointer(px, py, true, pr >= 1 ? 0 : pr),
      [x, y, press],
    );
  };
}

/**
 * Opens `url` in its own tab, sized like the pane `paneId`, whose screenshots fill `imgId` each frame.
 * (An iframe would be simpler, but the fake clock does not reach into iframes.)
 */
async function openLive(ctx, paneId, imgId, url, initialDsl) {
  const box = await ctx.page.locator(`#${paneId}`).boundingBox();
  const live = await ctx.context.newPage();
  if (initialDsl !== undefined)
    await live.addInitScript((dsl) => {
      window.__INITIAL_DSL = dsl;
    }, initialDsl);
  await live.setViewportSize({ width: Math.round(box.width), height: Math.round(box.height) });
  await live.goto(url);
  ctx.live = { page: live, imgId, offset: [box.x, box.y] };
  return live;
}

/** Loads the real preview into the VS Code window with the diagram, cursor at `line`. */
async function openPreview(ctx, line, col = 5, speed = '1') {
  const { page, VITE, clock } = ctx;
  await page.evaluate((f) => window.stage.loadEditor(f), HIGHLIGHT);
  await page.evaluate(([l, c]) => window.stage.setEditor(l, c), [line, col]);
  const frame = await openLive(ctx, 'previewPane', 'preview', `${VITE}/`);
  ctx.center = (locator) => center(ctx, locator);
  for (let i = 0; i < 100 && !(await frame.$('[data-testid=btn-play]')); i++)
    await clock.runFor(100);
  await frame.evaluate((text) => window.postMessage({ type: 'docChanged', dsl: text }, '*'), DSL);
  await clock.runFor(600);
  await frame.evaluate(
    (o) => window.postMessage({ type: 'cursorMoved', offset: o }, '*'),
    offsetOf(line, col),
  );
  await frame.selectOption('[data-testid=select-speed]', speed);
  await clock.runFor(1500);
  ctx.frame = frame;
  return frame;
}

/** The preview of an empty architecture.dav (cuts 3-4), behind the editor until it is opened. */
async function openEmptyPreview(ctx) {
  // Like VS Code opening an empty file: the first document the preview gets is empty.
  const frame = await openLive(ctx, 'previewPane2', 'preview2', `${ctx.VITE}/`, '');
  for (let i = 0; i < 100 && !(await frame.$('[data-testid=btn-play]')); i++)
    await ctx.clock.runFor(100);
  await ctx.clock.runFor(800);
  return frame;
}

/** Center of an element of the live page, in stage coordinates. */
async function center(ctx, locator) {
  const box = await locator.boundingBox();
  const [ox, oy] = ctx.live.offset;
  return [ox + box.x + box.width / 2, oy + box.y + box.height / 2];
}

/** Captions fade in at `at` and stay; drawn every frame so the fade is smooth. */
function withCaption(key, at, frameFn) {
  return async (ctx, t) => {
    if (frameFn) await frameFn(ctx, t);
    if (!ctx.captions) return;
    const k = Math.max(0, Math.min(1, (t - at) / 0.5));
    await ctx.page.evaluate(
      ([kk, a]) => window.stage.caption(window.stage.captions[kk], 1 - (1 - a) ** 3),
      [key, k],
    );
  };
}

// The extension's own strings for the skill install (package.nls*.json, extension/skillInstall.ts).
const SKILL_STRINGS = {
  ja: {
    command: 'DynamicArchitectViewer: AI エージェントスキルをインストール...',
    query: 'AI エージェント',
    recent: '最近使用したもの',
    workspace: 'このワークスペース',
    all: 'すべてのプロジェクト',
    placeholder: 'スキルをインストールする場所を選択',
    installed:
      'スキル（dav-diagrams, dav-reading）を .claude/skills にインストールしました。エージェントの新しいセッションで使えます。',
  },
  en: {
    command: 'DynamicArchitectViewer: Install AI Agent Skill...',
    query: 'AI Agent',
    recent: 'recently used',
    workspace: 'This workspace',
    all: 'All projects',
    placeholder: 'Choose where to install the skills',
    installed:
      'Installed the skills (dav-diagrams, dav-reading) to .claude/skills. They are available in new agent sessions.',
  },
};

export const CUTS = {
  c01_hook: { scene: 'hook', duration: 3 },
  c02_title: { scene: 'title', duration: 3 },

  // Cut 3 (rebuilt from jp_take3): new architecture.dav from the explorer, then Ctrl+Shift+V.
  c03_new: {
    scene: 'vscode2',
    preview: true,
    duration: 7,
    async setup(ctx) {
      await openEmptyPreview(ctx);
      const st = (fn, arg) => ctx.page.evaluate(([f, a]) => window.stage[f](...a), [fn, arg]);
      const menuAt = [262, 400];
      await st('contextMenu', [menuAt]);
      const item = await ctx.page.evaluate(() => window.stage.where('[data-ctx="0"]'));
      await st('contextMenu', [null]);
      const NAME = 'architecture.dav';
      const typing = [...NAME].map((_, i) => [
        1.95 + i * 0.07,
        () => st('explorer', [{ newName: NAME.slice(0, i + 1) }]),
      ]);
      ctx.track = pointerTrack([
        [0, 900, 640],
        [0.8, ...menuAt, true],
        [1.4, ...item],
        [1.6, ...item, true],
        [2.4, 520, 640],
        [7, 520, 640],
      ]);
      return [
        [0.8, () => st('contextMenu', [menuAt])],
        [1.35, () => st('contextMenu', [menuAt, 0])],
        [
          1.6,
          async () => {
            await st('contextMenu', [null]);
            await st('explorer', [{ newName: '' }]);
          },
        ],
        ...typing,
        [
          3.3,
          async () => {
            await st('explorer', [{ dav: true, selected: 'dav' }]);
            await st('editorState', [{ open: true }]);
          },
        ],
        [4.1, () => st('keys', [['Ctrl', 'Shift', 'V']])],
        [
          4.5,
          async () => {
            await st('keys', [null]);
            await st('editorState', [{ open: true, preview: true }]);
          },
        ],
      ];
    },
    frame: withCaption('rec3', 0.4, (ctx, t) => ctx.track(ctx, t)),
  },

  // Cut 4 (rebuilt from jp_take4): Command Palette → install the AI agent skill for Claude Code.
  // Strings are the extension's own (package.nls.ja.json, extension/skillInstall.ts).
  c04_skill: {
    scene: 'vscode2',
    preview: true,
    duration: 8,
    async setup(ctx) {
      await openEmptyPreview(ctx);
      const st = (fn, arg) => ctx.page.evaluate(([f, a]) => window.stage[f](...a), [fn, arg]);
      await st('explorer', [{ dav: true }]);
      await st('editorState', [{ open: true, preview: true }]);
      const S = SKILL_STRINGS[UI];
      const COMMAND = S.command;
      const QUERY = S.query;
      const PICKS = [
        ['Claude Code', S.workspace, '.claude/skills'],
        ['Claude Code', S.all, '~/.claude/skills'],
        ['GitHub Copilot', S.workspace, '.github/skills'],
        ['GitHub Copilot', S.all, '~/.copilot/skills'],
        ['Codex', S.workspace, '.agents/skills'],
        ['Codex', S.all, '~/.agents/skills'],
      ].map(([label, desc, detail]) => ({ label, desc, detail }));
      await st('palette', [{ placeholder: S.placeholder, items: PICKS }]);
      const pick = await ctx.page.evaluate(() => window.stage.where('[data-item="0"]'));
      await st('palette', [null]);
      await st('explorer', [{ dav: true, skill: true }]);
      const skillRow = await ctx.page.evaluate(() => window.stage.where('[data-row="skill"]'));
      await st('explorer', [{ dav: true }]);
      const typing = [...QUERY].map((_, i) => [
        1.0 + i * 0.09,
        () =>
          st('palette', [
            {
              query: `&gt;${QUERY.slice(0, i + 1)}`,
              items: [{ label: COMMAND, hl: QUERY.slice(0, i + 1), right: S.recent }],
            },
          ]),
      ]);
      ctx.track = pointerTrack([
        [0, 1300, 760],
        [2.8, 1300, 760],
        [3.5, ...pick],
        [3.8, ...pick, true],
        [4.6, 1100, 700],
        [5.4, ...skillRow],
        [8, ...skillRow],
      ]);
      return [
        [0.4, () => st('keys', [['Ctrl', 'Shift', 'P']])],
        [
          0.7,
          async () => {
            await st('keys', [null]);
            await st('palette', [{ query: '&gt;', items: [{ label: COMMAND, right: S.recent }] }]);
          },
        ],
        ...typing,
        [2.3, () => st('palette', [{ placeholder: S.placeholder, items: PICKS, active: 0 }])],
        [
          3.8,
          async () => {
            await st('palette', [null]);
            await st('explorer', [{ dav: true, skill: true }]);
          },
        ],
        [4.0, () => st('toast', [S.installed])],
        [5.4, () => st('explorer', [{ dav: true, skill: true, hover: 'skill' }])],
      ];
    },
    frame: withCaption('rec4', 0.4, (ctx, t) => ctx.track(ctx, t)),
  },

  // Cut 6: play a step, scroll to another, click into it: the preview jumps to that step and plays it.
  c06_cursor: {
    scene: 'vscode',
    preview: true,
    duration: 11,
    async setup(ctx) {
      const frame = await openPreview(ctx, STEP1);
      // "Fit" (a real toolbar button) keeps the whole diagram in view, so no packet runs off screen.
      await frame.click('[data-testid=btn-zoom-fit]');
      await ctx.clock.runFor(800);
      const play = frame.locator('[data-testid=btn-play]');
      const [playX, playY] = await ctx.center(play);
      const topAfter = RETRY - 10;
      const target = [colX(5), rowY(RETRY, topAfter)];
      const scrollFrom = STEP1 - 10;
      // The preview only follows the cursor while it is not playing, so the step is paused first.
      ctx.track = pointerTrack([
        [0, 1500, 600],
        [0.5, playX, playY, true],
        [3.3, playX, playY, true],
        [3.9, 420, 520],
        [4.7, 420, 520],
        [5.4, ...target, true],
        [6.2, ...target],
        [6.8, playX, playY, true],
        [11, playX, playY],
      ]);
      ctx.scroll = { from: scrollFrom, to: topAfter, t0: 3.9, t1: 4.7 };
      return [
        [0.5, async () => play.click()],
        [3.3, async () => play.click()],
        // Mouse-wheel scroll moves the view, not the cursor, so the host sends nothing.
        [
          5.4,
          async ({ page }) => {
            await page.evaluate(([l, top]) => window.stage.setEditor(l, 5, top), [RETRY, topAfter]);
            await frame.evaluate(
              (o) => window.postMessage({ type: 'cursorMoved', offset: o }, '*'),
              offsetOf(RETRY, 5),
            );
          },
        ],
        [6.8, async () => play.click()],
      ];
    },
    frame: withCaption('cursor', 0.8, async (ctx, t) => {
      const { from, to, t0, t1 } = ctx.scroll;
      if (t >= t0 && t <= t1 + 0.02) {
        const top = from + (to - from) * ease(Math.min(1, (t - t0) / (t1 - t0)));
        await ctx.page.evaluate(([l, tp]) => window.stage.setEditor(l, 5, tp), [STEP1, top]);
      }
      await ctx.track(ctx, t);
    }),
  },

  // Cut 7: zoomed in, packets leave the screen; turning on "follow" makes the camera chase them.
  c07_follow: {
    scene: 'vscode',
    preview: true,
    duration: 9,
    async setup(ctx) {
      const frame = await openPreview(ctx, PAID);
      const zoomIn = frame.locator('[data-testid=canvas-zoom-controls] button', { hasText: '+' });
      for (let i = 0; i < 3; i++) {
        await zoomIn.click();
        await ctx.clock.runFor(300);
      }
      await ctx.clock.runFor(800);
      const play = frame.locator('[data-testid=btn-play]');
      const follow = frame.locator('[data-testid=btn-follow-anim]');
      const [playX, playY] = await ctx.center(play);
      const [fx, fy] = await ctx.center(follow);
      ctx.track = pointerTrack([
        [0, 1500, 600],
        [0.5, playX, playY, true],
        [2.6, playX, playY],
        [3.4, fx, fy, true],
        [9, fx, fy],
      ]);
      return [
        [0.5, async () => play.click()],
        [3.4, async () => follow.click()],
      ];
    },
    frame: withCaption('follow', 3.6, (ctx, t) => ctx.track(ctx, t)),
  },

  // Cut 8: the documentation inside the preview, ending on the AI agent skill page.
  c08_docs: {
    scene: 'vscode',
    preview: true,
    duration: 9,
    async setup(ctx) {
      const frame = await openPreview(ctx, STEP1);
      const help = frame.locator('[data-testid=btn-open-help]');
      const [hx, hy] = await ctx.center(help);
      // Page titles of the preview's documentation (editor/docs/pages.ts).
      const pages =
        UI === 'ja'
          ? ['ステップ', 'アイコン', 'AIエージェントスキル']
          : ['Steps', 'Icons', 'AI agent skill'];
      const times = [2.6, 4.6, 6.6];
      const events = [[0.6, async () => help.click()]];
      await help.click();
      await ctx.clock.runFor(500);
      const spots = [];
      for (const label of pages)
        spots.push(await ctx.center(frame.locator('.doc-nav').getByText(label, { exact: true })));
      await frame
        .locator('dialog button', { hasText: UI === 'ja' ? '閉じる' : 'Close' })
        .first()
        .click();
      await ctx.clock.runFor(500);
      const keys = [
        [0, 1500, 600],
        [0.6, hx, hy, true],
      ];
      pages.forEach((label, i) => {
        keys.push([times[i] - 0.7, ...spots[i]], [times[i], ...spots[i], true]);
        events.push([
          times[i],
          async () => frame.locator('.doc-nav').getByText(label, { exact: true }).click(),
        ]);
      });
      keys.push([9, ...spots.at(-1)]);
      ctx.track = pointerTrack(keys);
      return events;
    },
    frame: withCaption('docs', 1.2, (ctx, t) => ctx.track(ctx, t)),
  },

  // Cut 9a: the export button in the preview's toolbar (the save dialog belongs to VS Code; not shown).
  c09a_export: {
    scene: 'vscode',
    preview: true,
    duration: 2,
    async setup(ctx) {
      const frame = await openPreview(ctx, STEP1);
      const exportBtn = frame.locator('[data-testid=btn-export-html]');
      const [ex, ey] = await ctx.center(exportBtn);
      ctx.track = pointerTrack([
        [0, 1400, 500],
        [0.9, ex, ey, true],
        [2, ex, ey],
      ]);
      // The dev page has no host to save the file; the click itself is what the cut shows.
      return [];
    },
    frame: (ctx, t) => ctx.track(ctx, t),
  },

  // Cut 9b: the exported file, made by the real exporter, playing in a browser.
  c09b_html: {
    scene: 'browser',
    preview: true,
    duration: 7,
    async setup(ctx) {
      const { page, VITE, clock } = ctx;
      const lang = UI;
      const helper = await page.context().newPage();
      await helper.goto(`${VITE}/`);
      const html = await helper.evaluate(
        async ([dsl, locale]) => {
          const { exportHtml } = await import('/src/exporter/export.ts');
          return exportHtml(dsl, { locale });
        },
        [DSL, lang],
      );
      await helper.close();
      writeFileSync(resolve(here, 'out', `architecture-${lang}.html`), html);
      const frame = await openLive(
        ctx,
        'exportedPane',
        'exported',
        `${ctx.STATIC}/promo/pv/out/architecture-${lang}.html`,
      );
      ctx.center = (locator) => center(ctx, locator);
      for (let i = 0; i < 100 && !(await frame.$('[data-testid=btn-play-all]')); i++)
        await clock.runFor(100);
      await clock.runFor(800);
      const playAll = frame.locator('[data-testid=btn-play-all]');
      const [px, py] = await ctx.center(playAll);
      ctx.track = pointerTrack([
        [0, 1200, 600],
        [0.8, px, py, true],
        [7, px, py],
      ]);
      return [[0.8, async () => playAll.click()]];
    },
    frame: withCaption('export', 0.3, (ctx, t) => ctx.track(ctx, t)),
  },

  c10_end: { scene: 'end', duration: 6 },
};
