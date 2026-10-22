# 042: Sources panel redesign with "Filter loaded issues" rules

The Sources panel (Issue Source) has three parts today:

1. A root JQL.
2. "Load children" and "Load blockers" checkboxes, each with an optional JQL.
3. An "Exclude statuses" multi-select.

This spec does two things:

- Redesigns the panel to match Claude Design option **2a** (project `3632294d…`, `Sources Panel.dc.html`).
- Replaces step 3 with a rule list. It works like the report's Filters dropdown (`Status · is not · Done, Won't do`, add more rules), but runs **before** the report.

## Context

The pipeline today:

```
getRawIssues (root JQL + children + blockers)
  → derivedIssues (normalize + derive)
  → filteredDerivedIssues      ← statusesToExclude is applied here
  → rollupAndRollback          (dates, % complete, rollback)
  → groupedParentDownHierarchy → primaryIssuesOrReleases  ← report filterRows applied here
```

`statusesToExclude` is the only filter that runs before rollup. It is applied in [`timeline-report-view-model.js:88-98`](../../src/react/TimelineReport/timeline-report-view-model.js). The report Filters (`filterRows`) run later, after rollup, and only on the primary level ([`timeline-report-view-model.js:234`](../../src/react/TimelineReport/timeline-report-view-model.js)).

The new rules replace `statusesToExclude` at the **same pipeline stage**. Issues they remove never reach rollup or any report, and the report's own Filters then narrow what is left. No new pipeline stage is needed. The predicate just gets more general.

## Decisions (locked with Arthur)

| Decision            | Choice                                                                                                                                        | Why                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Visual design       | Option **2a**, then (2026-10-21) **3a's numbered steps**: circled 1–4 on a connecting rail. Only the numbers were taken from 3a; no hairlines | Chosen in Claude Design                                                                                                                  |
| Fields              | **Status, Issue type, Labels**                                                                                                                | All three are on every derived issue (`status`, `type`, `labels`). Rollup status can't be used because it doesn't exist before rollup    |
| Operators           | `is` / `is not`, multi-value                                                                                                                  | Same as the report Filters                                                                                                               |
| `statusesToExclude` | **Read as a `Status is not …` rule.** Apply writes only the new param                                                                         | Old URLs and saved reports keep working                                                                                                  |
| Rollout             | **No Features toggle**                                                                                                                        | Migration covers old reports; a toggle would mean keeping two code paths                                                                 |
| Buttons             | **Apply moves to step 3, after _Add related issues_; rules apply instantly** (changed from 2a's single footer Apply, 2026-10-21)              | Only loading calls Jira. The rule options come from the loaded issues, so one Apply at the bottom forced "apply, add rules, apply again" |

## 1. Rule model and predicate

The new module is `src/jira/rollup/filter-rows/source-filter-rows.ts`. It sits next to `filter-rows.ts` and reuses its `FilterOperator`:

```ts
export type SourceFilterField = 'status' | 'issueType' | 'labels';
export interface SourceFilterRow {
  id: string;
  field: SourceFilterField;
  operator: FilterOperator;
  value: string[];
}
export function matchesSourceFilterRow(
  issue: { status?: string; type?: string; labels?: string[] },
  row: SourceFilterRow,
): boolean;
export function matchesAllSourceFilterRows(issue, rows: SourceFilterRow[]): boolean;
```

Matching rules, the same as `filter-rows.ts`:

- An empty `value` always matches.
- Values within a row are ORed. Rows are ANDed together.
- For `labels`, `is` means the issue has any of the selected labels. `is not` means it has none of them, so an issue with no labels passes.
- Releases don't exist at this stage, so the release/child-status branch is not needed.

The type is kept separate from `FilterField` on purpose. The report Filters keep their `jiraStatus`/`rollupStatus` fields, and the source rules don't get `rollupStatus`.

## 2. Route data and migration

[`route-data.js`](../../src/canjs/routing/route-data/route-data.js) gets a new param next to `statusesToExclude` (:267), following the `filterRows` / `effectiveFilterRows` pattern (:999-1021):

```js
sourceFilterRows: saveJSONToUrlButAlsoLookAtReport_DataWrapper('sourceFilterRows', [], Array, JSON),
get effectiveSourceFilterRows() {
  if (this.sourceFilterRows?.length) return this.sourceFilterRows;
  if (this.statusesToExclude?.length)
    return [{ id: 'legacy-statuses-to-exclude', field: 'status', operator: 'is not', value: this.statusesToExclude }];
  return [];
},
```

- Keep the `statusesToExclude` definition; it is still a read path.
- Add the type to `route-data/types.ts`.
- Saved reports pick up `sourceFilterRows` automatically via `serialize()` (see `state-storage.js:306`).
- No `migrations.ts` entry is needed, because the getter does the conversion when the report is read.

**Report of reports:** add `sourceFilterRows: json([])` to `CHILD_PARAMS` and mirror the getter in [`ChildReportConfig.js`](../../src/react/reports/ReportOfReports/model/ChildReportConfig.js) (`statusesToExclude` is at :147, `effectiveFilterRows` at :646). `ChildReportConfig.test.js:626` fails if this is missed.

## 3. Applying the rules

`filteredDerivedIssues` ([`timeline-report-view-model.js:88`](../../src/react/TimelineReport/timeline-report-view-model.js)) becomes:

```js
const rows = this.routeData.effectiveSourceFilterRows;
return rows.length ? derivedIssues.filter((issue) => matchesAllSourceFilterRows(issue, rows)) : derivedIssues;
```

Nothing downstream changes. Report-of-reports children use the same view model with their config, so they pick this up too.

## 4. `FilterRowsBuilder`: a stacked layout

[`FilterRowsBuilder.tsx`](../../src/react/ReportControls/components/Filters/components/FilterRowsBuilder/FilterRowsBuilder.tsx) uses a 4-column grid (`160px 110px 1fr 28px`). That doesn't fit the ~400px sidebar. Changes:

- **Generic field type:** make it generic over the field type (`FilterFieldDefinition<F extends string>`, `FilterRow`-shaped rows) so it accepts `SourceFilterField`.
- **New props, defaults unchanged:**
  - `layout?: 'inline' | 'stacked'`. Stacked follows the mockup: each rule is a `bg-page` rounded panel, with Field · Operator · ✕ on the first line and the value multi-select across the full width below.
  - `addLabel?: string`, default `+ Add filter`. The sources panel passes `Add rule`.
  - `showClearAll?: boolean`, default `true`. The sources panel passes `false`, since the mockup has no "Clear all".
- The report Filters keep the inline layout and don't change.

## 5. The panel (option 2a)

The panel is rebuilt in [`IssueSource.tsx`](../../src/react/SettingsSidebar/components/IssueSource/IssueSource.tsx). It uses Atlaskit and Tailwind as now; don't bring in the mockup's Phosphor icons or the DS bundle. Top to bottom:

1. **Header:** "Issue source", with a muted subtitle: _"Issues are fetched from Jira, filtered here, then sent to the report."_
2. **Query Jira** (semibold label):
   - The existing `JQLTextArea`.
   - Helper text _"JQL for the issues your report starts from."_ below the editor. The "Loaded N issues" status moves next to Apply (step 3).
   - No hairline after it: Query Jira and Add related issues form one step, since Apply saves and fetches both.
3. **Add related issues:**
   - Checkbox **"Children of queried issues"**, with the child JQL editor indented below it and helper text _"Filter children with JQL (optional)"_.
   - Checkbox **"Blockers of queried issues, recursively"**, with its JQL editor below and helper text _"Filter blockers with JQL (optional)"_. It is still gated by `features.recursiveBlockers`.
   - The JQL editor has no placeholder prop, so helper text goes in the editor's own 20px footer strip (`JqlEditor`'s `helperText`). It hides while the editor is focused or has a syntax error, when the editor uses that strip for its hints and errors.
   - **Step 3, "Get issues from Jira"** (its own numbered step, no description): **Apply** (primary) on the left. It was briefly "Load issues"; that is still the better name, but the e2e test targets "Apply", so it stays for now with "Loaded N issues" after it. It saves the query, children and blockers and fetches. It is the panel's only button.
   - A bottom hairline.
4. **Filter loaded issues:** `FilterRowsBuilder` with `layout="stacked"`, `addLabel="+ Add rule"` and `showClearAll={false}`.
   - Changes apply instantly (`hooks/useSourceFilterRows`), like the report Filters' `useFilterRows`. Each write also sets `statusesToExclude: []`.
   - A note always reads _"Apply to update the filter options."_ The options come from the loaded issues, so this explains why a value can be missing.
   - Selects in the stacked layout get a white control background, since the panel is grey.

Mockup → app details:

- Hairlines use the existing `Hr` or a `border-b` in the neutral border color.
- Value chips are the Atlaskit multi-select's own chips.

**Options hook:** a new `hooks/useSourceFilterFieldDefinitions` replaces `useExcludedStatusSelect`.

- It builds Status options from `allStatusesSorted(routeData.derivedIssues)`.
- It builds Issue type and Labels options as sorted unique values from the same derived issues.
- It reads the **unfiltered** `derivedIssues`, so values that are already excluded can still be chosen.
- `ExcludedStatusSelect` has no other importers. Delete it.

**`useJQL`** ([`useJQL.ts`](../../src/react/SettingsSidebar/components/IssueSource/hooks/useJQL/useJQL.ts)):

- Drop the `statusesToExclude` state; it now handles only the query, children and blockers.

**`useSourceFilterRows`** (new): reads `effectiveSourceFilterRows` and writes `{ sourceFilterRows, statusesToExclude: [] }`. Clearing the legacy param means deleting every rule on an old report actually removes the filter.

## 6. Tests

- `source-filter-rows.test.ts`: each field × operator, an empty value, multiple rows ANDed, and labels on an issue with no labels.
- route-data: `effectiveSourceFilterRows` with the new param, with the legacy `statusesToExclude`, and when both are set (the new one wins).
- `ChildReportConfig.test.js`: the getter mirror, plus the existing "every property" guard.
- `IssueSource.test.tsx`:
  - A rule change writes `sourceFilterRows` immediately and clears `statusesToExclude`.
  - A legacy URL renders as a `Status · is not` rule.
  - Editing the JQL enables Apply, and Apply writes the JQL.
- `FilterRowsBuilder`: the existing tests still pass (inline is the default), and there is one stacked-layout render test.

## 7. Out of scope

Options 1b (live per-stage counts), 1c (plain-language summary) and the "step 4 → report filters" pointer. Also out: more fields such as team or project, and rollup-status rules.

## Critical files

- `src/jira/rollup/filter-rows/source-filter-rows.ts` (new) + test
- `src/canjs/routing/route-data/route-data.js`, `route-data/types.ts`
- `src/react/reports/ReportOfReports/model/ChildReportConfig.js`
- `src/react/TimelineReport/timeline-report-view-model.js`
- `src/react/ReportControls/components/Filters/components/FilterRowsBuilder/FilterRowsBuilder.tsx`
- `src/react/SettingsSidebar/components/IssueSource/IssueSource.tsx`, `hooks/useJQL/useJQL.ts`, `components/LoadChildren`, `components/LoadBlockers`, new `hooks/useSourceFilterFieldDefinitions`; delete `components/ExcludedStatusSelect`

## Verification

1. Run `npm test` and `npm run typecheck`.
2. Run `npm run dev` and open the Sources panel. Check that it matches 2a.
3. **Legacy URL:** add `?statusesToExclude=Done` to a URL. The panel should show a `Status · is not · Done` rule and Done issues should be gone from the report. Then edit the rule: the URL should have `sourceFilterRows` and no `statusesToExclude`.
4. **Rules:** add `Issue type · is not · Story` and a labels rule (no Apply needed). Those issues should be gone from every report, and rollup dates and percent complete should exclude them.
5. **Layering:** add a report Filter (`Rollup Status is Blocked`). It should narrow the already-filtered set.
6. **Saved report:** save, reload, and reopen the report. The rules should persist. Also check one report-of-reports child that uses a saved report with the legacy `statusesToExclude`.
