import { lezer } from '@lezer/generator/rollup';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [lezer(), react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
