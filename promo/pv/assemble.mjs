// Joins rendered cuts into the deliverables: node assemble.mjs [pv|short|gifs|all]
//   pv     out/pv-ja.mp4, out/pv-en.mp4       (main cut with sound)
//   short  out/pv-short-ja.mp4, -en.mp4       (SNS cut with sound)
//   gifs   apps/vscode/media/demo.gif and docs/media/*.gif from the --docs renders
// Run capture.mjs, build-rec.mjs and sfx.mjs first (see README.md).
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const repo = resolve(here, '../..');
const OUT = resolve(here, 'out');
const FFMPEG =
  process.env.FFMPEG ?? join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe');
const what = process.argv[2] ?? 'all';

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}
const H264 = [
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
  '-an',
  '-movflags',
  '+faststart',
];

/** Concatenates [cut, outpoint?] (re-encoding, so cuts from different encoders join cleanly) and adds the sound. */
function video(name, cuts, lang, sound) {
  const list = resolve(OUT, `list-${name}-${lang}.txt`);
  writeFileSync(
    list,
    cuts.map(([c, out]) => `file '${c}-${lang}.mp4'\n${out ? `outpoint ${out}\n` : ''}`).join(''),
  );
  const silent = resolve(OUT, `silent-${name}-${lang}.mp4`);
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, ...H264, silent]);
  const norm = resolve(OUT, sound.replace('.wav', '-norm.wav'));
  ffmpeg(['-i', resolve(OUT, sound), '-af', 'loudnorm=I=-20:TP=-1.5:LRA=11,aresample=48000', norm]);
  const file = resolve(OUT, `${name}-${lang}.mp4`);
  ffmpeg([
    '-i',
    silent,
    '-i',
    norm,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    file,
  ]);
  console.log(`${file} ${(statSync(file).size / 1e6).toFixed(1)} MB`);
}

/** A looping GIF of the VS Code window only (the frame at 64,40 1792x890), 960 px wide, 15 fps. */
function gif(cut, target) {
  const dest = resolve(repo, target);
  mkdirSync(resolve(dest, '..'), { recursive: true });
  const base = 'crop=1792:890:64:40,fps=15,scale=960:-1:flags=lanczos';
  ffmpeg([
    '-i',
    resolve(OUT, `${cut}-docs.mp4`),
    '-filter_complex',
    `${base},split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-loop',
    '0',
    dest,
  ]);
  console.log(`${target} ${(statSync(dest).size / 1e6).toFixed(1)} MB`);
}

const PV = [
  'c01_hook',
  'c02_title',
  'c03_new',
  'c04_skill',
  'c05_rec',
  'c06_cursor',
  'c07_follow',
  'c08_docs',
  'c09a_export',
  'c09b_html',
  'c10_end',
].map((c) => [c]);
const SHORT = [['c01_hook'], ['c02_title'], ['c05_short'], ['c07_follow', 7.5], ['c10_end', 4.5]];

if (what === 'pv' || what === 'all')
  for (const lang of ['ja', 'en']) video('pv', PV, lang, `sfx-${lang}.wav`);
if (what === 'short' || what === 'all')
  for (const lang of ['ja', 'en']) video('pv-short', SHORT, lang, `sfx-short-${lang}.wav`);
if (what === 'gifs' || what === 'all') {
  gif('c06_cursor', 'apps/vscode/media/demo.gif');
  gif('c07_follow', 'docs/media/follow.gif');
  gif('c04_skill', 'docs/media/skill-install.gif');
  gif('c08_docs', 'docs/media/docs-guide.gif');
}
