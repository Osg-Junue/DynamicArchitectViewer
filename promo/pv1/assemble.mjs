// Joins the rendered scenes and adds the sound: node assemble.mjs [long|short|all] [ja|en|all]
//   out/DynamicArchitectViewer-1.0-long-<lang>.mp4   the main video (88 s)
//   out/DynamicArchitectViewer-1.0-sns-<lang>.mp4    the cut for social media (36 s)
// Run prepare.mjs, capture.mjs and score.mjs first (see README.md).
import { spawnSync } from 'node:child_process';
import { statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ORDER } from './timing.js';

const here = import.meta.dirname;
const OUT = resolve(here, 'out');
const FFMPEG =
  process.env.FFMPEG ?? join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Links/ffmpeg.exe');
const [what = 'all', which = 'all'] = process.argv.slice(2);

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-y', '-v', 'error', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

for (const profile of what === 'all' ? ['long', 'short'] : [what]) {
  for (const lang of which === 'all' ? ['ja', 'en'] : [which]) {
    const list = resolve(OUT, profile, `list-${lang}.txt`);
    writeFileSync(list, ORDER.map((scene) => `file '${scene}-${lang}.mp4'\n`).join(''));
    // Every scene comes from the same encoder with the same settings, so they join without re-encoding.
    const silent = resolve(OUT, profile, `silent-${lang}.mp4`);
    ffmpeg([
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      list,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      silent,
    ]);
    const score = resolve(OUT, `score-${profile}-${lang}.wav`);
    const file = resolve(
      OUT,
      `DynamicArchitectViewer-1.0-${profile === 'short' ? 'sns' : 'long'}-${lang}.mp4`,
    );
    ffmpeg([
      '-i',
      silent,
      '-i',
      score,
      '-map',
      '0:v',
      '-map',
      '1:a',
      '-c:v',
      'copy',
      '-af',
      'loudnorm=I=-15:TP=-1.5:LRA=11,aresample=48000',
      '-c:a',
      'aac',
      '-b:a',
      '256k',
      '-shortest',
      '-movflags',
      '+faststart',
      file,
    ]);
    console.log(`${file} ${(statSync(file).size / 1e6).toFixed(1)} MB`);
  }
}
