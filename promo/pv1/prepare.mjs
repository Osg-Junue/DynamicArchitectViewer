// Makes everything the stage shows that is not drawn by it: node prepare.mjs [exports|rec|all]
//   exports  out/hook.svg, out/architecture-<lang>.svg and .html from the extension's own exporters,
//            the editor text highlighted with the extension's grammar, and out/meta.json
//   rec      out/rec/ and out/play/<lang>-<profile>/f0001.jpg ...: the recordings of VS Code, cut for the video
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import { playCut, recPlan } from './timing.js';

const here = import.meta.dirname;
const repo = resolve(here, '../..');
const OUT = resolve(here, 'out');
const FFMPEG =
  process.env.FFMPEG ?? join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe');
const what = process.argv[2] ?? 'all';
mkdirSync(OUT, { recursive: true });

/** The diagrams of chapter 1 (bundled samples) and the one Claude Code wrote in each recording. */
const FLOW = {
  infra: 'examples/01-infra-ha-failover.dav',
  seq: 'examples/05-sequence-payment-retry.dav',
  ent: 'examples/04-enterprise-zero-trust-payment.dav',
};
/** The file Claude Code wrote in the take of each language (take/take.mjs), unedited. */
const ARCH = { ja: 'promo/pv1/architecture-ja.dav', en: 'promo/pv1/architecture-en.dav' };
/** The step of the first sample whose packet carries code. */
const CODE_STEP = 'Writing the order and replicating it';
const read = (path) => readFileSync(resolve(repo, path), 'utf8');
/** 1-based line of the first step. */
const firstStep = (source) => source.split('\n').findIndex((line) => line.startsWith('step "')) + 1;
const metaFile = resolve(OUT, 'meta.json');
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};

if (what === 'exports' || what === 'all') {
  // Editor text, with the extension's TextMate grammar (promo/pv has the highlighter).
  const pairs = [
    ...Object.entries(FLOW).map(([key, path]) => [`../../${path}`, `../pv1/out/hl-${key}.json`]),
    ...Object.entries(ARCH).map(([lang, path]) => [
      `../../${path}`,
      `../pv1/out/hl-arch-${lang}.json`,
    ]),
  ];
  const r = spawnSync(process.execPath, ['highlight.mjs', ...pairs.flat()], {
    cwd: resolve(here, '../pv'),
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error('highlight failed');

  // Vite loads the exporters as the extension build does.
  const vite = await createServer({
    root: resolve(repo, 'apps/vscode'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    const { exportSvg } = await vite.ssrLoadModule('/src/exporter/svg.ts');
    const { exportHtml } = await vite.ssrLoadModule('/src/exporter/export.ts');
    const { parse } = await vite.ssrLoadModule('/src/dsl/index.ts');
    const kb = (text) => Math.round(Buffer.byteLength(text) / 1024);
    const write = (name, text) => {
      writeFileSync(resolve(OUT, name), text);
      console.log(`${name}: ${kb(text)} KB`);
    };
    // The hook: the first sample as "Animated SVG" exports it, held on its first frame, then played.
    write('hook.svg', exportSvg(read(FLOW.infra), { camera: 'follow' }));
    meta.flow = Object.fromEntries(
      Object.entries(FLOW).map(([key, path]) => [key, { line: firstStep(read(path)) }]),
    );
    const codeLine = read(FLOW.infra).split('\n').indexOf(`step "${CODE_STEP}" {`) + 1;
    if (codeLine === 0) throw new Error(`no step "${CODE_STEP}" in ${FLOW.infra}`);
    meta.flow.code = { line: codeLine };
    meta.arch = {};
    for (const [lang, path] of Object.entries(ARCH)) {
      const source = read(path);
      const svg = exportSvg(source, { locale: lang, camera: 'follow' });
      const html = await exportHtml(source, { locale: lang });
      write(`architecture-${lang}.svg`, svg);
      write(`architecture-${lang}.html`, html);
      const { document } = parse(source);
      meta.arch[lang] = {
        line: firstStep(source),
        nodes: document.nodes.length,
        edges: document.edges.length,
        steps: document.steps.length,
        // Packets that carry code.
        code: (source.match(/^\s*code \w+/gm) ?? []).length,
        // The checker's own line in the recording: "ok (9 nodes, 9 edges, 6 steps)".
        counts: `${document.nodes.length} nodes, ${document.edges.length} edges, ${document.steps.length} steps`,
        svgKB: kb(svg),
        htmlKB: kb(html),
      };
    }
  } finally {
    await vite.close();
  }
}

if (what === 'rec' || what === 'all') {
  // The recordings of VS Code (take/take.mjs, take/play.mjs), cut as timing.js says, one picture for
  // every frame of the video. The window is kept whole: the stage frames what it shows.
  const frames = (input, filter, dir) => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const r = spawnSync(
      FFMPEG,
      [
        '-y',
        '-v',
        'error',
        '-i',
        input,
        '-filter_complex',
        filter,
        '-map',
        '[out]',
        '-q:v',
        '3',
        join(dir, 'f%04d.jpg'),
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${dir}`);
    return readdirSync(dir).length;
  };
  const record = (name) => JSON.parse(readFileSync(resolve(here, 'recordings', name), 'utf8'));
  meta.rec = {};
  meta.take = {};
  meta.play = {};
  meta.playFrames = {};
  for (const lang of ['ja', 'en']) {
    const take = record(`take-${lang}.json`);
    const play = record(`play-${lang}.json`);
    meta.take[lang] = { marks: take.marks, boxes: take.boxes };
    meta.play[lang] = { play: play.play, button: play.button, boxes: play.boxes };
    for (const profile of ['long', 'short']) {
      const { segments, length } = recPlan(take.marks, profile);
      const n = segments.length;
      const filter = [
        `[0:v]split=${n}${segments.map((_, i) => `[s${i}]`).join('')}`,
        ...segments.map(
          ([a, b, speed], i) =>
            `[s${i}]trim=${a.toFixed(3)}:${b.toFixed(3)},setpts=(PTS-STARTPTS)/${speed.toFixed(5)},fps=60[v${i}]`,
        ),
        `${segments.map((_, i) => `[v${i}]`).join('')}concat=n=${n}:v=1:a=0[out]`,
      ].join(';');
      const key = `${lang}-${profile}`;
      meta.rec[key] = frames(
        resolve(here, 'recordings', `take-${lang}.mp4`),
        filter,
        resolve(OUT, 'rec', key),
      );
      console.log(
        `rec/${key}: ${meta.rec[key]} frames (${length.toFixed(1)} s; ${segments.map(([, , s]) => `×${s.toFixed(1)}`).join(' ')})`,
      );
      // The playback is recorded larger than the take, and kept larger, so the camera can move in.
      const [from, len] = playCut(play.play, profile);
      meta.playFrames[key] = frames(
        resolve(here, 'recordings', `play-${lang}.mp4`),
        `[0:v]trim=${from.toFixed(3)}:${(from + len).toFixed(3)},setpts=PTS-STARTPTS,fps=60,scale=3200:-2:flags=lanczos[out]`,
        resolve(OUT, 'play', key),
      );
      console.log(`play/${key}: ${meta.playFrames[key]} frames`);
    }
  }
}

writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`);
