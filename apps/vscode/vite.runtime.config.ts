import { defineConfig } from 'vite';

/**
 * Builds the standalone player runtime (IIFE) that is inlined into exported HTML.
 * Output is consumed by src/exporter via `?raw` and is not committed.
 */
export default defineConfig({
  build: {
    outDir: 'src/runtime/generated',
    emptyOutDir: true,
    minify: true,
    target: 'es2022',
    lib: {
      entry: 'src/runtime/standalone.ts',
      formats: ['iife'],
      name: 'DavRuntime',
      fileName: () => 'player.js',
    },
  },
});
