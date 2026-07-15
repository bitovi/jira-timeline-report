/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// `dist/production.css` is written by a separate `tailwindcss --watch` process (see `npm
// run dev:css`), not by Vite's own build — but Vite's dev server intercepts *every* `.css`
// request (including the plain `<link>` in index.html) through its CSS-transform/HMR
// pipeline and caches the result in its module graph. Because `dist/` is also Vite's
// `build.outDir`, that cache never gets invalidated when the Tailwind watcher rewrites the
// file, so the dev server can end up serving an arbitrarily stale copy until restarted.
// This plugin serves the file straight from disk on every request, ahead of Vite's own
// middlewares, so it's always current.
const serveFreshProductionCss = (): Plugin => ({
  name: 'serve-fresh-production-css',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/dist/production.css')) {
        next();
        return;
      }

      res.setHeader('Content-Type', 'text/css');
      res.setHeader('Cache-Control', 'no-store');
      res.end(readFileSync(resolve(__dirname, 'dist/production.css')));
    });
  },
});

export default defineConfig({
  plugins: [react(), serveFreshProductionCss()],
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
