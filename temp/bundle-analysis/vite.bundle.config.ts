import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Captures Rollup's authoritative chunk graph (static + dynamic imports + CSS)
// into manifest.json so sizes.mjs can do exact unique-vs-shared attribution.
const dumpManifest = (): Plugin => ({
  name: 'dump-manifest',
  generateBundle(_opts, bundle) {
    const chunks: Record<string, unknown> = {};
    for (const [fileName, out] of Object.entries(bundle)) {
      if (out.type !== 'chunk') continue;
      chunks[fileName] = {
        fileName,
        name: out.name,
        isEntry: out.isEntry,
        imports: out.imports,
        dynamicImports: out.dynamicImports,
        importedCss: Array.from(((out as any).viteMetadata?.importedCss as Set<string>) ?? []),
      };
    }
    writeFileSync(resolve(__dirname, 'manifest.json'), JSON.stringify(chunks, null, 2));
  },
});

// Throwaway config for empirical per-report bundle-size analysis.
// Reuses the project's real @vitejs/plugin-react so all loaders/plugins/CSS/SVG
// handling behave exactly as in the app build. Each report is a separate
// library-style entry; Rollup's default code-splitting hoists shared code into
// shared chunks. See sizes.mjs for the entry-unique vs shared attribution.

const ROOT = resolve(__dirname, '../..');
const r = (p: string) => resolve(ROOT, p);

export default defineConfig({
  root: ROOT,
  configFile: false,
  plugins: [react(), dumpManifest()],
  logLevel: 'info',
  define: {
    // Ensure production-mode dead-code elimination (matches a real prod build).
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: resolve(__dirname, 'out'),
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
    rollupOptions: {
      // Library-style entries: no HTML entry, keep each report an entry chunk.
      preserveEntrySignatures: 'exports-only',
      input: {
        EstimateAnalysis: r('src/react/reports/EstimateAnalysis/EstimateAnalysis.tsx'),
        AutoScheduler: r('src/react/reports/AutoScheduler/AutoScheduler.tsx'),
        EstimationProgress: r('src/react/reports/EstimationProgress/EstimationProgress.tsx'),
        GroupingReport: r('src/react/reports/GroupingReport/GroupingReport.tsx'),
        FlowMetrics: r('src/react/reports/FlowMetrics/FlowMetrics.tsx'),
        TimeInStatus: r('src/react/reports/TimeInStatus/TimeInStatus.tsx'),
        ScatterTimeline: r('src/react/reports/ScatterTimeline/index.ts'),
        WorkBreakdown: r('src/react/reports/WorkBreakdown/index.ts'),
        GanttGrid: r('src/react/reports/GanttReport/GanttGrid/GanttGrid.tsx'),
        EstimationTable: r('src/react/reports/EstimationTable/index.ts'),
      },
      output: {
        format: 'es',
        entryFileNames: 'entry-[name].js',
        chunkFileNames: 'chunk-[name].[hash].js',
        assetFileNames: 'asset-[name].[hash][extname]',
      },
    },
  },
});
