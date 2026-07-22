# Table & Grouper unification — design

## Goal

Rename/replace the **Grouper** report with a general-purpose **Table** report, and
absorb the existing **Estimation Table** into it. Users start from a basic table of
issues, add columns (Jira fields or computed values), and optionally layer on
grouping (1D or 2D) — rather than starting from a fixed 2x2 pivot or a fixed
hard-coded column set.

This also needs to support many Jira field types as columns (not just the current
hard-coded set), since fields become first-class, addable columns.

## Current state (for reference)

- **Grouper report** (`src/react/reports/GroupingReport/`): a 2D pivot. Row grouper x
  column grouper x a multi-selected set of aggregators (global, not per-column).
  Groupers: Project, Issue Key, Parent, Great-grandparent, Implements Link,
  Intersect Month/Quarter, Due in Month/Quarter. Aggregators: Revenue, Issues List,
  Top 5 by Rank, Issue Count, Total/Completed/Remaining Working Days, Intersecting
  Working Days, Avg/Max Capacity, Completion %, Working Days Breakdown, Issues
  Without Estimates, etc. "Additional Fields" only loads extra field data for
  aggregators to read (e.g. Revenue needs `Hours per week` / `Billing Rate`) — it does
  **not** add visible columns today.
- **Estimation Table report** (`src/react/reports/EstimationTable/`, key `table`):
  a fixed, recursively-indented tree of issues (parent -> children via
  `reportingHierarchy.childKeys`), with a fixed column set (Summary w/ issue-type
  icon, Estimated Days, Timed Days, Rolled Up Days), each showing a
  "last -> current" diff, with a breakdown modal on the Estimated Days cell.
- Jira fields already carry a `schema.type` (from `useJiraIssueFields`) — the hook
  we can use to drive type-aware column behavior.

## Decisions made so far

### 1. Unified row/column model

Collapsed from an earlier "4 modes" framing down to two orthogonal knobs on one
flat set of issue-rows:

- **Row ordering/nesting** — either:
  - **Sort by column(s)** (plain flat table), or
  - **Hierarchy** ordering: depth-first by parent chain, then by rank within
    siblings. This is *not* a separate data mode — it's a sort key plus an
    indent + expand/collapse decoration applied to one designated "tree" column
    (the key/summary cell). Rolled-up values (Rolled Up Days, completion, etc.)
    are already precomputed per-issue, so a parent's rollup is just a column
    reading that precomputed field, not a special aggregation path.
- **Grouping (optional, 1D or 2D)** — the only feature that introduces *synthetic*
  rows (group headers) and requires **aggregating a column's value across the
  group's member issues**. 1D = group rows only. 2D = group rows *and* group
  columns (this is today's Grouper pivot, reframed).

This means: flat table, Estimation Table's tree, 1D grouped outline, and the 2D
pivot are all the same engine with different knob settings — not four separate
implementations.

### 2. Columns are `(field or computed value) + aggregation)`

- **Field columns**: driven by a **field-type registry** keyed on the Jira field's
  `schema.type` (+ `schema.items` for arrays). Each registry entry supplies:
  `getValue`, `render`, `compare` (sort), a `filter` descriptor, and a default
  `aggregate` (used only when a cell spans multiple issues, i.e. when grouped).
  Unknown types fall back to a plain string renderer.
- **Computed columns**: today's "aggregators" (Revenue, Issues List, Top 5 by
  Rank, Working Days variants, etc.) become computed ColumnDefinitions with a
  fixed aggregation baked in — same catalog as today, just reframed as columns
  instead of a separate global aggregator multi-select.
- **Aggregation is per-column**, not global (this is a deliberate improvement
  over today's Grouper, where the aggregator multi-select applies to the whole
  matrix). Each field column gets a type-appropriate default aggregation
  (number -> sum, date -> range, option/user -> distinct list, etc.) and the user
  can override it — either via the column's own menu, or at the moment they pick
  it as a grouping/aggregate column.
- Today's "pick multiple aggregators" behavior is preserved by allowing the same
  field to be added as **multiple columns** with different aggregations (e.g.
  "Story Points (Sum)" and "Story Points (Avg)" as two separate columns).
- When rows aren't grouped (flat or hierarchy), aggregation is simply unused —
  each cell shows the single issue's value.

### 3. Field types to support in phase 1

Registry entries for: **text, number, date/datetime**, and the **identity
columns** needed to reproduce Estimation Table — **issue key** (link), **summary**
(the tree/indent column), **issue type** (icon). Other types (option/array,
user, status, priority, etc.) fall back to a plain string render until their
registry entries are added in a later phase.

### 4. Sorting

- Click a column header to sort by it (asc -> desc -> none cycle), using the
  column's type-aware `compare`.
- Hierarchy ordering (Section 1) is a separate toggle from column sort: when
  hierarchy is on, column sort (if any) orders *within* siblings; when off,
  column sort orders the whole flat list.
- When grouped, column sort orders rows *within* each group; a separate control
  orders the groups themselves.

### 5. Filtering

- Each column contributes a type-appropriate filter (text: contains/equals;
  number: range/comparison; date: range; option/user/status: multi-select
  membership; boolean: is/is-not).
- Filters AND together and apply to the issue set *before* grouping, so groups
  and rollups reflect filtered data.
- **UX direction (mocked, `preview-4-column-menu.png`):** filter controls live in
  each column header's menu (alongside sort and "set aggregation"), not a separate
  filter bar and not above-table chips — keeps things per-column and scales with
  many columns. Per-column menus
  should **only appear on hover/focus**, not be visible at rest — reports need to
  look "printable"/clean for executive audiences, so the table should look
  static until moused over.

### 6. Scope relative to existing reports

- The new Table report **supersedes both** the Grouper report and the
  Estimation Table report (not just a rename). Estimation Table's nested
  hierarchy display + issue-type icons + "last -> current" diffs +
  breakdown-modal behavior need to be reachable in the new Table (as hierarchy
  ordering + appropriate columns), not dropped.
- Full design + phased implementation plan is the intended scope (not a
  first-slice-only spec).

### 7. 2D grouping = a cross-tab; measures are the shown columns

Resolved via mockups (see `mockups/`). When two fields are grouped it is a single
**cross-tab**: one field down the rows, the other across the columns, one value
per cell.

- **No separate "measures/cell-values" picker.** The values aggregated in the
  cells are simply the columns the user is already showing, automatically minus
  (a) identity columns (Issue key, the Summary/tree column) and (b) whichever
  field(s) are being grouped on. The remainder (Due date, Story Points, …) are
  the measures and repeat per group.
- **Field-axis toggle ("Fields: ↓ Down rows / → Across cols").** Controls how the
  measure fields are laid out *within* the cross-tab, without changing the data:
  - **Down rows (default, more readable):** each row-field value spans one
    sub-row per measure; column-field values are the columns. Stays narrow
    regardless of measure count.
  - **Across cols:** each column-field value is a merged header spanning a block
    of measure sub-columns (two-row header) — today's Grouper pivot shape.
- **Swap (`⇄`)** exchanges which field is rows vs columns.
- Each cell shows one **aggregated** value using that column's own aggregation.
- This replaces an earlier (wrong) "nest the two groupings down the page" idea;
  vertical/horizontal is about the *measure* axis, not nesting the groupings.
- 1D grouping is unchanged: collapsible group-header rows over drill-in member
  rows (roll-up by default).

### 8. Sticky headers / frozen label columns (requirement, not yet built)

Wide cross-tabs overflow horizontally (measures × column-values) and long tables
overflow vertically, so:

- **All header rows stick** to the top on vertical scroll (the column-dimension
  header row + the measure sub-header row in the "Across cols" layout both
  remain visible).
- **The row-label column(s) freeze** on horizontal scroll — the grouped field
  column, plus the "Field" column in the "Down rows" layout — so row context
  stays visible while scrolling across column-dimension values.
- Not implemented in the mockup (plain scroll there); captured here as a
  requirement for the real report.

## Resolved since first draft (see `plan.md`)

- **Filter UX**: hover-only column-header menu only — no separate filter bar / no
  above-table chips. `preview-4-column-menu.png` is the approved mock (plan Q6).
- **Persistence**: schema defined in plan Phase 5 (ordered `columns` list +
  `rowOrdering`/sort/`filters`/`groupBy`/`fieldAxis`). No migration of legacy
  Grouper/Estimation settings — they're behind "features", not official (plan Q2).
- **Migration/retirement**: plan Phase 7 — new report ships under temp key `table2`
  (flag `tableReport`), old `table`/`grouper` retired and `table2`→`table` renamed
  at the end.
- **Hierarchy + grouping**: mutually exclusive for now (plan Q3).
- **Computed/custom aggregations**: deferred to plan Phase 8; only general-use ones
  ported, Revenue dropped (plan Q5).

## Still open (later phases)

- **Group header UX**: collapse/expand affordance, how group headers visually
  differ from hierarchy rows, group-level sort control (plan Phase 3).
- **2D pivot re-entry**: exact UI for turning on a column grouper within the
  column-based model (plan Phase 4).
- **Full field-type registry** beyond phase 1 (option/array, user, status,
  priority, labels, components, etc.) — plan Phase 7.

## Status

Design decisions resolved; phased implementation plan written in
[`plan.md`](./plan.md) with all Q&A closed. Ready to begin Phase 0.
