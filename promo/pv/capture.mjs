// Renders PV cuts frame by frame: node capture.mjs <cut|all> [ja|en]
// Motion-graphics cuts call stage.render(t) per frame. Cuts with the real preview run under
// Playwright's fake clock, which advances exactly one frame between screenshots.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { CUTS } from './cuts.mjs';
import { ARGS, CAPTIONS, suffix, UI } from './variant.mjs';

const here = import.meta.dirname;
const repo = resolve(here, '../..');
const FFMPEG = join(process.env.LOCALAPPDATA, 'Microsoft/WinGet/Links/ffmpeg.exe');
const FPS = 60;
const STATIC = 'http://localhost:5301';
const VITE = 'http://localhost:5199';
const OUT = resolve(here, 'out');
mkdirSync(OUT, { recursive: true });

const [which = 'all', lang = 'ja'] = ARGS;
const names = which === 'all' ? Object.keys(CUTS) : which.split(',');
for (const n of names)
  if (!CUTS[n]) throw new Error(`unknown cut ${n}; known: ${Object.keys(CUTS).join(', ')}`);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.dav': 'text/plain; charset=utf-8',
};
const server = createServer((req, res) => {
  const path = join(repo, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(repo) || !existsSync(path) || statSync(path).isDirectory())
    return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(5301);

const needsVite = names.some((n) => CUTS[n].preview);
const vite = needsVite
  ? spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'apps/vscode', '--port', '5199', '--strictPort'],
      { cwd: repo, stdio: 'ignore' },
    )
  : null;
if (vite) {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${VITE}/`)).ok) break;
    } catch {}
    if (i > 60) throw new Error('vite did not start');
    await new Promise((r) => setTimeout(r, 500));
  }
}

// What VS Code gives a webview under Dark+: lang, body.vscode-dark and the theme's color variables.
const DARK_PLUS = {
  'editor-background': '#1e1e1e',
  foreground: '#cccccc',
  descriptionForeground: '#ccccccb3',
  'button-background': '#0e639c',
  'button-foreground': '#ffffff',
  'button-hoverBackground': '#1177bb',
  'dropdown-background': '#3c3c3c',
  'dropdown-border': '#3c3c3c',
  'dropdown-foreground': '#f0f0f0',
  'editorWarning-foreground': '#cca700',
  'editorWidget-background': '#252526',
  errorForeground: '#f48771',
  focusBorder: '#007fd4',
  'input-placeholderForeground': '#a6a6a6',
  'inputOption-activeBackground': '#007fd466',
  'inputOption-activeForeground': '#ffffff',
  'panel-border': '#80808059',
  'sideBar-background': '#252526',
  'testing-iconPassed': '#73c991',
  'toolbar-hoverBackground': '#5a5d5e50',
  'widget-shadow': '#0000005c',
  'editor-font-family': "Consolas, 'Courier New', monospace",
};
const themeVars = Object.entries(DARK_PLUS)
  .map(([k, v]) => `--vscode-${k}: ${v};`)
  .join(' ')
  .replace(/"/g, '&quot;');

const browser = await chromium.launch();
try {
  for (const name of names) {
    const cut = CUTS[name];
    const file = resolve(OUT, `${name}-${suffix(lang)}.mp4`);
    // The screen (VS Code, preview) is Japanese in both PV versions, matching the recording; `lang` sets
    // the captions. The docs renders (--docs) use an English screen.
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: UI === 'ja' ? 'ja-JP' : 'en-US',
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    if (cut.preview) {
      // The clock belongs to the context, so the live page (opened by the cut) follows it too.
      // install() alone keeps real time flowing on top of runFor(); pausing makes runFor() the only
      // source of time, so slow screenshots cannot speed the animation up.
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
      // The dev host answers "ready" with a sample diagram. VS Code answers with the open document, so a
      // live page can set window.__INITIAL_DSL (init script) to start from that instead.
      await context.route(/\/src\/editor\/devHost\.ts/, async (route) => {
        const res = await route.fetch();
        const body = (await res.text()).replace(
          /dsl: DEFAULT_SAMPLE\.dsl/,
          'dsl: window.__INITIAL_DSL ?? DEFAULT_SAMPLE.dsl',
        );
        await route.fulfill({ response: res, body });
      });
      await context.route(`${VITE}/`, async (route) => {
        const res = await route.fetch();
        const body = (await res.text())
          .replace('<html lang="en">', `<html lang="${UI}" style="${themeVars}">`)
          .replace('<body>', '<body class="vscode-dark">');
        await route.fulfill({ response: res, body });
      });
    }
    const extra = cut.query ? `&${new URLSearchParams(cut.query)}` : '';
    await page.goto(
      `${STATIC}/promo/pv/stage.html?scene=${cut.scene}&lang=${lang}&ui=${UI}${extra}`,
    );
    await page.waitForFunction(() => window.stage?.ready);
    await page.evaluate(() => document.fonts.ready);

    const ctx = { page, context, lang, here, VITE, STATIC, clock: page.clock, captions: CAPTIONS };
    const timeline = cut.preview ? await cut.setup(ctx) : [];
    const ffmpeg = spawn(
      FFMPEG,
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        String(FPS),
        '-i',
        '-',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '16',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        file,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const frames = Math.round(cut.duration * FPS);
    const started = Date.now();
    let virtualMs = 0;
    let next = 0;
    for (let f = 0; f < frames; f++) {
      const t = f / FPS;
      // Fire timeline events whose time has come (they may click, post messages, move the pointer).
      while (next < timeline.length && timeline[next][0] <= t + 1e-9)
        await timeline[next++][1](ctx, t);
      if (cut.frame) await cut.frame(ctx, t);
      if (!cut.preview) await page.evaluate((tt) => window.stage.render(tt), t);
      if (cut.preview) {
        const target = Math.round(((f + 1) * 1000) / FPS);
        await page.clock.runFor(target - virtualMs);
        virtualMs = target;
        // Paint the live page's current frame into its pane.
        const shot = await ctx.live.page.screenshot({ type: 'png' });
        await page.evaluate(
          ([id, b64]) => window.stage.showLive(id, b64),
          [ctx.live.imgId, shot.toString('base64')],
        );
      }
      const png = await page.screenshot({ type: 'png' });
      if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    }
    ffmpeg.stdin.end();
    await new Promise((r) => ffmpeg.on('close', r));
    await context.close();
    console.log(
      `${name}-${suffix(lang)}: ${frames} frames, ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
} finally {
  await browser.close();
  vite?.kill();
  server.close();
}
