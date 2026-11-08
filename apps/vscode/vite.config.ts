import { lezer } from '@lezer/generator/rollup';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [lezer()],
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    // Keeps light-dark() native: lowered, it resolves on :root and ignores nested color-scheme,
    // such as VS Code's theme classes on <body>.
    cssTarget: 'chrome123',
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
