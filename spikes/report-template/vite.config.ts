import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { reportSdk } from './sdk/vite-plugin';

export default defineConfig({
  plugins: [react(), reportSdk({ manifest: 'report.manifest.json' }), viteSingleFile()],
  resolve: {
    alias: { '@bitovi/report-sdk': fileURLToPath(new URL('./sdk/index.ts', import.meta.url)) },
  },
  build: { outDir: 'dist', assetsInlineLimit: Number.MAX_SAFE_INTEGER },
  server: { fs: { allow: ['../..'] } },
});
