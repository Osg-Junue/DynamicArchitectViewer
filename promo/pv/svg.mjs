// Exports the animated SVGs of the READMEs and docs with the extension's own exporter:
//   node svg.mjs                      one SVG for every file in examples/, into docs/media/examples/
//   node svg.mjs <file.dav> <out.svg> [follow|whole] [step]   exports one file, to try things out
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const repo = resolve(import.meta.dirname, '../..');
const TARGET = 'docs/media/examples';

/** Paths from the repository root. `step` is 1-based, as the preview numbers steps. */
const [from, to, camera = 'follow', step] = process.argv.slice(2);
const images = from
  ? [{ from, to, camera, step: step ? Number(step) : undefined }]
  : readdirSync(resolve(repo, 'examples'))
      .filter((file) => file.endsWith('.dav'))
      .map((file) => ({
        from: `examples/${file}`,
        to: `${TARGET}/${file.replace(/\.dav$/, '.svg')}`,
        camera: 'follow',
      }));
if (!from) mkdirSync(resolve(repo, TARGET), { recursive: true });

// Vite loads the exporter as the extension build does, with the scene's CSS inlined as text.
const vite = await createServer({
  root: resolve(repo, 'apps/vscode'),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { exportSvg } = await vite.ssrLoadModule('/src/exporter/svg.ts');
  for (const image of images) {
    const svg = exportSvg(readFileSync(resolve(repo, image.from), 'utf8'), {
      camera: image.camera,
      step: image.step === undefined ? undefined : image.step - 1,
    });
    writeFileSync(resolve(repo, image.to), svg);
    console.log(`${image.to}: ${(svg.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await vite.close();
}
