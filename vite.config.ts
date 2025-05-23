/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, '/index.html'),
        oauth: resolve(__dirname, '/oauth-callback.html'),
        connect: resolve(__dirname, '/connect.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globalSetup: './vitest-global.ts',
    setupFiles: './vitest.setup.ts',
    globals: true,
  },
});
