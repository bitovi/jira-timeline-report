# Progressive (lazy) report loading — sanity check + plan

> Goal: load each report's code **on demand** instead of shipping all 10 in the initial bundle. This
> rides on the [shell rewrite](./rewrite-plan.md) (the report registry becomes the `React.lazy` seam).
> The numbers below are empirical — measured with the project's real Vite pipeline; see
> [Reproducibility](#reproducibility).

## Sanity check — how much is each report? (min + gzip)

Measured by building the 10 report entry points through Vite/Rollup with code-splitting and attributing
each chunk to the entries that reach it (unique = deferrable, shared-by-≥2 = baseline). Gzip = zlib
level 6.

| Report                     | raw-min KB |  gzip KB | Heaviest unique dep                                                              |
| -------------------------- | ---------: | -------: | -------------------------------------------------------------------------------- |
| **EstimateAnalysis**       |        388 |  **107** | **recharts** (~330 KB raw; only report using it)                                 |
| **AutoScheduler**          |        315 |   **78** | `@atlaskit/flag` tree + own scheduler/stats; 17 KB gz is a _dynamic_ modal chunk |
| **GroupingReport**         |        214 |   **59** | large unique `@atlaskit` component tree                                          |
| FlowMetrics                |         55 |       16 | @atlaskit + custom SVG charts (+8 KB unique CSS)                                 |
| GanttGrid                  |         22 |        7 | own code (no heavy unique lib)                                                   |
| TimeInStatus               |         18 |        7 | own code + light jstat                                                           |
| WorkBreakdown (secondary)  |         18 |        6 | own code                                                                         |
| ScatterTimeline            |         13 |        5 | own code (custom SVG)                                                            |
| EstimationProgress         |         12 |        3 | own code                                                                         |
| EstimationTable            |         10 |        3 | own code                                                                         |
| **Sum of all report code** |   **1064** | **~290** |                                                                                  |

**Shared baseline (loads regardless of report): 1045 KB raw / 310 KB gzip.** Contains react-dom (~42
gz), react-query + @atlaskit icons (~30 gz), @atlaskit modal/popup/button/primitives (~90 gz combined),
jstat (~17 gz), shared jira/rollup helpers (~10 gz), and — notably — the **`can-*` CanJS observable npm
packages** pulled in through the route-data bridge (inside a 115 gz `useRouteData` chunk).

**`src/can.js`** (the legacy CanJS framework blob, imported by the shell + route-data, _separate_ from
the `can-*` packages above): 362 KB min / **105 KB gzip**, loaded on every page today.

### What this means

- **Eager (today): baseline 310 + all reports 290 = ~600 KB gz** of report/shared JS — **plus** `can.js`
  (105 gz) and the shell + chrome (SettingsSidebar etc., not in this measurement). Everyone downloads
  every report even though they view one.
- **Lazy: initial load = baseline 310 + only the viewed report.** Landing on a light report
  (table/scatter) ⇒ ~315 gz; the heaviest (EstimateAnalysis) ⇒ ~417 gz. So lazy loading **cuts
  ~180–290 KB gz from the first download**, and specifically stops shipping **recharts (~330 KB raw)** to
  the majority who never open EstimateAnalysis.
- **The weight is lopsided: 84% of the deferrable code is in 3 reports** — EstimateAnalysis (107) +
  AutoScheduler (78) + GroupingReport (59) = 244 gz. The other 7 are 3–7 KB gz each (splitting them is
  basically free but individually negligible).
- **Bigger picture:** the single largest always-loaded cost is **CanJS** — `can.js` (105 gz) + the
  `can-*` packages in the baseline. That's removed by the **route-data keystone** (the migration _after_
  the shell), and it benefits **100% of loads** regardless of report. Progressive report loading and
  CanJS removal are comparable-sized wins attacking different parts of the load: per-report deferral vs.
  the shared baseline.

**Verdict:** progressive report loading is worth doing — it's cheap (falls out of the shell rewrite),
removes the recharts elephant from the common path, and trims ~180–290 KB gz off first paint. But scope
the _value_ to the 3 heavy reports; lazy-load the rest uniformly only because it costs nothing extra via
the registry. The complementary and equally large win is killing CanJS (separate keystone).

## Plan

Introduced in **Phase 3 of the [shell rewrite](./rewrite-plan.md)** — the primary-report registry is the
natural `React.lazy` seam.

1. **Convert the registry to lazy imports.** Today `urlParamValuesToReactComponents` maps types to
   statically-imported components. Change each value to `React.lazy(() => import('…/Report'))`:
   ```ts
   const reportRegistry = {
     'estimate-analysis': lazy(() => import('./reports/EstimateAnalysis/EstimateAnalysis')),
     due: lazy(() => import('./reports/ScatterTimeline')),
     // …all 9
   };
   ```
   Do the same for the **secondary `WorkBreakdown`** (6 gz, but keeps the pattern uniform).
2. **Wrap the host in `<Suspense>`** with a fallback matching today's "Loading…" report state
   (behavior.md §7) so a report swap shows the same loading affordance while its chunk downloads.
3. **Error boundary per report.** Wrap each lazy report in `react-error-boundary` (already a dep) so a
   failed chunk fetch degrades to a retry message instead of blanking the shell.
4. **Prefetch to hide the latency.** After the shell is idle (`requestIdleCallback`) or on hover of the
   report picker, warm the likely-next chunk with a bare `import('…')`. Cheap; removes the visible spinner
   for the common switch.
5. **Verify chunk boundaries.** After wiring, rebuild and confirm recharts lands **only** in the
   EstimateAnalysis chunk and the shared baseline didn't absorb a report's unique deps (re-run the
   analysis in [Reproducibility](#reproducibility)). Guard against Rollup hoisting a "unique" dep into
   shared if a second importer sneaks in later.

### Nice-to-haves (later, not required)

- **Split `AutoScheduler`'s modal further** — its 17 gz modal is already a dynamic import; confirm it
  stays deferred until the modal opens.
- **Consider lazy-loading the heavy chrome** too (SettingsSidebar's teams-config forms) — not measured
  here, but it's only needed when the sidebar opens.
- **Route-based prefetch:** if `?report=` is in the URL at boot, prefetch that report's chunk during the
  login gate so it's ready when the shell mounts.

## Sequencing & interaction with the other keystone

- **Now / with the shell rewrite:** lazy report loading (this doc). No dependency on route-data.
- **After route-data migrates (final keystone):** `can.js` (105 gz) and the `can-*` baseline packages
  drop out — the largest always-loaded win, orthogonal to report splitting.
- Together: initial load goes from ~600 gz report/shared JS **+ 105 gz can.js** (everyone, every report)
  → **baseline-minus-CanJS + one report** on first paint.

## Reproducibility

Artifacts live under `temp/bundle-analysis/` (untracked):

- `vite.bundle.config.ts` — 10 report entries, code-splitting on, no HTML entry, `minify:'esbuild'`.
- Build: `npx vite build --config temp/bundle-analysis/vite.bundle.config.ts` → `out/` (42 JS chunks).
- `sizes.mjs` — walks the import graph, classifies unique vs shared, gzips each chunk.
- `manifest.json` — Rollup's authoritative chunk graph; `can.min.js` — the minified can.js.

Caveats: recharts is inlined into the EstimateAnalysis entry (not a separate chunk) because it has one
importer — correct for lazy-load sizing. The global Tailwind `dist/production.css` is built outside Vite
and excluded. The shell + chrome components themselves aren't in these figures (report-scoped
measurement), so production initial load is somewhat larger than the baseline number.
