import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Copies `public/images` into the build output.
 *
 * Vite's own `publicDir` is off here: with `root: 'forge'` it would default to `forge/public`, and
 * pointing it at the repo's `public/` would also sweep in `examples/` and the generated
 * `atlassian-connect.json`, neither of which the Forge bundle has any use for. Every byte in
 * `dist-forge` is uploaded on `forge deploy` and counts against the production weekly quota.
 */
const copyImages = (): Plugin => ({
  name: 'forge-copy-images',
  apply: 'build',
  closeBundle() {
    const from = resolve(__dirname, 'public/images');

    if (!existsSync(from)) {
      return;
    }

    cpSync(from, resolve(__dirname, 'dist-forge/images'), { recursive: true });
  },
});

/**
 * The Forge Custom UI build.
 *
 * Separate from `vite.config.ts` — and pointed at its own `dist-forge/` — because
 * `resources.path` in manifest.yml uploads *everything* under the directory it names. `dist/`
 * carries ~700 `tsc` transpile artifacts (tsconfig.json sets `outDir: ./dist` with no `noEmit`)
 * plus a large unminified dev build that `vite.dev.config.ts` never clears.
 */
export default defineConfig({
  root: 'forge',
  // Relative asset URLs. Forge serves the bundle from a path prefix rather than an origin root,
  // so Vite's default absolute `/assets/...` would resolve outside the app.
  base: './',
  plugins: [react(), copyImages()],
  publicDir: false,
  // Same rationale as vite.config.ts: some transitive Atlaskit editor deps read `process.env.CI`
  // at module scope, and Vite only substitutes `NODE_ENV`.
  define: {
    'process.env.CI': 'false',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        'process.env.CI': 'false',
      },
    },
  },
  server: {
    host: '0.0.0.0',
    // Must match `resources[].tunnel.port` in manifest.yml.
    port: 5173,
    fs: {
      // The entry HTML lives in `forge/` but imports `../src/forge.main.ts`, which is outside the
      // Vite root. The dev server refuses to serve files above the root without this.
      allow: [resolve(__dirname)],
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-forge'),
    // Unlike the dev build, this one owns its output directory outright — stale chunks left behind
    // would still be uploaded by `forge deploy`.
    emptyOutDir: true,
  },
});
