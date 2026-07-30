# 016 — Report of Reports: compose saved reports into one document

A new report type that embeds **other saved reports** into a single page. The first step is
deliberately small: a centered "Add Report" button → pick a saved report → it renders, with the
button below it → repeat → save the whole thing as a normal saved report. Sections, titles, text,
nesting, and inline field values come later — the data model is built to accept them without a
migration.

Supersedes [`../../010-multi-report/`](../../010-multi-report/) (`explore.md` + `analysis.md`), which
explored this same idea before the React rewrite landed. Its architectural conclusions largely
still hold, but its file references are stale — it cites `src/timeline-report.js`, which no longer
exists.

## Context

The report registry makes registering a new type nearly free. `src/configuration/reports.ts` is
the single source of truth; adding one entry derives:

- the "Report type" dropdown (`src/react/ReportControls/components/SelectReportType/SelectReportType.tsx`),
- the Settings → Features toggle (`src/configuration/features.ts` collects every
  `onByDefault: false` report's flag),
- `primaryReportType` URL validation (`src/canjs/routing/route-data/route-data.js:593-602`, which
  silently falls back to `start-due` for unknown values).

One line in `urlParamValuesToReactComponents`
(`src/react/TimelineReport/TimelineReport.tsx:49-60`) then maps the key to a component.

Saving is also nearly free, and simpler than it looks. Storage is **arbitrary JSON with no schema
and no key enumeration**:

- `index.html:93` and `dev.html:69` → `src/web.main.ts:19` → `createWebAppStorage` → a JSON
  `codeBlock` inside the description of the `'Jira Auto Scheduler Configuration'` issue
  (`src/jira/storage/index.web.ts:97-114` reads, `:145` writes).
- `connect.html:69` → `src/plugin.main.ts:49` → `createJiraPluginStorage` → Connect app properties
  (`src/jira/storage/index.plugin.ts:51-56`).

Both do `JSON.parse` → spread → `JSON.stringify`, so **extra fields on a report record round-trip
untouched**. And `useUpdateReport` (`src/react/services/reports/useSaveReports.tsx:109-134`) is
just `{ ...allReports[id], ...updates }` → `save()`, so `updateReport(id, { layout })` persists
with no changes to the mutation layer, `src/jira/reports/fetcher.ts`, or either storage backend.

The saved-reports map is already fully in memory before React mounts —
`src/shared/main-helper.js:90-100` blocks the mount on `getAllReports` when `?report=` is present,
and `route-data.js:146-148` exposes `reportData` as a plain lookup. So the "Add Report" picker
reads `useAllReports()` and **needs no fetch**.

### The one real obstacle

Every report reads its config from a **module-level `routeData` singleton**, imported at
`TimelineReport.tsx:11`. The shell builds exactly one props bag from it
(`TimelineReport.tsx:136-177`):

```js
const baseProps = useMemo(
  () => ({
    extraFieldsObs: value.bind(routeData, 'fields'), // ← the ONE global routeData
    primaryIssueTypeObs: value.bind(routeData, 'primaryIssueType'),
    // …~30 more, all bound to the same object
  }),
  [vm],
);
```

Report components take observables bound to that global, not a config object. So
`<GanttGrid {...baseProps}/>` rendered twice shows the **same data twice**. Something must turn
each child's `queryParams` string into its own props bag.

Two facts make that much cheaper than it first appears:

1. **The fetch layer is already parameterized.** `src/canjs/controls/timeline-configuration/state-helpers.js:28`
   and `:131` take observables, not globals:
   ```js
   export function rawIssuesRequestData(
     { jql, childJQL, isLoggedIn, loadChildren, jiraHelpers, fields }, { listenTo, resolve }) {…}
   export function derivedIssuesRequestData(
     { rawIssuesRequestData, configurationPromise, licensingPromise }, { listenTo, resolve }) {…}
   ```
   `route-data.js:286-292` and `:459-483` merely wire them up. Nothing about fetching is tied to
   the URL.
2. **The pipeline already accepts injected config.** `TimelineReportViewModel`
   (`src/react/TimelineReport/timeline-report-view-model.js:46-50`) declares `routeData` as a prop
   with a default, so `new TimelineReportViewModel({ routeData: childConfig })` works today —
   spec 011 did that work.

And the expensive derived properties largely derive from **team configuration and Jira metadata,
which are global, not per-report** — `normalizeOptions` (`route-data.js:457`, built from
`jiraFieldsPromise` + `allTeamDataPromise` + `simplifiedIssueHierarchyPromise`) and
`simplifiedIssueHierarchy` (`:163`). Children share those with the existing `routeData` rather than
recomputing them.

One exception matters: `issueTimingCalculations` (`:168`) is a **hybrid**. It combines the global
`simplifiedIssueHierarchy` with `timingCalculations` (`:522`), which _is_ a per-report URL param.
So children recompute it from the shared hierarchy plus their own `timingCalculations`, via the
existing `getTimingLevels` helper.

### Decisions (locked with the user)

- **`primaryReportType=report-of-reports`.** Matches the existing key style.
- **The layout tree is real nested JSON on the `Report` record, not a query param.** An earlier
  draft proposed serializing it into `queryParams` to inherit the URL machinery. That is wrong for
  a document model containing text and field references. It is held in memory while editing and
  saved to Jira exactly the way every other report is saved. Cost of this choice: no
  share-before-save URL, and dirty-detection needs one small addition (Phase 3).
- **The schema is nesting-ready from day one.** v1 only _creates_ `saved-report` nodes, but
  `section` is defined now and readers tolerate unknown node types, so sections/text/grids arrive
  as pure UI work with no data migration.
- **Children render as saved, with no per-child control row.** Interactivity _inside_ each report
  component (column sort, row expand) still works. Matches `010-multi-report/analysis.md`'s "child
  edits are ephemeral in v1". Easy to revisit — it's an additive change, not a rework.
- **No nesting a report-of-reports inside another** in v1.
- **`src/canjs/routing/state-storage.js` is not touched.** See the rejected alternative at the end
  of Phase 2.

## Guiding architecture

Each phase is independently shippable behind the `reportOfReports` feature flag and leaves every
existing report untouched.

### Core seams identified in the current code

- **Report registry** — `src/configuration/reports.ts`; everything downstream derives.
- **Component map** — `TimelineReport.tsx:49-60`. Must be extracted to its own module in Phase 2
  (circular import; see below).
- **Props bag** — `TimelineReport.tsx:136-177`. Must become a function of `(vm, config)`.
- **Data pipeline** — `timeline-report-view-model.js:46-50`, already injectable.
- **Fetch helpers** — `state-helpers.js:28,131`, already parameterized.
- **View-state gate** — `src/react/TimelineReport/components/ReportArea.tsx:45,47`. Hides the
  report block when `!jql` and when `primaryIssuesCount === 0`; a report-of-reports has neither.
- **Control row** — `src/react/ReportControls/ReportControls.tsx:218-297`, an if-chain per report
  type with a fallback at `:297`.
- **Save chrome** — `src/react/SaveReports/SaveReports.tsx:126` gates "Create new report" on a
  `jql` param existing.
- **Dirty detection** — `src/react/SaveReports/hooks/useSelectedReports/utilities.ts:29-49`.
  Note it currently returns `[...params.entries()].length === 0` with the real comparison
  commented out at `:48` — already approximate.

---

## Phase 0 — Register the report type, render the empty state

- `src/configuration/reports.ts` — add:
  ```ts
  {
    key: 'report-of-reports',
    name: 'Report of Reports',
    featureSubtitle: 'Compose saved reports into one document',
    featureFlag: 'reportOfReports',
    onByDefault: false,
  }
  ```
  The dropdown, the Settings toggle, and URL validation all follow automatically.
- `src/react/reports/ReportOfReports/ReportOfReports.tsx` (new) — for now, a horizontally centered
  "Add Report" button and nothing else.
- Register it in `TimelineReport.tsx:49-60`.
- **`ReportArea` gating.** Add a `selfManagesData?: boolean` prop that bypasses the JQL, empty, and
  loading gates, passed from `TimelineReport` as
  `primaryReportType === 'report-of-reports'`. Keep the component pure and prop-driven — it exists
  precisely to be unit-testable and already has `ReportArea.test.tsx`.
- `ReportControls.tsx` — add a branch before `:218` that renders only `SelectReportType`. The
  fallback at `:297` (CompareSlider + Filters + ViewSettings) is meaningless for a report with no
  JQL of its own. `ViewSettings` already returns `null` for unrecognized keys, and
  `ReportFooter`'s map needs no entry.
- `SaveReports.tsx:126` — also allow the create button when
  `primaryReportType === 'report-of-reports'`, since there will never be a `jql` param.

**Tests:** `ReportArea` renders `children` when `selfManagesData` is set and `jql` is empty, and
still shows `NoJqlMessage` when it isn't; registry lookup resolves the new key.

**Exit:** with the flag on, picking "Report of Reports" in the dropdown sets
`primaryReportType=report-of-reports` in the URL and renders a centered "Add Report" button, with
no console errors and no leftover filter controls.

## Phase 1 — Layout model and the Add Report picker (in memory)

- `src/react/reports/ReportOfReports/model/layout.ts` (new):
  ```ts
  // Recursive document tree. v1 only creates `saved-report` nodes; `section` is defined now so
  // nesting (and later text / inline-report-grid / fieldValue nodes) needs no migration.
  // See spec/016-report-of-reports.
  export type LayoutNode =
    | { type: 'saved-report'; params: { reportId: string } }
    | { type: 'section'; params: { title: string }; children: LayoutNode[] };
  ```
  plus:
  - `parseLayout(unknown): LayoutNode[]` — **tolerant**. Unknown `type` becomes a placeholder node
    rather than throwing, so a document written by a newer client degrades instead of blanking the
    page. This is load-bearing for every later phase.
  - `appendNode`, `removeNodeAt`, `visitNodes` — path-based, since the tree is recursive.
- `components/AddReportModal.tsx` (new) — Atlaskit modal listing `useAllReports()` (already in
  memory). Excludes the report currently open and any other report-of-reports.
- The tree lives in `useState` inside `ReportOfReports`. Nothing is persisted yet.
- **React keys come from tree position, not `reportId`** — the same saved report may legitimately
  appear twice in one document.

**Tests (TDD):** `parseLayout` (valid tree, unknown `type` → placeholder, malformed input, empty,
nested); `appendNode` / `removeNodeAt` at depth; duplicate-`reportId` keying produces distinct keys.

**Exit:** adding three reports renders three placeholder cards in order with the "Add Report"
button below them; a hand-injected unknown node type renders a placeholder rather than crashing.

## Phase 2 — Render the children

The real work.

- `model/ChildReportConfig.js` (new) — an `ObservableObject` that per child:

  - **parses** the per-child settings out of that child's `queryParams` string,
  - **shares** the global properties off the existing `routeData`,
  - **recomputes** the one hybrid property,
  - runs its **own** fetch via `rawIssuesRequestData` / `derivedIssuesRequestData`, wired exactly
    as `route-data.js:286-292,459-483` does.

  The buckets, derived by walking the two consumers (`timeline-report-view-model.js` and the
  `baseProps` bag at `TimelineReport.tsx:136-177`):

  | Bucket                                                | Properties                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
  | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Per-child** — parse from the child's `queryParams`  | `jql`, `childJQL`, `loadChildren`, `primaryReportType` (decides which component renders), `primaryIssueType`, `secondaryIssueType`, `toIssueType`, `timingCalculations`, `statusesToExclude`, `planningStatuses`, `compareTo`, `hideUnknownInitiatives`, `releasesToShow`, `showOnlySemverReleases`, `sortByDueDate`, `filterRows`, `fields`, `roundTo`, `groupBy`, `rowGroup`, `colGroup`, `aggregators`, `primaryReportBreakdown`, `showPercentComplete`, and the report-specific `scatter*` / `table*` / `flowMetrics*` / `timeInStatus*` keys |
  | **Shared global** — read off the existing `routeData` | `jiraHelpers`, `isLoggedIn`, `licensingPromise`, `normalizeOptions` (`route-data.js:457`), `simplifiedIssueHierarchy` (`:163`), field metadata                                                                                                                                                                                                                                                                                                                                                                                                    |
  | **Hybrid** — recompute per child                      | `issueTimingCalculations` (`:168`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
  | **Own fetch**                                         | `rawIssuesRequestData` → `derivedIssuesRequestData` → `derivedIssues`                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

  Two details that are easy to get wrong:

  - **`issueTimingCalculations` is the hybrid, and the only one.** It combines the _global_
    `simplifiedIssueHierarchy` with `timingCalculations` (`:522`), which **is** a per-report URL
    param. Recompute it per child from the shared hierarchy plus the child's own
    `timingCalculations`, using the existing `getTimingLevels` helper. Treating it as fully global
    silently gives every child the first child's hierarchy slicing.
  - **`filterRows` needs the legacy migration.** The filtering logic reads
    `effectiveFilterRows` (`:949-957`), which seeds a row from the legacy
    `statusesToShow` / `statusesToRemove` params when `filterRows` is empty. A child config that
    exposes raw `filterRows` will silently drop filters on older saved reports.

  **Rejected alternative:** teaching `RouteData` to read its params from a fixed string instead of
  `window.location`, so children could be plain `new RouteData(...)` instances. That change lands in
  `state-storage.js`, which all ~60 settings flow through — every existing report put at risk for no
  gain, since `state-helpers.js:28,131` are already parameterized and the global properties above
  are genuinely shareable.

- `components/ChildReport.tsx` (new) — per `saved-report` node:
  `new ChildReportConfig({ queryParams })` → `new TimelineReportViewModel({ routeData: cfg })` →
  `propsFor(vm, cfg)` → render the component from the shared registry. Own loading / error /
  empty states.
- **Extract the component map** from `TimelineReport.tsx:49-60` into
  `src/react/reports/registry.ts`. This is required, not cosmetic: `ReportOfReports` is itself in
  the map, so without the extraction it would import `TimelineReport`, which imports
  `ReportOfReports` — a cycle.
- **Extract the props bag** from `TimelineReport.tsx:136-177` into a `propsFor(vm, config)` helper
  so the shell and children build an identical bag from different sources. The shell's behavior
  must be unchanged — it passes the global `routeData`.

**Tests:** `ChildReportConfig` parses each documented setting from a `queryParams` string; two
configs built from different strings expose different `jql`; `propsFor` returns exactly the key
set the shell passes today (guards against the bag drifting from the extraction).

**Exit:** two children with **different JQLs** render **different data** on one page
simultaneously, each with its own loading state, and the Gantt/Scatter reports are visibly
unchanged when opened normally.

## Phase 3 — Persist the document

- `src/jira/reports/fetcher.ts` — extend the record:
  ```ts
  export type Report = {
    id: string;
    name: string;
    queryParams: string;
    /** Report-of-reports document tree. Absent on every other report type.
     *  See spec/016-report-of-reports. */
    layout?: LayoutNode[];
  };
  ```
  `queryParams` still carries `primaryReportType=report-of-reports` so the report opens into the
  right type.
- Saving needs no mutation-layer change — `updateReport(id, { layout })` already works. Extend
  `SaveReports.tsx`'s `handleCreate` (`:71`) to attach `layout` for this report type.
- **Dirty detection.** `paramsMatchReport` (`utilities.ts:29-49`) only inspects URL params, so
  layout edits would never mark the report dirty and "Save report" would never appear. Add a
  layout comparison in `useSelectedReport`. Keep it separate from the commented-out `paramsEqual`
  work at `:48` — that's a pre-existing issue, not ours to fix here.

**Tests:** round-trip a tree through `updateReport` → `getAllReports`; the dirty flag flips on a
layout change and clears after save; a report with no `layout` field still loads (backward
compatibility).

**Exit:** add reports → Save → reload from `?report=<id>` → the same document renders. Editing the
tree surfaces "Save report"; "Reset changes" restores the saved tree.

## Phase 4 — Robustness

- A `reportId` whose saved report was deleted renders a "Report not found" placeholder with the
  missing id — never a blank card, never a crash.
- Remove a node; move a node up/down.
- Fullscreen and print: add `'report-of-reports'` to `isPrintable` in
  `src/react/ReportControls/components/PrintReportButton/PrintReportButton.tsx:39`. A composed
  document is one of the more valuable things to print, so verify page breaks between children.

**Exit:** deleting a child report from the Saved Reports page and reloading the parent shows the
placeholder with the rest of the document intact.

---

## Resolved decisions

1. **Where does the layout live?** Real nested JSON on the `Report` record. Storage is schemaless
   JSON on both backends and `updateReport` spreads arbitrary fields, so this costs nothing.
   Reflected in Phase 3.
2. **Why not a query param?** It was the first proposal, to inherit URL precedence,
   dirty-detection, and share-before-save. Rejected: the tree will hold text content, grids, and
   field references, which do not belong URL-encoded. We give up share-before-save and add one
   dirty check. Reflected in Phase 3.
3. **How do children get isolated config?** A dedicated `ChildReportConfig` that reuses the
   already-parameterized fetch helpers and shares global metadata. The alternative — teaching
   `RouteData` to read params from a fixed string — would put all ~60 existing settings at risk for
   no gain. Reflected in Phase 2.
4. **Does "Add Report" fetch?** No. Bootstrap already loads every saved report before React mounts.
   Reflected in Phase 1.
5. **Are children interactive?** They render as saved, with no per-child control row.
   In-component interactivity still works. Reflected in Phase 2; revisiting is additive.
6. **Nesting in v1?** No — a report-of-reports cannot be added to a report-of-reports. The schema
   supports it; the UI does not offer it. Reflected in Phase 1.

## Risks / caveats

- **Jira description size cap (~32KB).** On the web and dev builds, _all_ app data — every saved
  report, features, theme, team config — shares one issue description
  (`index.web.ts:145` rewrites the whole blob). v1 layouts are a handful of UUIDs, so this is not a
  blocker now, but text-bearing documents will grow it. Escape hatch: move layouts to their own
  storage key (`report-layouts`), which costs a second round-trip and its own create/update path —
  which is exactly why we are not doing it preemptively. Revisit when text nodes land.
- **N children means N fetches.** No dedupe in v1. `010-multi-report/analysis.md` proposed a cache
  keyed by `(jql, childJQL, fields)`; worth building once documents routinely embed several reports
  over the same JQL.
- **Schema evolution.** `inline-report-grid`, `fieldValue`, and text nodes are known to be coming.
  Tolerant parsing must land in Phase 1 or older clients will break on newer documents.
- **`ChildReportConfig` can drift from `route-data.js`** as new report settings are added.
  Mitigated by reusing the same helper functions rather than reimplementing them, and by sharing
  everything global — but adding a per-report setting means adding it to the Phase 2 per-child
  bucket too, or embedded children silently fall back to its default.
- **The Phase 2 extractions touch the shell.** Moving the component map and the props bag out of
  `TimelineReport.tsx` is mechanical but affects every report. The `propsFor` key-set test exists
  to catch a dropped key.

## Verification

- `npm run typecheck` / `npm run build` and `npm test` (vitest) pass, with the new unit tests
  listed per phase.
- Storybook (credential-free): the empty state, the Add Report modal, and the "Report not found"
  placeholder.
- End-to-end (needs Jira creds — use the `launch-dev` agent or ask the user):
  1. Settings → Features, enable **Report of Reports**.
  2. Switch the report type; confirm `primaryReportType=report-of-reports` in the URL.
  3. Add two saved reports whose JQLs return **different** issues; confirm they render
     **different** data, not two copies of the same thing. This is the single most important
     check — it is exactly what the singleton props bag would break.
  4. Save, reload from `?report=<id>`, confirm the document returns.
  5. Delete one child from the Saved Reports page, reload the parent, confirm the placeholder.
  6. **Regression check:** open a normal Gantt and a normal Scatter report and confirm filters,
     view settings, secondary reports, and saved-report loading all behave as before.
     `state-storage.js` is untouched, so this is a sanity check rather than a deep audit.
- Playwright: extend `playwright/unauthenticated/report-switching.spec.ts` with the new type.

## Out of scope

- Sections, titles, and text nodes (schema-ready; UI later).
- `inline-report-grid` and `fieldValue` nodes.
- Nesting a report-of-reports inside another.
- Per-child filters / view-settings rows.
- Shared fetch dedupe across children (→ its own plan if load times bite).
- Drag-and-drop reordering — Phase 4 ships move-up / move-down / remove only.

## Follow-up questions

_None open — the plan is ready to execute. Add new questions here if any arise._
