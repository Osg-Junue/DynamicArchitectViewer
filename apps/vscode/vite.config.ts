import { lezer } from '@lezer/generator/rollup';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [lezer(), react()],
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
