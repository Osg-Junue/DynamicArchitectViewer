import { lezer } from '@lezer/generator/rollup';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [lezer()],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/webview.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/webview[extname]',
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
