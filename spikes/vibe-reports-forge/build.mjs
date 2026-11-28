import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';

await rm('static/dist', { recursive: true, force: true });
await mkdir('static/dist', { recursive: true });
await build({
  entryPoints: ['static/src/host.js'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'static/dist/host.js',
  loader: { '.html': 'text' },
  logLevel: 'info',
});
await copyFile('static/src/index.html', 'static/dist/index.html');
await copyFile('static/src/host.css', 'static/dist/host.css');
