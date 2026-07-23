# spec/012 Table — rolled-back ("previous period") columns & Compare slider

Child spec of [`plan.md`](./plan.md). Extends the column catalog
([column-source-registry.md](./column-source-registry.md),
[common-and-report-field-columns.md](./common-and-report-field-columns.md)) so a user can add
**previous-period** values as columns via `+ Add column`, and adds the **Compare** slider to the
Table's control row so they can choose _how far back_ "previous" is.

## Problem

Every report — the Table included — is fed by the shared
`rolledupAndRolledBackIssuesAndReleases` computation
(`src/react/TimelineReport/timeline-report-view-model.js:95`), which always calls
`rollupAndRollback(..., when)` (`src/jira/rolledup-and-rolledback/rollup-and-rollback.ts:34`).
That attaches a **full prior-period snapshot** of each issue as `issueLastPeriod` — same shape,
same rolled-up fields (dates, percent complete, status, rolled-up days, work status, etc.).

Today the Table only exposes that snapshot through the three **Estimation** parity columns, which
diff via `compareToLast` (`model/diffRender.ts:37`, wired in `model/buildColumnCatalog.ts:18`).
Every other column ignores `issueLastPeriod`, so a user can't answer "what did this value used to
be?" for anything else. And the Table has **no way to change `when`**: the `table2` branch of
`ReportControls` (`src/react/ReportControls/ReportControls.tsx:242`) does not render
`<CompareSlider />`, so `routeData.compareTo` sits at its default of 15 days
(`route-data.js:247`, `_15DAYS_IN_S`) with no UI to move it.

## Approach

Two additions, no new data flow:

1. **Previous-period column variants** — for eligible columns, emit a companion column that reads
   the same value off `issue.issueLastPeriod` instead of `issue`. Reuse the existing `getValue`
   and `compareToLast` machinery; no new accessors.
2. **Surface the Compare slider in the Table controls** — render the existing `<CompareSlider />`
   in the `table2` control row so changing `compareTo` reactively re-derives
   `issueLastPeriod` and the previous-period columns update automatically.

## Why this is small

- **The data already exists.** `issueLastPeriod` is computed unconditionally for every report;
  there is **no extra fetch or compute cost** to surface it (`rollup-and-rollback.ts:34`).
- **The diff formatter already generalizes.** `compareToLast(issue, getValue, formatValue)`
  applies a column's own `getValue` to both `issue` and `issue.issueLastPeriod`
  (`model/diffRender.ts:37`). Any column's accessor works against the snapshot unchanged.
- **The slider already exists and writes the right observable.** `<CompareSlider />`
  (`src/react/ReportControls/components/CompareSlider/CompareSlider.tsx`) reads/writes
  `routeData.compareTo` via `useCompareTo()`. Rendering it in the Table row requires **no new
  state** — `rolledupAndRolledBackIssuesAndReleases` recomputes and the Table re-renders through
  its existing observable subscription.

## Design decisions (confirm before building)

1. **Diff column vs. bare "previous value" column.** Two flavors are possible:

   - **Delta** — `"last ➡ current"` string (reuse `compareToLast`), matching the Estimation
     columns' presentation.
   - **As-of-previous** — the prior value alone (`getValue(issue.issueLastPeriod)`), formatted with
     the column's normal `render`.

   **Recommendation:** ship the **Delta** flavor first (it reuses `compareToLast` verbatim and
   matches existing Estimation UX). Add the bare "previous value" flavor only if asked. **Decision
   point.**

2. **Which columns get a previous-period variant.** Only **rolled-up / derived** values change
   over time. Static raw fields (key, summary, issue type, labels) would always render
   "unchanged", so a companion column there is noise. Restrict the variants to columns whose value
   is time-varying:

   - Report Fields / Estimation / Computed columns (dates, story points, percent complete,
     rolled-up days, work status, blocked/warning rollups).
   - **Exclude** Identity columns and static Common facets.

   Encode eligibility on `ColumnDefinition` (e.g. an opt-in `supportsPreviousPeriod?: boolean`, or
   derive it from `source.kind`). **Decision point — explicit flag vs. inferred from `source.kind`.**

3. **How the variant is added in the menu.** Options:

   - a **per-column toggle** ("show change") on an already-added column, or
   - a **separate catalog entry** (`{id}:previous` / `{id}:delta`) in `+ Add column`.

   **Recommendation:** separate catalog entries — consistent with how the catalog already models
   columns, and keeps persistence (`model/persistence.ts`) a plain ordered id list. **Decision
   point.**

4. **Cross-tab (2D) interaction.** Cross-tab columns are value-derived, not from the shown-column
   list. Previous-period variants apply to the flat / hierarchy / 1D-grouped `<table>` only, not
   `CrossTabTable` (same boundary the reordering spec draws,
   [`column-reordering.md`](./column-reordering.md) §5). **Confirm out of scope for 2D.**

## Implementation

### 1. Column catalog — emit previous-period variants

In `model/buildColumnCatalog.ts`, for each **eligible** `ColumnDefinition`, emit a companion
definition:

```ts
// pseudocode — final shape depends on decisions above
function buildPreviousPeriodColumn(base: ColumnDefinition): ColumnDefinition {
  return {
    ...base,
    id: `${base.id}:delta`,
    label: `${base.label} (Δ)`,
    group: base.group, // or a dedicated "Previous Period" group — decision point
    source: { kind: 'previousPeriod', ofColumnId: base.id },
    // Delta flavor: format current-vs-last with the base column's accessor.
    render: (issue, ctx) => compareToLast(issue, base.getValue /* formatValue */),
    // Aggregation over a diff string is undefined — disable or aggregate the numeric current value.
    aggregate: undefined,
  };
}
```

Notes:

- The **"Previous Period" group** is a clean alternative to appending `(Δ)` labels within each
  existing group — decide during design.
- `compareToLast` returns a string; grouping/aggregation over it is undefined. Either disable
  `aggregate` on delta columns, or (as-of-previous flavor) aggregate the prior numeric value with
  the base column's aggregator.

### 2. Table controls — render the Compare slider

In `ReportControls.tsx`, the `table2` branch (`:242`) currently renders only
`<SelectReportType />` + `<TableReportControls />`. Add `<CompareSlider />` — either directly in
that branch or inside `TableReportControls` next to the existing Table controls:

```tsx
if (primaryReportType === 'table2') {
  return (
    <>
      <div className="pt-1">
        <SelectReportType />
      </div>
      <TableReportControls />
      <div className="flex-grow px-2">
        <CompareSlider />
      </div>
    </>
  );
}
```

No wiring beyond rendering — `<CompareSlider />` already reads/writes `routeData.compareTo`.

**Optional polish:** only show the slider when at least one previous-period column is active
(otherwise `when` has no visible effect). Gate on the persisted column list containing a
`:delta` / `previousPeriod` source.

### 3. Tests

- **Catalog** (`model/buildColumnCatalog.test.ts` style): eligible base columns emit a companion
  previous-period definition; ineligible ones (Identity / static Common) do not.
- **Render** (reuse `model/diffRender.test.ts` patterns): a delta column renders
  `"🚫 ➡ current"` with no prior period, `"last ➡ current"` when changed, and the bare value when
  unchanged.
- **Controls**: the `table2` branch renders `<CompareSlider />` (RTL, matching existing
  `ReportControls` tests).

## Constraints to respect

1. **Precompiled Tailwind** — new utility classes won't apply at runtime; follow the existing
   scoped-`<style>` / inline-style pattern in `TableReport.tsx` (MEMORY: `styling-and-storybook`,
   `dev-server-css-staleness`). The slider and columns reuse existing components, so this is mostly
   a non-issue.
2. **Design system = Atlaskit** — no new UI primitives; `<CompareSlider />` and the existing
   column renderers are reused as-is.
3. **No new data flow** — do **not** add a second rollback pass or thread a new `when`. Everything
   keys off the existing `routeData.compareTo` → `rolledupAndRolledBackIssuesAndReleases` path.

## Out of scope

- Changing the default `compareTo` (stays 15 days).
- Previous-period values in the Cross-tab (2D) view.
- The "as-of-previous value" flavor (deferred unless requested — Delta ships first).
