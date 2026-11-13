import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { lezer } from '@lezer/generator/rollup';
import { defineConfig } from 'vite';

/**
 * Bundles the VS Code Extension Host entry (`src/extension/extension.ts`) into
 * `dist/extension.cjs` plus lazy CommonJS chunks (`dist/chunks/*.cjs`) for command-only
 * features (`exporter`, `prompt`, `samples`, `skillInstall`), with `vscode` marked external.
 */
export default defineConfig({
  plugins: [
    {
      name: 'clean-extension-chunks',
      buildStart() {
        rmSync(resolve(import.meta.dirname, 'dist/chunks'), { recursive: true, force: true });
      },
    },
    lezer(),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/extension/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.cjs',
    },
    rollupOptions: {
      external: ['vscode', /^node:/],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].cjs',
      },
    },
  },
});
