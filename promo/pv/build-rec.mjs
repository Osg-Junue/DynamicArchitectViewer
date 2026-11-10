// Builds cut 5 from the real VS Code recording: node build-rec.mjs [ja|en|all]
// Trims and joins segments, speeds up the wait for Claude Code (with a visible "×6" badge), blurs
// personal details (file paths with the user name, the usage banner), places the window like the
// other cuts and overlays the caption. Captions and the badge are rendered by stage.html.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const here = import.meta.dirname;
const repo = resolve(here, '../..');
const FFMPEG = join(process.env.LOCALAPPDATA, 'Microsoft/WinGet/Links/ffmpeg.exe');
const SRC = resolve(here, 'recordings');
const OUT = resolve(here, 'out');
const OVER = resolve(here, 'out/overlay');
mkdirSync(OVER, { recursive: true });
const langs = (process.argv[2] ?? 'all') === 'all' ? ['ja', 'en'] : [process.argv[2]];

// Source is 2560x1380. Cut 5 is framed closer: a 2138x1062 window (the editor, preview and Claude Code,
// without the explorer) scaled into the 1792x890 frame the other cuts use. It starts low on the prompt box
// and pans up to the tool list and the result while the fast-forward begins.
/** Crop pans from the prompt box (y 318) up to the tool list (y 180) over [t0, t0 + 0.8] of the cut. */
const fit = (t0) => {
  const pan = `if(lt(t,${t0}),318,if(gt(t,${t0 + 0.8}),180,318-(t-${t0})/0.8*138))`;
  return `crop=2138:1062:422:'${pan}',scale=1792:890:flags=lanczos,pad=1920:1080:64:40:color=0x121212`;
};

// [start, end, speed] in source seconds.
const TAKES = {
  // Cuts 3-4 are rebuilt in stage.html from jp_take3/jp_take4 (cuts.mjs c03_new, c04_skill).
  c05_rec: {
    file: 'jp_take5.mp4',
    cap: 'rec5',
    segments: [
      [1, 6, 1],
      [6, 27, 6],
      [27, 31, 1],
    ],
    // No masks: the owner is fine with Claude Code's panel (paths, usage banner) being shown.
    // A take that needs one can list source-time masks here as [x, y, w, h, from, to].
    masks: [],
    badge: { text: '×6', segment: 1 },
  },
  // The SNS cut: from the prompt being sent, the wait at ×10, then the result.
  c05_short: {
    file: 'jp_take5.mp4',
    cap: 'rec5',
    segments: [
      [3.5, 6, 1],
      [6, 27, 10],
      [27, 30, 1],
    ],
    masks: [],
    badge: { text: '×10', segment: 1 },
    panAt: 2.1,
  },
};

// ---- overlays (transparent PNGs) ----
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const server = createServer((req, res) => {
  const path = join(repo, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(repo) || !existsSync(path) || statSync(path).isDirectory())
    return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': mime[extname(path)] ?? 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(5301);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const shot = async (query, file) => {
    await page.goto(`http://localhost:5301/promo/pv/stage.html?scene=overlay&${query}`);
    await page.waitForFunction(() => window.stage?.ready);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(OVER, file), omitBackground: true });
  };
  for (const lang of langs)
    for (const t of Object.values(TAKES))
      await shot(`lang=${lang}&cap=${t.cap}`, `${t.cap}-${lang}.png`);
  for (const text of new Set(
    Object.values(TAKES).flatMap((t) => (t.badge ? [t.badge.text] : [])),
  )) {
    await shot(`lang=ja&badge=${encodeURIComponent(text)}`, `badge-${text.replace('×', 'x')}.png`);
  }
} finally {
  await browser.close();
  server.close();
}

// ---- compose ----
function run(args) {
  const r = spawnSync(FFMPEG, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}
for (const lang of langs) {
  for (const [name, take] of Object.entries(TAKES)) {
    const f = [];
    let src = '[0:v]';
    (take.masks ?? []).forEach(([x, y, w, h, from, to], i) => {
      f.push(
        `${src}split[m${i}a][m${i}b]`,
        `[m${i}b]crop=${w}:${h}:${x}:${y},boxblur=14:2[m${i}c]`,
        `[m${i}a][m${i}c]overlay=${x}:${y}:enable='between(t,${from},${to})'[m${i}]`,
      );
      src = `[m${i}]`;
    });
    const n = take.segments.length;
    f.push(`${src}split=${n}${take.segments.map((_, i) => `[s${i}]`).join('')}`);
    take.segments.forEach(([a, b, speed], i) => {
      f.push(`[s${i}]trim=${a}:${b},setpts=(PTS-STARTPTS)/${speed}[v${i}]`);
    });
    f.push(
      `${take.segments.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0,fps=60,${fit(take.panAt ?? 4.6)}[base]`,
    );
    const duration = take.segments.reduce((sum, [a, b, s]) => sum + (b - a) / s, 0);
    f.push(`[1:v]format=rgba,fade=in:st=0.4:d=0.5:alpha=1[cap]`, `[base][cap]overlay=0:0[withcap]`);
    let last = '[withcap]';
    const inputs = [
      '-i',
      `${SRC}/${take.file}`,
      '-loop',
      '1',
      '-t',
      String(duration),
      '-i',
      resolve(OVER, `${take.cap}-${lang}.png`),
    ];
    if (take.badge) {
      const start = take.segments
        .slice(0, take.badge.segment)
        .reduce((s, [a, b, sp]) => s + (b - a) / sp, 0);
      const [a, b, sp] = take.segments[take.badge.segment];
      inputs.push(
        '-loop',
        '1',
        '-t',
        String(duration),
        '-i',
        resolve(OVER, `badge-${take.badge.text.replace('×', 'x')}.png`),
      );
      f.push(
        `${last}[2:v]overlay=0:0:enable='between(t,${start.toFixed(3)},${(start + (b - a) / sp).toFixed(3)})'[out]`,
      );
      last = '[out]';
    }
    run([
      '-y',
      '-v',
      'error',
      ...inputs,
      '-filter_complex',
      f.join(';'),
      '-map',
      last,
      '-an',
      '-t',
      duration.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '16',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '60',
      '-movflags',
      '+faststart',
      resolve(OUT, `${name}-${lang}.mp4`),
    ]);
    console.log(`${name}-${lang}: ${duration.toFixed(2)}s`);
  }
}
