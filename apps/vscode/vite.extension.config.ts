import { resolve } from 'node:path';
import { lezer } from '@lezer/generator/rollup';
import { defineConfig } from 'vite';

/**
 * Bundles the VS Code Extension Host entry (`src/extension/extension.ts`) into a
 * single CommonJS file (`dist/extension.cjs`) with `vscode` marked external.
 */
export default defineConfig({
  plugins: [lezer()],
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
    },
  },
});
