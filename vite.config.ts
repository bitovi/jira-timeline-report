/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the dev server is reachable from outside a
    // Docker container (not just localhost inside the container).
    host: '0.0.0.0',
    port: 5173,
    watch: {
      // Poll for file changes so HMR works with volume-mounted source on
      // macOS/Windows Docker, where native filesystem events aren't delivered.
      usePolling: true,
    },
  },
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
