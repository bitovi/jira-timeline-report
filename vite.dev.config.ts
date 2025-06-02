/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false,
    minify: false,
    sourcemap: 'inline',
    rollupOptions: {
      input: {
        dev: resolve(__dirname, '/dev.html'),
      },
    },
  },
});
