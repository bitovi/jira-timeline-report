# timeline-report shell — behavior & features

> Source of truth for what the `<timeline-report>` shell does today, captured **before** the React
> rewrite so we can verify the port preserves behavior 1:1. File: `src/timeline-report.js`
> (~593 lines, `StacheElement`). This is the last large CanJS component and the second-to-last
> keystone in [spec/011](../build-order.md) (route-data migrates after it).

## 1. What it is / where it sits

`<timeline-report>` is the **app shell**: the page scaffold that owns the report-page layout, derives
the data every report consumes, and hosts all the React reports + chrome. It is a CanJS
`StacheElement` custom element (`customElements.define('timeline-report', …)`), instantiated
imperatively by the bootstrap after the login gate resolves — it is **not** mounted declaratively.

### Mount context (from `index.html` + `src/shared/main-helper.js`)

- **DOM scaffold** (`index.html`): `#mainContent` holds a top `<nav>` (containing `#select-cloud` and
  `#login` — mounted by `main-helper`, **outside** the shell) and `#loadingJira` (a "Loading…"
  placeholder shown until the app mounts). The entry is `src/web.main.ts` → `mainHelper({host:'hosted', …})`.
- **Bootstrap** (`main-helper.js`): builds `jiraHelpers`, `storage`, `linkBuilder`; constructs the
  `Login` observable store; sets `routeData.isLoggedInObservable`, `routeData.jiraHelpers`,
  `routeData.storage`, `routeData.licensingPromise`.
- **Mount gate**: the shell only mounts once **all** `timelineReportNeedsMet` are true —
  `loginResolved` (awaits `loginStore.resolved`) and, **if** a `?report=` param is present,
  `reportData` (awaits `getAllReports` → seeded into React Query). Then:
  ```js
  const report = new TimelineReport().initialize({
    jiraHelpers,
    loginComponent: loginStore,
    mode: 'TEAMS',
    storage,
    linkBuilder,
    showSidebarBranding,
    featuresPromise,
  });
  report.className = 'flex flex-1 overflow-hidden';
  mainContent.append(report); // + hides #loadingJira
  ```
- `featuresPromise` resolves features and seeds them into React Query (`featuresKeyFactory.features()`).

## 2. Inputs

**Constructor/`initialize` props:** `jiraHelpers`, `loginComponent` (the `Login` store), `mode`
(`'TEAMS'`), `storage`, `linkBuilder`, `showSidebarBranding`, `featuresPromise`. Also declared:
`licensing`, `timingCalculationMethods`, `defaultSearch`, `showingDebugPanel` (default `false`).

**`routeData`** (default = the singleton `routeData` `ObservableObject` store): the shell reads ~40
properties off it — see §3/§4. This is the cross-framework coupling that makes the rewrite hard;
`routeData` is the final keystone and stays CanJS until after this shell is ported.

**Simple derived getters:**

- `showingConfiguration` → `loginComponent.isLoggedIn` (gates the settings sidebar).
- `issuesPromise` → `routeData.derivedIssuesRequestData?.issuesPromise`.
- `features` → async from `featuresPromise`.
- `filteredDerivedIssues` → `routeData.derivedIssues` minus `routeData.statusesToExclude`.

## 3. Data-derivation pipeline (the core logic — must be preserved exactly)

A chain of computed getters turns raw derived issues into the exact shape reports consume. **This is
the most important behavior to port faithfully** (it's pure logic; the underlying transforms are
already imported pure functions):

1. **`filteredDerivedIssues`** — `routeData.derivedIssues` filtered to exclude
   `routeData.statusesToExclude`.
2. **`rollupTimingLevelsAndCalculations`** — slices `routeData.issueTimingCalculations` to
   `primaryIssueType` **and below**. Special case: when `primaryIssueType === 'Release'` **and**
   `secondaryIssueType` is set, prepends `{type:'Release', hierarchyLevel:Infinity,
calculation:'childrenOnly'}` to the sub-hierarchy under `secondaryIssueType`.
3. **`rolledupAndRolledBackIssuesAndReleases`** — the "all data pre-compiled" set. Computes
   `when = now − routeData.compareTo·1000`, then
   `rollupAndRollback(filteredDerivedIssues, routeData.normalizeOptions, timingLevels, when)` →
   `calculateReportStatuses(rolledUp, when)`. Gated on all three inputs existing (else `[]`).
   Emits a `logReportData` feature-flag console log (compact projection via `projectIssueForLog`).
4. **`groupedParentDownHierarchy`** — `groupIssuesByHierarchyLevelOrType(...).reverse()`.
5. **`planningIssues`** — from hierarchy `[0]` (or `[1]` for Release), filtered to
   `routeData.planningStatuses`.
6. **`primaryIssuesOrReleases`** — hierarchy `[0]` filtered by a stack of rules:
   - drop planning-status issues (non-Release only),
   - `releasesToShow` allow-list (by `name`),
   - `showOnlySemverReleases` (Release only, requires `names.semver`),
   - `hideUnknownInitiatives` — **scatter-plot special case**: for the `due` report "no dates" means
     `hasNoDueDate` (due only); otherwise the legacy `startBeforeDue` rule,
   - `matchesAllFilterRows(issue, routeData.effectiveFilterRows)`,
   - then optional sort by due date when `routeData.sortByDueDate`.

These computed values are handed to reports as observables (§4).

## 4. Primary report host

- **Registry** `urlParamValuesToReactComponents` maps 9 URL report types → React components:
  `estimate-analysis`→EstimateAnalysis, `auto-scheduler`→AutoScheduler,
  `estimation-progress`→EstimationProgress, `grouper`→GroupingReport, `flow-metrics`→FlowMetrics,
  `time-in-status`→TimeInStatus, `due`→ScatterTimeline, `start-due`→GanttGrid, `table`→EstimationTable.
- **`isReactComponent(type)`** → `hasOwnProperty` check; drives whether `#react-report-container` renders.
- **`attachReactReport()`** (on `#react-report-container` `on:inserted`): `createRoot` in the div, then
  `renderReactReport()`.
- **`renderReactReport()`**: builds `baseProps` — ~30 observable props via `value.from(this, …)` (derived
  data: `primaryIssuesOrReleasesObs`, `allIssuesOrReleasesObs`=rolledup set,
  `rollupTimingLevelsAndCalculationsObs`, `filteredDerivedIssuesObs`) and `value.bind(routeData, …)`
  (URL/config params: fields, rowGroup, colGroup, aggregators, all the flow-metrics/time-in-status
  filters, roundTo, groupBy, scatter date range, primaryIssueType, breakdown, showPercentComplete).
  Renders `QueryClientProvider > JiraProvider(jira=routeData.jiraHelpers) > <SelectedReport {...baseProps}>`.
- **`detachReactReport()`**: unmounts + nulls the root.
- **Report switching**: `connected()` `listenTo(routeData, 'primaryReportType', …)` — if the new type is a
  React report, re-render if a root exists, else detach+attach.

## 5. Secondary report host

- **`attachReactSecondaryReport()`** (on `#react-secondary-report-container` `on:inserted`, rendered only
  when `secondaryReportType` is `"status"` or `"breakdown"`): `createRoot` → `<WorkBreakdown>` with its
  own props (`primaryIssuesOrReleasesObs`, `allIssuesOrReleasesObs`, `planningIssuesObs`,
  `secondaryReportTypeObs`, `filterRowsObs`=secondaryFilterRows, `childFilterRowsObs`=secondaryChildFilterRows).
- **`detachReactSecondaryReport()`**: unmounts + nulls.

## 6. Chrome mounted in `connected()` (imperative `createRoot` into fixed divs)

Each is a React root mounted into a template `<div id=…>`:

| Div                       | Component          | Key props / callbacks                                                                                                                                                                                         |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#view-reports`           | `ViewReports`      | `onBackButtonClicked` → `routeData.showSettings=''`                                                                                                                                                           |
| `#report-controls`        | `ReportControls`   | `rolledup…Obs`, `primaryIssuesOrReleasesObs`                                                                                                                                                                  |
| `#sample-data-notice`     | `SampleDataNotice` | `shouldHideNoticeObservable`=isLoggedIn, `onLoginClicked`→`loginComponent.login()`                                                                                                                            |
| `#saved-reports`          | `SavedReports`     | `queryParamObservable`=pushStateObservable, `storage`, `linkBuilder`, `shouldShowReportsObservable`=isLoggedIn, `onViewReportsButtonClicked`→`showReports`                                                    |
| `#timeline-configuration` | `SettingsSidebar`  | only when `showingConfiguration`; `isLoggedIn`, `showSidebarBranding`, `jiraHelpers`, `linkBuilder`, `onUpdateTeamsConfiguration`→batched write of `routeData.fieldsToRequest` + `routeData.normalizeOptions` |
| `#print-header`           | `PrintHeader`      | mounted via `on:inserted`/`on:removed` (inside the resolved-data block)                                                                                                                                       |
| `#report-footer`          | `ReportFooter`     | sticky footer; `on:inserted`/`on:removed`                                                                                                                                                                     |

Also in `connected()`: theme applied via `getTheme(routeData.storage).then(applyThemeToCssVars)`.

**Note:** `LoginButton` and `SelectCloud` are mounted by `main-helper` into the nav, **not** by the shell.

## 7. View states (Stache template conditionals)

- **Settings sidebar** `#timeline-configuration` rendered only when `showingConfiguration` (logged in).
- **No-JQL prompt**: "Configure a JQL in the sidebar…" when `!routeData.jql && isLoggedIn`.
- **Main report block** (when `issuesPromise.isResolved && primaryIssuesOrReleases.length`): print-header,
  `#react-report-container` (if primary is a React report), `#react-secondary-report-container` (if
  secondary is status/breakdown), report-footer.
- **Empty result warning** (resolved but `primaryIssuesOrReleases.length === 0`): "N issues of type X /
  Please check your JQL and the View Settings."
- **Loading** (jql set + `issuesPromise.isPending`): "Loading…" plus "Loaded X of Y issues" when
  `progressData.issuesRequested` is known.
- **Error** (`issuesPromise.isRejected`): `reason.type === 'no-licensing'` → "No license"; otherwise
  generic "There was an error loading from Jira!" + `reason.errorMessages[0]`.

## 8. Lifecycle & DOM utilities

- **`rendered()`** → `updateFullishHeightSection()` sets the `--fullish-document-top` CSS var from the
  `.fullish-vh` element's page position (drives the scroll region height).
- **`connected()`** → registers `window` `load`/`resize` listeners for `updateFullishHeightSection`, the
  primary-report-switch `listenTo`, and mounts all the chrome (§6).
- **`showReports(event)`** → `routeData.showSettings='REPORTS'`. **`showDebug(open)`** → toggles
  `showingDebugPanel`.
- `queues.batch.start()/stop()` wraps the teams-config write-back.
- Dead/near-dead helpers present in the file: `sortReadyFirst`, `addTeamBreakdown` (unused);
  `getElementPosition` (used by `updateFullishHeightSection`).

## 9. Feature flags / dev affordances

- **`logReportData`** (`defineFeatureFlag`, default ON): logs the fully transformed data each report
  consumes (report type, roundTo, count, projected issues). Toggle via `window.featureFlags` + reload.

## 10. Cross-framework coupling (what makes the rewrite hard)

- Reads ~40 properties off `routeData` (a CanJS `ObservableObject`) and bridges to React with
  `value.from` / `value.bind` → consumed inside reports via `useCanObservable`. `routeData` is the
  **final** keystone (migrates after this shell), so the ported shell must keep reading it through the
  bridge.
- Uses `queues.batch` for grouped writes back to `routeData`.
- The whole component is **imperative**: `StacheElement` lifecycle (`connected`/`rendered`) +
  `on:inserted`/`on:removed` hooks drive ~8 `createRoot` mounts and their unmounts. Replacing this
  imperative mount/unmount dance with declarative React is the essence of the rewrite.

## Behavior checklist (for verifying the port)

- [ ] Boots only after login resolves (and report data, when `?report=` present); `#loadingJira` hides.
- [ ] All 9 primary reports render for their URL type; switching `primaryReportType` swaps cleanly (mount/unmount).
- [ ] Secondary WorkBreakdown renders for `status`/`breakdown` and unmounts otherwise.
- [ ] Chrome renders: view-reports, controls, sample-data notice, saved reports, settings sidebar (when logged in), print header, footer.
- [ ] All view states: no-JQL prompt, loading (+progress), empty-result warning, error (no-license vs generic).
- [ ] Data pipeline parity: `primaryIssuesOrReleases`, `rolledupAndRolledBack…`, `planningIssues` identical for the same inputs (incl. scatter-plot `hasNoDueDate` case, semver/releasesToShow/planning filters, sortByDueDate).
- [ ] Theme applied; `--fullish-document-top` updates on load/resize.
- [ ] Teams-config write-back batches `fieldsToRequest` + `normalizeOptions`.
- [ ] Legacy URL fixes still applied (handled in `main-helper`, not the shell).
