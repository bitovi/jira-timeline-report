/**
 * 2D cross-tab for the Table report (spec/012-table-and-grouper, Phase 4, design §7 /
 * mockup README "2D cross-tab: how the measure fields are laid out").
 *
 * When two fields are grouped it is a single cross-tab: one field down the rows, the other across
 * the columns, one aggregated value per cell (`row-group ∩ column-group`). This is the pure model
 * layer, mirroring the GroupingReport pivot (`GroupingReport.tsx:271-306` — `getAxisValues` /
 * `buildGrid`) but driven by {@link ColumnDefinition}s instead of `Grouper` objects, and reusing:
 *
 *  - {@link createStableObjectKey} — stable per-axis-value keys (matching 1D {@link groupIssues}).
 *  - {@link formatGroupLabel} — the same axis-value → header label formatting as 1D grouping.
 *  - {@link computeMeasureValue} — per-cell aggregation using the measure column's own aggregation.
 *
 * Array-valued fields expand cartesian-style (an issue with `[A, B]` lands in both the `A` and `B`
 * cells), exactly like the shared {@link groupByKeys} engine. Totals never double-count: a row/column
 * total collects each issue once per value on *that* axis only, and the grand total once overall.
 */
import { createStableObjectKey } from '../../GroupingReport/data/group';

import { computeMeasureValue, formatGroupLabel, EMPTY_GROUP_LABEL } from './grouping';

import type { AggregationOverrides } from './grouping';
import type { ColumnDefinition, TableIssue } from './columns';

/** The synthetic key/label used for the total column and total row. */
export const TOTAL_KEY = '__total__';
export const TOTAL_LABEL = 'Total';

/**
 * The synthetic "Issue Count" measure used as the last-resort cross-tab value when a cross-tab has
 * neither real measure columns nor any shown identity columns to fall back to. A cross-tab needs at
 * least one value per cell, so this counts the issues in each `row ∩ column` cell (mockup
 * `effMeasures()` → `['issueCount']`, spec/012-table-and-grouper/mockups/table-report.html).
 * `getValue` returns `1` per issue and the `count` aggregation reduces it to the cell's member count.
 */
export const ISSUE_COUNT_MEASURE: ColumnDefinition = {
  id: 'computed:issueCount',
  label: 'Issue Count',
  group: 'Computed',
  source: { kind: 'computed', computedId: 'issueCount' },
  getValue: () => 1,
  render: (value) => value as number,
  compare: (a, b) => (a as number) - (b as number),
  aggregate: 'count',
  defaultAggregate: 'count',
};

/**
 * The measures actually rendered in the cross-tab cells. Prefer the caller-selected `measures` (the
 * shown non-identity columns). When there are none — e.g. only "Icon & Summary" is shown while
 * grouping Status × Project Key — fall back to the shown `identityFallback` columns so each cell
 * still shows a value labeled with the field name + its aggregation (e.g. "Icon & Summary
 * [Distinct list]"), rather than collapsing to zero rows. Only if there are also no identity columns
 * do we use the synthetic {@link ISSUE_COUNT_MEASURE}.
 */
export function effectiveMeasures(
  measures: ColumnDefinition[],
  identityFallback: ColumnDefinition[] = [],
): ColumnDefinition[] {
  if (measures.length > 0) return measures;
  if (identityFallback.length > 0) return identityFallback;
  return [ISSUE_COUNT_MEASURE];
}

/** Unique, ordered values along one axis of the cross-tab (parallel `keys` / `titles` / `values`). */
export interface CrossTabAxis {
  /** Stable string keys (from {@link createStableObjectKey}) — React keys + grid lookup. */
  keys: string[];
  /** Human-readable header labels (via {@link formatGroupLabel}). */
  titles: string[];
  /** Raw axis values (parallel to `keys`). */
  values: unknown[];
}

export interface CrossTab {
  rowAxis: CrossTabAxis;
  colAxis: CrossTabAxis;
  /** grid[rowKey][colKey] = the member issues in that cell (row-group ∩ column-group). */
  grid: Record<string, Record<string, TableIssue[]>>;
  /** rowTotals[rowKey] = every issue in that row, counted once per row-value (across all columns). */
  rowTotals: Record<string, TableIssue[]>;
  /** colTotals[colKey] = every issue in that column, counted once per col-value (across all rows). */
  colTotals: Record<string, TableIssue[]>;
  /** Every issue, counted once — the grand-total cell (Total ∩ Total). */
  grandTotal: TableIssue[];
}

/** Expand a raw column value into the axis values it contributes to (array → each element). */
function expand(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw.length === 0 ? [null] : raw;
  return [raw ?? null];
}

/** The stable string key for an axis value (mirrors 1D grouping / GroupingReport `buildGrid`). */
function axisKey(value: unknown): string {
  return typeof value === 'object' && value !== null ? createStableObjectKey(value) : String(value ?? null);
}

/**
 * Unique, ordered values a column takes across `issues`, one axis of the cross-tab. Array values
 * expand to their elements. Ordered by title ascending with the {@link EMPTY_GROUP_LABEL} bucket
 * last — matching 1D {@link groupIssues} — so the two reports order their groups identically.
 */
export function getAxisValues(issues: TableIssue[], column: ColumnDefinition): CrossTabAxis {
  const byKey = new Map<string, { value: unknown; title: string }>();
  for (const issue of issues) {
    for (const value of expand(column.getValue(issue))) {
      const key = axisKey(value);
      if (!byKey.has(key)) byKey.set(key, { value, title: formatGroupLabel(value) });
    }
  }

  const entries = [...byKey.entries()].sort(([, a], [, b]) => {
    const aEmpty = a.title === EMPTY_GROUP_LABEL;
    const bEmpty = b.title === EMPTY_GROUP_LABEL;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    return a.title.localeCompare(b.title);
  });

  return {
    keys: entries.map(([key]) => key),
    titles: entries.map(([, v]) => v.title),
    values: entries.map(([, v]) => v.value),
  };
}

/**
 * Build the `grid[rowKey][colKey] = members` lookup plus the row/column/grand totals. An issue with
 * multiple values on an axis lands in each corresponding cell (cartesian), but each total collects it
 * once per value on that total's own axis (so a row total is not inflated by the column cartesian).
 */
export function buildGrid(
  issues: TableIssue[],
  rowColumn: ColumnDefinition,
  colColumn: ColumnDefinition,
): Pick<CrossTab, 'grid' | 'rowTotals' | 'colTotals' | 'grandTotal'> {
  const grid: Record<string, Record<string, TableIssue[]>> = {};
  const rowTotals: Record<string, TableIssue[]> = {};
  const colTotals: Record<string, TableIssue[]> = {};

  for (const issue of issues) {
    const rowValues = expand(rowColumn.getValue(issue));
    const colValues = expand(colColumn.getValue(issue));

    for (const rv of rowValues) {
      const rowKey = axisKey(rv);
      (rowTotals[rowKey] ??= []).push(issue);
      for (const cv of colValues) {
        const colKey = axisKey(cv);
        ((grid[rowKey] ??= {})[colKey] ??= []).push(issue);
      }
    }
    for (const cv of colValues) {
      (colTotals[axisKey(cv)] ??= []).push(issue);
    }
  }

  return { grid, rowTotals, colTotals, grandTotal: [...issues] };
}

/**
 * Build the full cross-tab from `issues` grouped by `rowColumn` (down the rows) and `colColumn`
 * (across the columns). Cells are aggregated on demand via {@link cellMembers} + `computeMeasureValue`.
 */
export function buildCrossTab(
  issues: TableIssue[],
  rowColumn: ColumnDefinition,
  colColumn: ColumnDefinition,
): CrossTab {
  return {
    rowAxis: getAxisValues(issues, rowColumn),
    colAxis: getAxisValues(issues, colColumn),
    ...buildGrid(issues, rowColumn, colColumn),
  };
}

/**
 * The member issues for one cell, transparently resolving the {@link TOTAL_KEY} sentinel on either
 * axis: `(row, col)` → grid cell, `(row, TOTAL)` → row total, `(TOTAL, col)` → column total,
 * `(TOTAL, TOTAL)` → grand total.
 */
export function cellMembers(crossTab: CrossTab, rowKey: string, colKey: string): TableIssue[] {
  if (rowKey === TOTAL_KEY && colKey === TOTAL_KEY) return crossTab.grandTotal;
  if (rowKey === TOTAL_KEY) return crossTab.colTotals[colKey] ?? [];
  if (colKey === TOTAL_KEY) return crossTab.rowTotals[rowKey] ?? [];
  return crossTab.grid[rowKey]?.[colKey] ?? [];
}

/**
 * The aggregated value shown in one cross-tab cell for one measure column: the column's own
 * aggregation over the cell's member issues. Returns `null` for an empty cell so callers can render
 * a placeholder.
 */
export function cellValue(
  crossTab: CrossTab,
  rowKey: string,
  colKey: string,
  measure: ColumnDefinition,
  overrides: AggregationOverrides = {},
): unknown {
  const members = cellMembers(crossTab, rowKey, colKey);
  if (members.length === 0) return null;
  return computeMeasureValue(measure, members, overrides[measure.id]);
}
