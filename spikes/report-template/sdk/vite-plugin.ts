import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';

/**
 * Stand-in for `@bitovi/report-sdk/vite`.
 * - dev: installs the mock runtime (sample data) before the report runs.
 * - build: embeds the manifest so the approved hash covers it.
 * Pair with vite-plugin-singlefile so the output is one self-contained report.html.
 */
export function reportSdk({ manifest }: { manifest: string }): Plugin {
  let isBuild = false;
  return {
    name: 'report-sdk',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    transformIndexHtml() {
      if (!isBuild) {
        return [{ tag: 'script', attrs: { type: 'module', src: '/sdk/dev-host.ts' }, injectTo: 'head-prepend' }];
      }
      const json = readFileSync(manifest, 'utf8');
      JSON.parse(json);
      return [
        {
          tag: 'script',
          attrs: { type: 'application/json', id: 'report-manifest' },
          children: json.replace(/</g, '\\u003c'),
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}
