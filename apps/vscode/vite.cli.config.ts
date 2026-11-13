import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lezer } from '@lezer/generator/rollup';
import { defineConfig } from 'vite';

const PACKAGE = resolve(import.meta.dirname, '../cli');
const { version } = JSON.parse(readFileSync(resolve(PACKAGE, 'package.json'), 'utf8')) as {
  version: string;
};

/**
 * Bundles the command line (`src/cli/dav.ts`) into `apps/cli/dist/dav.mjs`, the one file the
 * npm package carries. It holds the parser, the exporters and the player that exported HTML
 * inlines, so the package has no dependencies. Run `build:runtime` first: the player is
 * read from `src/runtime/generated`.
 */
export default defineConfig({
  plugins: [lezer()],
  define: { __DAV_VERSION__: JSON.stringify(version) },
  build: {
    outDir: resolve(PACKAGE, 'dist'),
    emptyOutDir: true,
    minify: true,
    target: 'node20',
    lib: {
      entry: resolve(import.meta.dirname, 'src/cli/dav.ts'),
      formats: ['es'],
      fileName: () => 'dav.mjs',
    },
    rollupOptions: {
      external: [/^node:/],
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
  },
});
