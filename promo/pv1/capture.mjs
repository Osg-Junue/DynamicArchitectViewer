// Renders scenes frame by frame: node capture.mjs <scene[,scene]|all> <ja|en> <long|short> [--stills=1.5,3] [--port=5401]
// The stage draws any moment on its own (stage.render(t)). Live pages (the real preview, the exported
// HTML) run in a second browser context under Playwright's paused clock, which moves exactly one frame
// between screenshots; each frame their picture is placed in the stage.
//   --stills  writes PNGs of those moments to out/stills/ instead of a video
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { LIVE } from './live.mjs';
import { FPS, ORDER, T } from './timing.js';

const here = import.meta.dirname;
const repo = resolve(here, '../..');
const FFMPEG =
  process.env.FFMPEG ?? join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const [which = 'all', lang = 'ja', profile = 'long'] = args;
const stills = flag('stills')?.split(',').map(Number);
const port = Number(flag('port') ?? 5401);
const STATIC = `http://localhost:${port}`;
const VITE = `http://localhost:${port + 1}`;
const names = which === 'all' ? ORDER : which.split(',');
for (const n of names)
  if (!T[profile][n]) throw new Error(`unknown scene ${n}; known: ${ORDER.join(', ')}`);
const OUT = resolve(here, 'out', stills ? 'stills' : profile);
mkdirSync(OUT, { recursive: true });
const meta = JSON.parse(readFileSync(resolve(here, 'out/meta.json'), 'utf8'));

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const server = createServer((req, res) => {
  const path = join(repo, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(repo) || !existsSync(path) || statSync(path).isDirectory())
    return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(port);

const needsVite = names.some((n) => ['flow', 'svg'].includes(n));
const vite = needsVite
  ? spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'apps/vscode', '--port', String(port + 1), '--strictPort'],
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

/** A PNG of the page; the encoder is told to favor speed, the video encoder does the compressing. */
async function shot(client) {
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'png',
    optimizeForSpeed: true,
  });
  return data;
}

const browser = await chromium.launch();
try {
  for (const name of names) {
    const TT = T[profile][name];
    const locale = lang === 'ja' ? 'ja-JP' : 'en-US';
    const stageContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale,
      colorScheme: 'dark',
    });
    const page = await stageContext.newPage();
    page.on('pageerror', (e) => console.error(`[stage] ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') console.error(`[stage] ${m.text()}`);
    });
    await page.goto(`${STATIC}/promo/pv1/stage.html?scene=${name}&lang=${lang}&profile=${profile}`);
    await page.waitForFunction(() => window.stage?.ready, null, { timeout: 30000 });
    const stageClient = await stageContext.newCDPSession(page);

    // Live pages are drawn at 1.5 device pixels a pixel, so they stay sharp when the camera moves in.
    let live = null;
    let scene = { events: [], active: () => [] };
    const lives = {};
    const clients = {};
    if (LIVE[name]) {
      live = await browser.newContext({
        viewport: { width: 1032, height: 707 },
        deviceScaleFactor: 1.5,
        locale,
        colorScheme: 'dark',
      });
      // install() alone keeps real time flowing on top of runFor(); paused, runFor() is the only
      // source of time, so slow screenshots cannot speed the animation up.
      await live.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      await live.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
      await live.route(`${VITE}/`, async (route) => {
        const res = await route.fetch();
        const body = (await res.text())
          .replace('<html lang="en">', `<html lang="${lang}" style="${themeVars}">`)
          .replace('<body>', '<body class="vscode-dark">');
        await route.fulfill({ response: res, body });
      });
      const ctx = {
        page,
        live,
        lives,
        clock: live.clock,
        lang,
        profile,
        short: profile === 'short',
        T: TT,
        meta,
        VITE,
        STATIC,
        offsets: await page.evaluate(() => window.stage.offsets),
        setPointer: (dev, keys) =>
          page.evaluate(([d, k]) => window.stage.setPointer(d, k), [dev, keys]),
      };
      scene = await LIVE[name](ctx);
      for (const [id, livePage] of Object.entries(lives))
        clients[id] = await live.newCDPSession(livePage);
    }
    const paint = async (ids) => {
      for (const id of ids) {
        const data = await shot(clients[id]);
        await page.evaluate(([i, b64]) => window.stage.showLive(i, b64), [id, data]);
      }
    };

    // Events before the cut begins (a diagram that is already playing when it appears).
    const events = scene.events
      .filter(([t]) => t !== undefined && t !== null && Number.isFinite(t))
      .sort((a, b) => a[0] - b[0]);
    let next = 0;
    let before = Math.min(0, events[0]?.[0] ?? 0);
    while (next < events.length && events[next][0] < 0) {
      await live.clock.runFor(Math.round((events[next][0] - before) * 1000));
      before = events[next][0];
      await events[next++][1]();
    }
    if (live && before < 0) await live.clock.runFor(Math.round(-before * 1000));
    if (scene.first) await paint(scene.first);

    const frames = Math.round(TT.dur * FPS);
    const file = resolve(OUT, `${name}-${lang}.mp4`);
    const ffmpeg = stills
      ? null
      : spawn(
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
            '-vf',
            'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
            '-c:v',
            'libx264',
            '-preset',
            'medium',
            '-crf',
            '15',
            '-g',
            '60',
            '-bf',
            '2',
            '-colorspace',
            'bt709',
            '-color_primaries',
            'bt709',
            '-color_trc',
            'bt709',
            '-color_range',
            'tv',
            '-movflags',
            '+faststart',
            file,
          ],
          { stdio: ['pipe', 'inherit', 'inherit'] },
        );
    const stillFrames = new Set((stills ?? []).map((t) => Math.round(t * FPS)));
    const started = Date.now();
    let virtualMs = 0;
    for (let f = 0; f < frames; f++) {
      const t = f / FPS;
      while (next < events.length && events[next][0] <= t + 1e-9) await events[next++][1]();
      const wanted = !stills || stillFrames.has(f);
      if (live) {
        const target = Math.round(((f + 1) * 1000) / FPS);
        await live.clock.runFor(target - virtualMs);
        virtualMs = target;
        if (wanted) await paint(scene.active(t));
      }
      if (!wanted) continue;
      await page.evaluate((tt) => window.stage.render(tt), t);
      const png = Buffer.from(await shot(stageClient), 'base64');
      if (stills)
        writeFileSync(resolve(OUT, `${name}-${lang}-${profile}-${t.toFixed(2)}.png`), png);
      else if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    }
    if (ffmpeg) {
      ffmpeg.stdin.end();
      await new Promise((r) => ffmpeg.on('close', r));
    }
    await stageContext.close();
    await live?.close();
    console.log(
      `${name}-${lang} (${profile}): ${stills ? `${stillFrames.size} stills` : `${frames} frames`}, ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
} finally {
  await browser.close();
  vite?.kill();
  server.close();
}
