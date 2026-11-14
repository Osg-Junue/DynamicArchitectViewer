import { resolve } from 'node:path';
import { lezer } from '@lezer/generator/rollup';
import { defineConfig } from 'vite';

/**
 * Builds the playground (`src/playground`) into `dist/playground`: a page for GitHub Pages where
 * a diagram is written and played without VS Code, with the extension's preview beside a Monaco
 * editor. It is not part of the extension, and the VSIX leaves it out. Run `build:runtime` first:
 * exporting HTML inlines the player from `src/runtime/generated`.
 */
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/playground'),
  // Relative, because the pages of a project are served under the repository's name.
  base: './',
  plugins: [lezer()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist/playground'),
    emptyOutDir: true,
    // Keeps light-dark() native, as the webview's build does.
    cssTarget: 'chrome123',
  },
});
