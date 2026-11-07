import { lezer } from '@lezer/generator/rollup';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [lezer(), react()],
});
