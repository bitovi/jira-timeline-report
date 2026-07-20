# timeline-report shell — React rewrite plan

> Replaces the `<timeline-report>` CanJS `StacheElement` (`src/timeline-report.js`) with a declarative
> React tree, while **keeping `routeData` as-is** (it's the final keystone — migrates after this). See
> [behavior.md](./behavior.md) for the 1:1 behavior contract this port must preserve, and
> [../build-order.md](../build-order.md) for where this sits.

## Guiding constraints

1. **`routeData` stays CanJS.** The ported shell reads it through the existing
   `src/react/hooks/useCanObservable/useCanObservable.ts` bridge. Do **not** touch `route-data.js` here.
2. **`can.js` stays** until route-data is migrated. This port removes one _consumer_ of CanJS
   (`StacheElement`, `queues`, the imperative `value.from`/`value.bind` wiring in the shell), not the
   framework.
3. **Behavior parity first.** The data pipeline (behavior.md §3) is pure logic and must produce
   identical output. Cleanups (dead helpers, per-report providers) are welcome but must not change
   report output.
4. **Reuse the existing React chrome + report components.** They already exist and are mounted today via
   `createRoot`; the rewrite just renders them as JSX instead.

## Target architecture

```
main-helper.js
  └─ createRoot(#app-root).render(
       <AppProviders>            // QueryClientProvider + JiraProvider, mounted ONCE (not per-report)
         <BootstrapGate>         // replaces the imperative timelineReportNeedsMet gate
           <TimelineReport />    // the ported shell (was the StacheElement)
         </BootstrapGate>
       </AppProviders>)

TimelineReport.tsx
  ├─ useReportData()            // the §3 pipeline as a hook (useCanObservable + useMemo)
  ├─ <SettingsSidebar/>         // when logged in
  ├─ <ViewReports/> <SampleDataNotice/> <SavedReports/> <ReportControls/>
  ├─ <ReportStateBoundary>      // no-jql / loading / empty / error / resolved  (behavior.md §7)
  │    ├─ <PrintHeader/>
  │    ├─ <PrimaryReportHost/>  // registry lookup by primaryReportType; React.lazy-ready (see progressive-loading.md)
  │    ├─ <SecondaryReportHost/>// WorkBreakdown when secondary is status/breakdown
  │    └─ <ReportFooter/>
  └─ useFullishHeight()         // the --fullish-document-top effect
```

## Report prop contract — DECIDED: Option A (preserve the `*Obs` contract)

Reports today receive ~30 **observable** props (`primaryIssuesOrReleasesObs`,
`value.bind(routeData,'roundTo')`, …) and unwrap them internally with `useCanObservable`. **Decision
(2026-07-18): keep that contract.** The shell computes the derived data with `useMemo`, then re-wraps
each value as a CanJS `value` observable (a tiny `useObservableOf(value)` adapter) and passes the same
`*Obs` props. **Zero changes to the 10 report components** — this isolates the shell rewrite and keeps
it reviewable. The thin CanJS `value` shim stays in the shell and is removed later when route-data
migrates (at which point reports can move to plain props for free).

> Rejected alternative (Option B): switch every report to plain props + a `useRouteData()` hook now.
> Cleaner end state, but touches all 10 reports + WorkBreakdown and expands scope/risk. Deferred to
> after the route-data keystone.

## Phased steps

### Phase 0 — Scaffolding & tests (no behavior change)

- Create `src/react/TimelineReport/` (`TimelineReport.tsx`, `index.ts`, hooks/, components/).
- Capture a behavior baseline: Storybook stories + a Playwright pass exercising each report type, the
  switch, and every view state (behavior.md checklist). Snapshot `logReportData` output for 2-3 report
  types with fixed sample data — this is the pipeline regression oracle.

### Phase 1 — Extract the data pipeline into a hook

- Move behavior.md §3 into `useReportData()` (or a pure `deriveReportData(routeData snapshot)` +
  `useMemo`). Read each `routeData` input via `useCanObservable`. The heavy transforms
  (`rollupAndRollback`, `calculateReportStatuses`, `groupIssuesByHierarchyLevelOrType`,
  `matchesAllFilterRows`) are already pure imports — just re-wire.
- Unit-test the hook against the snapshotted outputs from Phase 0. **Gate: identical output.**
- Keep the `logReportData` feature-flag log.

### Phase 2 — Build `TimelineReport.tsx` (chrome + states, no report host yet)

- Render the scaffold JSX (behavior.md §6/§7): sidebar (when `showingConfiguration`), view-reports,
  sample-data notice, saved reports, controls, and the state boundary (no-jql / loading+progress /
  empty / error) — translating each Stache conditional to JSX.
- Replace the imperative `createRoot`-into-div mounts with direct JSX children.
- `useFullishHeight()` effect for the `--fullish-document-top` var + load/resize listeners.
- `getTheme(...).then(applyThemeToCssVars)` in an effect.

### Phase 3 — Primary + secondary report hosts

- `<PrimaryReportHost>`: look up `urlParamValuesToReactComponents[primaryReportType]`, render with props
  (Option A: build the `*Obs` bag once). Report **switching is now a React re-render** — the
  `listenTo('primaryReportType')` + attach/detach dance disappears.
- `<SecondaryReportHost>`: render `<WorkBreakdown>` when `secondaryReportType ∈ {status, breakdown}`.
- Move `QueryClientProvider` + `JiraProvider` up to `AppProviders` (mounted once) instead of wrapping
  every report render.
- Keep this registry as the seam for `React.lazy` — see [progressive-loading.md](./progressive-loading.md).

### Phase 4 — Bootstrap swap in `main-helper.js`

- Replace `new TimelineReport().initialize({...}); mainContent.append(report)` with
  `createRoot(container).render(<AppProviders><BootstrapGate>…</BootstrapGate></AppProviders>)`.
- `BootstrapGate` reproduces `timelineReportNeedsMet`: block on `loginStore.resolved` and (when
  `?report=` present) the `getAllReports` seed, showing `#loadingJira` until met. The `initialize`
  props become React props/context (`jiraHelpers`, `loginComponent`, `storage`, `linkBuilder`,
  `showSidebarBranding`, `featuresPromise`).
- `LoginButton` / `SelectCloud` nav mounts are untouched (already React, outside the shell).

### Phase 5 — Delete the old shell & cleanup

- Delete `customElements.define('timeline-report', …)`, the `StacheElement` class, dead helpers
  (`sortReadyFirst`, `addTeamBreakdown`), and the `queues`/imperative-`value` shell wiring.
- Confirm `can.js` imports removed **from the shell** (still present elsewhere until route-data goes).
- Run the Phase 0 Playwright/Storybook baseline. **Gate: green + pipeline snapshots unchanged.**

## Risks & watch-outs

- **Mount/unmount cleanup.** `on:inserted`/`on:removed` currently drive `createRoot`/`unmount` for
  print-header, footer, and both report containers. In React these become conditional children — verify
  no double-mount and that report **unmount cleanup** (subscriptions, tooltips) still fires on switch.
- **Switch timing.** The old code re-uses one root across type changes; React will unmount/remount on
  key change. Give `<PrimaryReportHost>` a `key={primaryReportType}` if a report holds internal state
  that must reset (matches today's detach+attach), or omit the key to preserve state — decide per report.
- **`queues.batch` write-back.** The teams-config update writes two `routeData` props in a batch; keep
  the batch (still CanJS) so consumers don't recompute twice.
- **Provider move.** Reports currently assume they're inside `QueryClientProvider` + `JiraProvider`
  (mounted per-render). Hoisting to `AppProviders` must cover **every** report path incl. the secondary.
- **Observable identity (Option A).** The `useObservableOf` adapter must return a stable observable and
  push new values on change, or reports using `useCanObservable` won't update. Test switching + data
  refresh.

## Verification

- Playwright e2e over all report types + view states (Phase 0 baseline).
- `logReportData` snapshot parity for the pipeline (Phase 1 gate).
- `npm run typecheck`, `npm run test`, Storybook visual check.
- Manual: login gate, JQL entry, report switch, print view, theme, sidebar teams-config save.

## Sequencing vs the other keystone

Shell first (this plan) → **then** `route-data.js` + `useCanObservable` swap (final keystone), after
which `can.js` and the Option-A observable shim can be deleted, and Option B (plain report props)
becomes free. Progressive loading is introduced **during Phase 3** of this port (the lazy registry) —
see [progressive-loading.md](./progressive-loading.md).
