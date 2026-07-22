# Table & Grouper unification — implementation plan

Companion to [`design.md`](./design.md) and [`mockups/`](./mockups/). This is the
phased build plan. Each phase is independently shippable behind a feature flag and
leaves the existing `grouper` / `table` reports untouched until the final
retirement phase.

## Guiding architecture

One new report, built during development under the **temporary key `table2`**
(feature flag `tableReport`, `onByDefault: false`) so it can coexist with the
existing `table` (Estimation Table) and `grouper` reports through rollout; it is
renamed to `table` only at the retirement phase (Q1). Built on a single engine with
two orthogonal knobs (design §1):

- **Row ordering** — `sort` (flat) | `hierarchy` (depth-first parent chain, indent
  + expand/collapse on the tree column).
- **Grouping** — `none` | 1 field | 2 fields (cross-tab).

Row ordering and grouping are **mutually exclusive for now** (Q3): hierarchy is
effectively "group by parent chain", so a report is either sorted-flat, hierarchy,
or grouped — never hierarchy + grouping at once. Revisit later.

Everything else is **columns**. A column is `(source) + (aggregation)` where source
is a Jira field (type-driven) or a computed value (today's aggregators). See design
§2. Aggregation is per-column and only used when a cell spans multiple issues
(grouping, or a hierarchy parent rollup).

### Core seams identified in the current code

- **Two separate registries today:** groupers (`GroupingReport/components/SelectGrouper.tsx:21`,
  `ui/grouper.tsx:9` `Grouper` interface) and aggregators
  (`components/SelectAggregator.tsx:22`, `data/aggregate.ts:1` `AggregationReducer`).
  These collapse into one **ColumnDefinition** catalog + one **field-type registry**.
- **Generic group+aggregate engine already exists** and is reusable as-is:
  `data/group.ts` (`groupByKeys`, cartesian multi-group, `createStableObjectKey`),
  `data/aggregate.ts` (`aggregateGroup`), `data/groupAndAggregate.ts`. The 2D pivot
  render (`GroupingReport.tsx:112-306`, `getAxisValues`/`buildGrid`) is the model for
  the cross-tab.
- **EstimationTable's tree** flattens via `reportingHierarchy.childKeys`
  (`EstimationTable/helpers/rows.ts:9-29`) — no analog in Grouper. This becomes the
  `hierarchy` row-ordering mode.
- **"last ➡ current" diff cells** (`EstimationTable/helpers/cells.ts:25-42`) and
  the breakdown modal (`EstimateBreakdownModal.tsx`) are cell-render behaviors that
  become specific ColumnDefinitions, not a whole separate report.
- **Persistence** is route-data observables:
  `route-data.js:795-806` (`fields`, `rowGroup`, `colGroup`, `aggregators`), bound in
  `TimelineReport.tsx:134-163` via `value.bind(routeData, …)`. New settings follow
  the same pattern.
- **Registration**: `configuration/reports.ts:11-75` (catalog),
  `TimelineReport.tsx:48-58` (`urlParamValuesToReactComponents` key→component),
  `ReportControls/.../SelectReportType`, flag gate in `SelectReportType/utilities.ts:3`.
- **Fields**: `useJiraIssueFields.ts:6-32` returns `{ name, key, schema, id, custom, … }`
  with `schema.type` (and `schema.items` for arrays) — the type-registry key.

---

## Phase 0 — Column model + field-type registry (no UI)

Pure model/logic layer, unit-tested, no report wired up yet.

- New dir `src/react/reports/TableReport/` with `model/`.
- `model/columns.ts` — `ColumnDefinition` interface:
  `{ id, label, source: FieldSource | ComputedSource, getValue(issue), render(value, ctx),
  compare(a,b), filter?: FilterDescriptor, aggregate?: AggregationId, isIdentity?, isTree? }`.
- `model/fieldTypeRegistry.ts` — keyed on `schema.type` (+ `schema.items`). Phase-1
  entries only (design §3): **text, number, date, datetime**, and identity columns
  **issue key** (link), **summary** (tree/indent), **issue type** (icon). Unknown
  type → plain string renderer fallback. Each entry supplies default `render`,
  `compare`, `filter`, and default `aggregate`.
- `model/aggregations.ts` — reuse/adapt `AggregationReducer` from
  `GroupingReport/data/aggregate.ts`. Catalog: Sum, Avg, Min, Max, Count (number),
  Range (date), Distinct list (text/option/user). Per-type defaults.
- `model/buildColumnCatalog.ts` — for phase 1, the catalog is field columns (from
  `useJiraIssueFields`) + the identity/estimation columns needed for parity (groups:
  Identity / Fields / Estimation, per mockup README). Legacy "computed columns" /
  custom aggregators are **deferred to Phase 8** (Q5) — the catalog is designed to
  accept them but ships without them.

**Tests:** registry produces correct value/compare/filter per type; unknown-type
fallback; computed-column adaptation preserves current aggregator output.

### Control placement — same row as the report-type selector

The Table report's toolbar controls (`Rows: Sort | Hierarchy`, `Group by ↓` /
`+ column dimension (2D)` / `⇄`, `Fields: ↓ Down / → Across`, `+ Add column`) must
live in the **same horizontal row as the report-type selector**, not in a separate
toolbar above/inside the report body.

- That row is `ReportControls` (`src/react/ReportControls/ReportControls.tsx:211`),
  a per-`primaryReportType` switch that renders `<SelectReportType />` next to each
  report's own controls in one flex row (see the `flow-metrics` branch,
  `ReportControls.tsx:243-259`, and `time-in-status`, `:262-`). Each control is
  wrapped in a `<div className="pt-1">` / `self-end` cell.
- **Plan:** add a `primaryReportType === 'table'` (or temp key) branch to that
  switch that renders `<SelectReportType />` followed by the Table controls, each in
  its own aligned cell, matching the existing spacing idiom.
- **Open problem to solve (design work, not yet decided):** the Table controls are
  numerous and *state-dependent* — `Fields` axis only exists in 2D, the second group
  selector only after a first is chosen, and `+ Add column` opens a catalog popover.
  Cramming all of them inline will overflow the row on narrow widths. Options to
  evaluate (record the choice in `design.md` before building Phase 1):
  1. **Inline + overflow menu** — keep Rows/Group-by/Add-column inline, fold
     secondary/contextual controls (Fields axis, swap, per-report options) into a
     single `⋯`/"Table options" dropdown in the same row.
  2. **Progressive disclosure** — only render a control once its precondition is met
     (2D selector appears after 1D is set, Fields axis appears only in 2D), so the
     row grows only as the user opts into complexity.
  3. **Two-tier** — report-type + primary knobs on the shared row; `+ Add column`
     and column management on a secondary strip attached to the table header.
  - *Suggestion: (1)+(2) combined* — progressive disclosure for the grouping
    controls plus an overflow menu for the axis/layout toggles keeps the shared row
    stable and uncluttered while staying in one row as requested.
- Confirm whether `ReportControlsWrapper` (`:197`) should be reused (it already pairs
  `SelectReportType` + `SelectIssueType`) or whether Table needs a bespoke branch.

## Phase 1 — Basic flat Table report (Sort + columns + filter)

Ship the "start simple" MVP (mockup `preview-1-flat.png`).

- `TableReport.tsx` — new report component. Props: filtered issues observable +
  new settings observables (see Phase 5; stub with local state first if needed).
- Render a flat `@atlaskit`-styled table over the top-level issue set (mirror
  `GroupingReport.tsx:106-110`: `linkIssues` then filter to
  `rollupTimingLevelsAndCalculations[0].hierarchyLevel`).
- **Add/remove columns**: `AddColumnButton` + searchable catalog popover;
  `columns` is an ordered list of column ids.
- **Sorting**: click header cycles asc → desc → none using the column's `compare`
  (design §4).
- **Filtering**: per-column hover-only `⋯` header menu (design §5, `preview-4`)
  with type-aware filter control; filters AND together, applied before render. All
  filter UX lives **inside the column menu** — no separate filter bar and no
  above-table filter chips (Q6). A filtered column indicates its active state on the
  header itself (e.g. the menu affordance stays visible / shows a filled state).
- **Hover-only header controls**: menu button hidden at rest, appears on
  hover/focus — table reads "printable" (design §5).
- Register report under the temporary key `table2`: add to
  `configuration/reports.ts`, `urlParamValuesToReactComponents`
  (`TimelineReport.tsx:48`), behind new flag `tableReport` (`onByDefault: false`).
  Existing `table` (Estimation Table) and `grouper` entries are left in place.

**Exit:** a user can open the Table report, add fields as columns, sort, filter,
remove — no grouping, no hierarchy yet.

## Phase 2 — Hierarchy ordering (absorb Estimation Table)

Mockup `preview-2-hierarchy.png`.

- Add `Rows: Sort | Hierarchy` segmented control.
- Hierarchy = depth-first flatten by `reportingHierarchy.childKeys` — port
  `EstimationTable/helpers/rows.ts` (`makeGetChildren`, `buildTableRows`) into
  `model/hierarchyRows.ts`. Column sort orders within siblings (design §4).
- Tree column (summary, `isTree`) gets indent (`depth * 20`) + expand/collapse caret.
- Parent rows show **rolled-up** values: columns read precomputed rollup fields
  (rollups already exist per-issue — `GroupingReport/jira/linked-issue/rollup/`),
  so a parent cell is just the column reading that field (design §1). No special
  aggregation path for hierarchy.
- Port Estimation Table's identity/estimation columns as ColumnDefinitions:
  issue-type icon + summary, Estimated Days / Timed Days / Rolled Up Days with the
  **"last ➡ current" diff** render (`cells.ts:25-42` → a `diffRender` helper) and the
  **breakdown modal** on the Estimated Days cell (`EstimateBreakdownModal.tsx`, gated
  by `FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES()` as today).

**Exit:** Table in hierarchy mode with the estimation columns reproduces the current
Estimation Table (tree + icons + diffs + breakdown modal).

## Phase 3 — 1D grouping + per-column aggregation

Mockup `preview-3-grouped.png`.

- Add `Group by ↓` selector (any field/column as group key).
- Reuse `groupByKeys` + `aggregateGroup` (`data/group.ts`, `data/aggregate.ts`).
- **Measures = shown columns minus identity columns minus the grouped field**
  (design §7, mockup README) — no separate measures picker.
- Synthetic collapsible **group-header rows** with member counts; **collapsed
  (roll-up) by default**, expand per-group + "Expand all".
- Each measure cell = its column's aggregation over the group's members.
- Per-column `⋯` menu gains **Aggregation** submenu (type-aware list). Same field
  addable twice with different aggregations reproduces multi-aggregator behavior.
- Group-level sort control (order the groups themselves).

## Phase 4 — 2D cross-tab (absorb Grouper pivot)

Mockups `preview-5-2d-vertical.png`, `preview-6-2d-horizontal.png`.

- Add second group selector (`+ column dimension (2D)`) + `⇄` swap.
- One field down rows, other across columns, one aggregated value per cell
  (`row-group ∩ column-group`). Reuse the existing cartesian multi-group +
  `getAxisValues`/`buildGrid` logic from `GroupingReport.tsx:271-306`.
- **Fields axis toggle** (`↓ Down rows` default / `→ Across cols`) — design §7:
  - Down rows: each row-field value spans one sub-row per measure (narrow).
  - Across cols: merged two-row header, measure sub-columns per column-value
    (today's Grouper shape).
- Total column/row.

**Exit:** Table in 2D reproduces today's Grouper pivot (and more, via per-column
aggregation).

## Phase 5 — Persistence schema

- New route-data observables (follow `route-data.js:795-806` +
  `saveJSONToUrlButAlsoLookAtReport_DataWrapper`): an ordered `columns` list
  (each `{ sourceId, aggregation?, width? }`), `rowOrdering` (sort/hierarchy),
  `sortColumn`+`sortDir`, `filters` map, `groupBy` / `groupByCol`, `fieldAxis`.
- Bind in `TimelineReport.tsx` `baseProps` via `value.bind(routeData, …)`, matching
  the current Grouper wiring (`TimelineReport.tsx:140-160`).
- **No legacy migration (Q2).** The old `grouper`/`table` reports live behind the
  "features" settings and are not official reports, so their saved
  `rowGroup`/`colGroup`/`aggregators`/`fields` state can be broken cleanly. The new
  schema stands on its own; nothing reads the old keys.

## Phase 6 — Sticky headers / frozen label columns (design §8)

- All header rows stick on vertical scroll; row-label column(s) freeze on
  horizontal scroll (grouped-field column + "Field" column in Down-rows layout).
- Not in the mockup; real-report requirement.

## Phase 7 — Full field-type registry + retirement

- Expand `fieldTypeRegistry` to option/array, user, status, priority, labels,
  components, boolean (design open item).
- Once Table is at parity and flag-tested: flip `onByDefault`, then retire
  `EstimationTable` (`src/react/reports/EstimationTable/`) and `GroupingReport`
  (`src/react/reports/GroupingReport/` — keep the extracted `data/` engine),
  remove their entries from `configuration/reports.ts` and
  `urlParamValuesToReactComponents`, and clean up `grouper`/`estimationTable` flags.
- **Rename the temp key `table2` → `table`** (Q1) now that the old `table`
  (Estimation Table) is gone: update `configuration/reports.ts`,
  `urlParamValuesToReactComponents`, and the persistence schema's report key.

## Phase 8 — Custom / computed aggregations (deferred, Q5)

Today's legacy aggregators (`GroupingReport/ui/aggreation-reducers.tsx`,
`ui/total-working-days-reducers.tsx`) are set-level computations that only make
sense when grouped. They are **not required for parity** and ship later, as
computed ColumnDefinitions with a fixed baked-in aggregation, added to the catalog
under a "Computed / Estimation" group. Only the ones with **general** applicability
are ported — customer-specific ones like **Revenue** (needs `Hours per week` /
`Billing Rate` custom fields) are dropped.

Current catalog and disposition:

- **Port (general use):** Issue Count, Issues List, Top 5 Issues by Rank, Total /
  Completed / Remaining Working Days, Completion Percentage, Working Days Breakdown,
  Issues Without Estimates, Issues Without Any Estimates.
- **Reconsider / niche (only if asked):** Intersecting Working Days, Average
  Capacity (FTE), Max Capacity (FTE) — these depend on time-range grouping
  (Month/Quarter) and capacity fields.
- **Drop:** Revenue (Hours per week × Billing Rate) — not general.

When grouping is off (flat/hierarchy) these columns are meaningless; show them in
the catalog only when grouping is active (gray out with a tooltip otherwise).

---

## Resolved decisions

1. **Report key.** Ship under a temporary key `table2` behind the flag; rename to
   `table` at retirement (Phase 7). Reflected in Guiding architecture, Phase 1, and
   Phase 7.
2. **Legacy settings migration.** None. The old `grouper`/`table` reports are behind
   "features" settings, not official reports, so they can be broken cleanly.
   Reflected in Phase 5.
3. **Hierarchy + grouping.** Mutually exclusive for now. Reflected in Guiding
   architecture.
4. **Phase 2 vs 3 ordering.** Keep the given order — the group+aggregate engine is
   already proven, so hierarchy (the heavier port) goes first. No change.
5. **Computed / custom aggregations.** Deferred to new Phase 8; only general-use
   aggregators are ported, customer-specific ones (Revenue) dropped. The full
   current catalog and disposition is enumerated in Phase 8.
6. **Filter UX.** Build the hover-only column menu only — no separate filter bar or
   above-table chips. Reflected in Phase 1.
7. **Feature-flag name.** `tableReport`. Reflected throughout.

## Follow-up questions

_None open — the plan is ready to execute. Add new questions here if any arise._
