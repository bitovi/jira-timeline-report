# Remove legacy reports (Grouper + Estimation Table) — implementation plan

Follow-on to [`spec/012-table-and-grouper/plan.md`](../012-table-and-grouper/plan.md),
which built the unified **TableReport** under the temporary key `table2` (flag
`tableReport`, `onByDefault: false`) so it could coexist with the reports it
replaces. This spec executes the retirement that 012's Phase 7 anticipated:

1. Delete the **Grouper** (`grouper`) and **Estimation Table** (`table`) reports,
   keeping only the pieces of Grouper's data/logic layer that TableReport already
   depends on.
2. Promote TableReport by **renaming its URL report key `table2` → `table`** and
   dropping the "(beta)" label. It **stays behind the `tableReport` feature flag**
   (not on by default); only the retired reports' flags are removed.

TableReport is at parity and already reuses Grouper's engine directly, so this is
almost entirely deletion + a key rename, not a re-port.

## Current state (verified)

- **Report registry** (key → component): `src/react/reports/registry.ts` —
  `import { GroupingReport } from './GroupingReport/GroupingReport'` (`:7`),
  `import { EstimationTable } from './EstimationTable'` (`:12`),
  `import { TableReport } from './TableReport/TableReport'` (`:13`); the
  `embeddableReportComponents` map (`:30-41`) has `grouper: GroupingReport` (`:34`),
  `table: EstimationTable` (`:39`), `table2: TableReport` (`:40`). `shellRegistry.ts`
  spreads this map (adds only `report-of-reports`; no per-report literals to touch).
- **Report config / flags / dropdown**: `src/configuration/reports.ts` — `grouper`
  (`:47-53`, flag `grouper`), `table`/"Estimation Table" (`:54-60`, flag
  `estimationTable`), `table2`/"Table (beta)" (`:61-67`, flag `tableReport`,
  `onByDefault: false`). `ReportKeys` (`:91`) is derived from this array
  (`(typeof reports)[number]['key']`), so it updates automatically. The dropdown is
  filtered by `SelectReportType/utilities.ts` `getReportTypeOptions`
  (`report.onByDefault || features[report.featureFlag]`); there is no separate flag
  enum, so removing a config entry removes the flag and its dropdown item.
- **Per-report controls**: `ReportControls.tsx` — the `grouper` branch is **shared**
  with estimation-progress: `if (primaryReportType === 'estimation-progress' ||
primaryReportType === 'grouper')` (`:228`); `table2` →
  `TableReportControls` (`:14` import, `:254-266`); and a `primaryReportType !==
'table'` guard hiding ViewSettings in the fallback block (`:319`).
- **Routing / persistence** — the persisted-property schema is defined in **two
  parallel files** that both need the same edits:
  - `src/canjs/routing/route-data/route-data.js` — Grouper-specific props `rowGroup`,
    `colGroup`, `aggregators`, `groupBy` + the legacy `fields` prop (`:965`, note at
    `:410`, block `:967-999`); TableReport's namespaced `table*` keys (`:1000-1067`):
    `tableColumns`, `tableSortColumn`, `tableSortDir`, `tableFilters`, `tableGroupBy`,
    `tableGroupByCol`, `tableGroupByGranularity`, `tableGroupByColGranularity`,
    `tableFieldAxis`, `tableShowRowTotals`, `tableShowColTotals`.
  - `src/react/reports/ReportOfReports/model/ChildReportConfig.js` — the same Grouper
    props (`rowGroup`/`colGroup`/`aggregators`/`groupBy`, ~`:149-152`) and `table*`
    props (~`:155-`) for report-of-reports child configs.
  - Note: `route-data.js` does **not** import any GroupingReport module (the only
    `GroupingReport` hit is a comment at `:967`). It _does_ import TableReport's
    `builtinFieldRegistry` (`requiredFieldsFor`, `:9`) — unaffected by these removals.
    Prop bag for TableReport obs: `reportProps.ts:41-52`.

### What TableReport reuses from the legacy reports (must **not** be deleted)

TableReport imports both legacy reports' engines directly rather than reimplementing
them. **Both dirs are therefore partial deletes, not wholesale** — verify with
`grep -rn '\.\./GroupingReport\|\.\./EstimationTable' src/react/reports/TableReport`
before removing anything.

From **Grouper** (`GroupingReport/`):

- `TableReport.tsx:29` → `GroupingReport/jira/linked-issue/linked-issue` (`linkIssues`)
- `model/aggregations.ts:9,11` → `GroupingReport/data/aggregate`
  (`avgReducer`, `countReducer`, `sumReducer`, `AggregationReducer`)
- `model/crosstab.ts:18` → `GroupingReport/data/group` (`createStableObjectKey`)
- `model/grouping.ts:20-21` → `GroupingReport/data/aggregate` (`aggregateGroup`) and
  `GroupingReport/data/group` (`createStableObjectKey`, `groupByKeys`)

  → surviving Grouper modules: `GroupingReport/data/aggregate.ts`,
  `GroupingReport/data/group.ts`, `GroupingReport/jira/linked-issue/` (incl. its
  transitive deps `percent-complete/` and `rollup/`).

From **Estimation Table** (`EstimationTable/`):

- `TableReport.tsx:32` → `../EstimationTable/components/EstimateBreakdownModal`
  (`EstimateBreakdownModal`)
- `TableReport.tsx:66` → `../EstimationTable/types` (type `EstimationIssue`)
- (`model/hierarchyRows.ts` and `model/diffRender.ts` only _reference_ EstimationTable
  in doc-comments — the logic from `helpers/rows.ts` and `helpers/cells.ts` is already
  ported into TableReport; those two helper files are **not** imported.)

  → surviving Estimation Table modules: `EstimationTable/components/EstimateBreakdownModal/`
  (`EstimateBreakdownModal.tsx` + `index.ts`), `EstimationTable/helpers/breakdown.ts`
  (+ `breakdown.test.ts`; imported by the modal), and `EstimationTable/types.ts`
  (`EstimationIssue`, imported by the modal, `breakdown.ts`, and `TableReport.tsx`).

### What is safe to delete (verified — no external importers)

- **Estimation Table (report only)**: `EstimationTable/EstimationTable.tsx`,
  `helpers/rows.ts` (+ `rows.test.ts`), `helpers/cells.ts` (+ `cells.test.ts`), and
  the barrel `index.ts` (`export * from './EstimationTable'` / `'./types'`). The report
  component is imported only by `registry.ts:12`. The `rows`/`cells` helpers have no
  importer outside the dir (already ported). **Keep** the modal/breakdown/types
  survivors above.
- **Grouper report shell + its bespoke UI/data**, none of which TableReport imports:
  `GroupingReport/GroupingReport.tsx`, `data/groupAndAggregate.ts` (+ its test — only
  self-imported), all `GroupingReport/ui/*`, all `GroupingReport/components/Select*.tsx`,
  and `jira/linked-rolledup-issue.ts` (no importers found).

Because deletion is **partial inside both dirs**, do not `rm -rf` either directory
until the surviving modules have been relocated (Phases 1 & 4) and their importers
repointed — see the relocation section.

---

## Phase 1 — Delete Estimation Table (relocate the modal TableReport still uses)

Estimation Table is **not** fully self-contained: TableReport imports its
`EstimateBreakdownModal`, `breakdown.ts`, and `EstimationIssue` type. So first
relocate those survivors, then delete the report.

1. **Relocate the survivors into TableReport** (TableReport is their only consumer):
   - `EstimationTable/components/EstimateBreakdownModal/` → `TableReport/components/EstimateBreakdownModal/`
   - `EstimationTable/helpers/breakdown.ts` (+ `breakdown.test.ts`) → `TableReport/model/`
     (or `TableReport/helpers/`)
   - `EstimationTable/types.ts` (`EstimationIssue`) → `TableReport/model/` (fold into an
     existing TableReport types module if one fits, else a new `estimationTypes.ts`).
   - Repoint imports: `TableReport.tsx:32` (modal) and `:66` (`EstimationIssue`), plus
     the modal's own `import … from '../../helpers/breakdown'` and
     `'../../types'`, and `breakdown.ts`'s `import … from '../types'`.
2. **Delete the rest of `src/react/reports/EstimationTable/`** — the whole dir is now
   removable: `EstimationTable.tsx`, `helpers/rows.ts` + `rows.test.ts`,
   `helpers/cells.ts` + `cells.test.ts`, and `index.ts`. (The `rows`/`cells` logic is
   already ported into `model/hierarchyRows.ts` / `model/diffRender.ts`.)
3. Remove the import + registry entry in `registry.ts` — the
   `import { EstimationTable } from './EstimationTable'` (`:12`) and the
   `table: EstimationTable` map entry (`:39`).
4. Remove the `table` / "Estimation Table" entry from `src/configuration/reports.ts`
   (`:54-60`) — drops the `estimationTable` flag and its dropdown item. **Note:** this
   frees the `table` key for Phase 3's rename.
5. Remove the `primaryReportType !== 'table'` ViewSettings guard in
   `ReportControls.tsx:319`, rendering `<ViewSettings />` unconditionally in that
   fallback block. The guard's only purpose was to _hide_ ViewSettings for Estimation
   Table (`'table'`); every other fallback report already showed it, and TableReport
   uses its own branch (`:254-266`), so this is dead code once Estimation Table is
   gone — not a behavior change for any surviving report.
6. Clean up stray `estimationTable` references in tests/fixtures:
   `SelectReportType.test.tsx:15`, `Features.test.tsx`, `useCanObservable.test.tsx`
   (and grep for any others).

**Exit:** `src/react/reports/EstimationTable/` no longer exists; "Estimation Table"
gone from the report dropdown + Features settings; TableReport still renders its
breakdown modal from the relocated path; `tsc` + `vitest` green.

## Phase 2 — Delete the Grouper report (keep the shared engine)

- Delete Grouper-only files, keeping the shared engine listed above:
  - `GroupingReport/GroupingReport.tsx`
  - `GroupingReport/data/groupAndAggregate.ts` (+ `groupAndAggregate.test.ts`)
  - `GroupingReport/ui/*` (`grouper.tsx`, `date-groupers.tsx`,
    `aggreation-reducers.tsx`, `total-working-days-reducers.tsx`)
  - `GroupingReport/components/Select*.tsx` (`SelectGrouper`, `SelectAggregator`,
    `SelectMultipleAggregators`, `SelectAdditionalFields`)
  - `GroupingReport/jira/linked-rolledup-issue.ts`
  - Before deleting each, re-run a targeted `grep` for importers outside
    `TableReport/` to guard against a missed edge (the map found none, but verify).
- Remove the `import { GroupingReport } from './GroupingReport/GroupingReport'`
  (`registry.ts:7`) and the `grouper: GroupingReport` map entry (`:34`).
- Remove the `grouper` entry from `src/configuration/reports.ts` (`:47-53`) — drops
  the `grouper` flag + dropdown item.
- In `ReportControls.tsx:228`, the branch is **shared** with estimation-progress:
  `if (primaryReportType === 'estimation-progress' || primaryReportType ===
'grouper')`. Remove **only** the `|| primaryReportType === 'grouper'` clause — keep
  the branch for estimation-progress. Do **not** delete the whole `if`.
- Remove Grouper's now-orphaned props from **both** schema files — `route-data.js`
  (`rowGroup`, `colGroup`, `aggregators`, `groupBy`, and the legacy `fields` at `:965`
  / `:967-999`) **and** `ReportOfReports/model/ChildReportConfig.js` (the same
  `rowGroup`/`colGroup`/`aggregators`/`groupBy` block, ~`:149-152`). Do this **only
  after confirming** nothing else reads them. Per 012 Q2 there is no legacy-migration
  obligation, so they can be dropped cleanly.

**Exit:** "Grouper" gone from dropdown/Features; TableReport still builds and runs
(it consumes the surviving `data/` + `linked-issue/` engine); `tsc` + `vitest` green.

## Phase 3 — Rename `table2` → `table` (report stays flagged)

Requires the old `table` key already freed by Phase 1. Independent of Phase 4
(relocation), so either order works; keep it its own commit.

- **Report key rename** `table2` → `table` in every literal. The full current set
  (from `grep -rn "table2" src/`) — treat this as the checklist, and re-grep at the
  end to prove zero remain:
  - **Code (must change):**
    - `registry.ts:40` (`table2: TableReport` → `table: TableReport`)
    - `src/configuration/reports.ts:62` (`key: 'table2'` → `'table'`); also update
      `name` "Table (beta)" → **"Table"** and drop the "(beta)" wording from
      `featureSubtitle`. **Keep `featureFlag: 'tableReport'` and `onByDefault: false`** —
      the report remains flag-gated (decided).
    - `ReportControls.tsx:254` (`primaryReportType === 'table2'` → `'table'`)
    - `ReportOfReports/components/ChildReport.tableChild.test.tsx:125` (`primaryReportType`)
      and `:139` (`components={{ table2: TableReport }}` → `table`)
    - `ReportOfReports/model/ChildReportConfig.test.js:153`
      (`?…&primaryReportType=table2` URL fixture)
  - **Comments (update for accuracy, non-functional):** `route-data.js:1000`,
    `reportProps.ts:41`, `ChildReportConfig.js:154`, `TableReport/TableReport.tsx:11`,
    `TableReport/model/persistence.ts:2`, `TableReport/components/TableReportControls.tsx:4`.
  - `shellRegistry.ts` has **no** `table2` literal (it only spreads the map) — nothing
    to change there.
- **Feature flag stays.** The `tableReport` flag continues to gate visibility via
  `getReportTypeOptions`; do **not** drop it and do **not** flip `onByDefault`. The
  only flags removed in this spec are the retired reports' `grouper` (Phase 2) and
  `estimationTable` (Phase 1), which go away when their `reports.ts` entries are
  deleted.
- **URL param names are independent of the report key** — the `table*` route-data
  props (`tableColumns`, …) do **not** need renaming and should be left as-is.
- **Saved state — accept the break (decided).** Existing URLs / report-of-reports
  documents that stored `table2` as the report key will point at nothing after the
  rename; that is acceptable, consistent with 012 Q2 (the beta report's persisted
  state is disposable). **No `table2 → table` alias.** Do not add migration code.

**Exit:** the unified report appears simply as **"Table"** (still behind the
`tableReport` flag) at URL key `table`; no `table2`, `grouper`, `estimationTable`, or
`Estimation Table` references remain; full `tsc` + `vitest` + a manual smoke test
(enable the flag, open the report, add columns, group, hierarchy, 2D) pass.

---

## Phase 4 — Relocate the surviving Grouper engine, delete `GroupingReport/`

(EstimationTable's surviving modules are already relocated in Phase 1; this phase
finishes the `GroupingReport/` side.)

The request says: _"If Grouper's logic was used in TableReport, we should move it
into TableReport."_ It is used — TableReport imports `data/aggregate.ts`,
`data/group.ts`, and `jira/linked-issue/` from `GroupingReport`. After Phase 2 those
are the only survivors of `GroupingReport/`, and the directory name no longer
describes a report. Relocate each to its natural home so `GroupingReport/` can be
deleted entirely.

The two kinds of survivor go to different homes (decided):

- **`data/aggregate.ts` + `data/group.ts` → `TableReport/model/`.** These are the
  table/grouping engine (group-by-keys, cartesian multi-group, aggregation reducers)
  and TableReport is now their only consumer, so they live with the report that uses
  them. Move their co-located tests too.
- **`jira/linked-issue/` → `src/jira/linked-issue/`** (its own subtree, _alongside_
  `src/jira/rollup/`, not inside it — see the warning below). `linkIssues` builds the
  parent/child issue graph and rolls values up it; it already depends on
  `src/jira/derived/`, so it belongs in the jira-data layer, not in a report folder.
  Move it whole, keeping `rollup/` and `percent-complete/` and the tests intact.

Update the import sites after moving (line numbers are pre-edit — re-grep, since
Phase 1 edits shift `TableReport.tsx`):

- `TableReport.tsx` `linkIssues` import → new `src/jira/linked-issue`
- `model/aggregations.ts`, `model/crosstab.ts`, `model/grouping.ts` → new
  `TableReport/model/` paths for `aggregate`/`group`
- `linked-issue/` internal imports: its files use relative paths back into `src/jira/`
  (e.g. `linked-issue.ts` imports `../../../../../jira/derived/derive` and
  `jira/shared/helpers`) — these depths change when the folder moves up to
  `src/jira/linked-issue/`; fix each relative path (or switch to the repo's import
  alias if one exists). Keep the `index.ts` barrel.
- `route-data.js:9` imports `builtinFieldRegistry` from `TableReport/model` — that path
  is unchanged by this move; just confirm it still resolves after the build.

> ⚠️ **Do not merge `linked-issue`'s rollups into `src/jira/rollup/`.** > `linked-issue/rollup/dates` and `linked-issue/percent-complete` look like duplicates
> of `src/jira/rollup/dates` and `src/jira/rollup/percent-complete`, but they are
> **divergent forks** — the `linked-issue` versions use a recursive/`WeakMap`-cached
> walk over a `LinkedIssue` graph and compute extra data (e.g.
> `childrenLinkedIssuesWithoutEstimates`), while the canonical versions use the
> grouped-hierarchy engine with averaging metadata. They produce different results.
> Reconciling them is a real, behavior-changing refactor and is **out of scope** for
> this spec — move `linked-issue` as-is and record the duplication as a follow-up.

Keep this phase a **pure move with no behavior change** — easy to review and revert.
Commit it separately from the deletions.

## Verification

- `tsc` (no `any`-hiding of broken imports) and `vitest` after **each phase**, not
  just at the end.
- **Line numbers in this plan are a snapshot** — every deletion shifts the files
  below it, so re-grep for the symbol/literal rather than trusting a line number when
  you get there.
- Final repo-wide grep for dead literals (should all return nothing after Phase 4):
  `grouper` (report key), `GroupingReport`, `EstimationTable`, `estimationTable`,
  `Estimation Table`, `table2`, and the removed route-data prop names (`rowGroup`,
  `colGroup`, `aggregators`, and the legacy `fields`). Watch for false positives —
  e.g. `groupBy`/`tableGroupBy` are TableReport's and must remain.
- Confirm the relocated survivors resolve: `TableReport` renders its
  `EstimateBreakdownModal` from the new `TableReport/components/` path, and
  `src/jira/linked-issue/` (+ its tests) type-checks.
- Manual smoke (enable the `tableReport` flag in Features settings first): report
  dropdown shows a single "Table"; open it and exercise flat columns, sort, filter,
  hierarchy (breakdown modal opens), 1D group, 2D cross-tab; confirm report-of-reports
  can still embed it.

## Suggested execution order

Run the phases in number order, each as its own commit with `tsc` + `vitest` between:

1. **Phase 1** — delete Estimation Table (relocate its modal/breakdown/types first).
2. **Phase 2** — delete the Grouper report shell + bespoke UI.
3. **Phase 3** — rename `table2` → `table` (needs the `table` key freed by Phase 1).
4. **Phase 4** — relocate the shared Grouper engine and delete `GroupingReport/`.

Phases 3 and 4 are independent of each other, so they can swap if convenient. Only
hard dependency: Phase 3 must follow Phase 1. Doing the deletions (1–2) before the
rename keeps `table` unambiguously meaning the doomed Estimation Table until the very
end.

## Resolved decisions

1. **`table2` saved state — accept the break.** No `table2 → table` alias, no
   migration code. Old saved keys point at nothing; acceptable per 012 Q2. Reflected
   in Phase 3.
2. **ViewSettings guard** (`ReportControls.tsx:319`). Delete the `!== 'table'`
   condition and render `<ViewSettings />` unconditionally — it only hid settings for
   Estimation Table, now removed. Not a behavior change for any surviving report.
   Reflected in Phase 1.
3. **`tableReport` flag stays; name drops "(beta)".** Keep TableReport behind the
   `tableReport` flag with `onByDefault: false`; rename it to just "Table". Only the
   retired reports' flags (`grouper`, `estimationTable`) are removed. Reflected in the
   summary and Phase 3.

## Open questions

1. **`linked-issue` vs `src/jira/rollup/` fork (follow-up, not this spec).** After the
   move, `src/jira/linked-issue/rollup/{dates,percent-complete}` and
   `src/jira/rollup/{dates,percent-complete}` are two divergent implementations of the
   same rollups. Track reconciling them (pick one engine) as a later refactor; it
   carries behavioral risk and must not ride along with this removal.
