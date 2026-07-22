/**
 * Table report — Phases 1–2 (spec/012-table-and-grouper/plan.md).
 *
 * Phase 1 shipped the "start simple" flat table: add/remove columns, click-to-sort, and per-column
 * type-aware filtering. Phase 2 adds HIERARCHY row-ordering (a `Rows: Sort | Hierarchy` segmented
 * control), absorbing the Estimation Table: in hierarchy mode rows are the full issue tree
 * (depth-first via `reportingHierarchy.childKeys`), the tree column is indented + gets an
 * expand/collapse caret, parent rows show their precomputed rollup values, and the estimation
 * columns render the "last ➡ current" diff with a breakdown modal on Estimated Days.
 *
 * All behind the `tableReport` feature flag under the temporary report key `table2` (coexists with
 * the legacy `grouper` and `table` reports until retirement, plan Phase 7). Persistence is Phase 5 —
 * for now view state (columns, sort, filters, row ordering, collapsed keys) lives in local state.
 *
 * Data:
 *  - Flat (sort) mode shows the FULL loaded issue set across ALL hierarchy levels: it prefers the
 *    fully rolled-up set (`allIssuesOrReleases`, so estimation/rollup columns work) and falls back to
 *    `linkIssues(filteredDerivedIssues)` (all levels, no top-level filter) when no rollup obs is wired.
 *  - Hierarchy mode uses the fully rolled-up issue sets (`primaryIssuesOrReleases` = roots,
 *    `allIssuesOrReleases` = the full linked set with `reportingHierarchy.childKeys` + rollups),
 *    exactly like the Estimation Table.
 */
import React, { Suspense, useMemo, useState } from 'react';
import Button from '@atlaskit/button/new';

import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useJiraIssueFields } from '../../services/jira/useJiraIssueFields';
import { linkIssues } from '../GroupingReport/jira/linked-issue/linked-issue';
import { FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES } from '../../../jira/rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time';
import Stats from '../../Stats/Stats';
import { EstimateBreakdownModal } from '../EstimationTable/components/EstimateBreakdownModal';

import { buildColumnCatalog, TREE_CAPABLE_IDS } from './model/buildColumnCatalog';
import {
  applyFilters,
  applySort,
  applyView,
  cycleSort,
  cycleTreeSort,
  isFilterActive,
  isHierarchySort,
  removeColumn,
  reorderColumn,
} from './model/applyView';
import { buildHierarchyRows } from './model/hierarchyRows';
import {
  computeMeasureValue,
  formatMeasureValue,
  groupIssues,
  selectMeasureColumns,
  sortGroups,
} from './model/grouping';
import { buildCrossTab, cellValue, TOTAL_KEY, TOTAL_LABEL } from './model/crosstab';
import { ColumnHeaderMenu } from './components/ColumnHeaderMenu';

import type { DerivedIssue } from '../../../jira/derived/derive';
import type { EstimationIssue } from '../EstimationTable/types';
import type { AggregationId } from './model/aggregations';
import type { ColumnDefinition, TableIssue } from './model/columns';
import type { FilterState, FilterValue, SortState } from './model/applyView';
import type { AggregationOverrides, GroupSort } from './model/grouping';
import type { CrossTab } from './model/crosstab';
import type { HierarchyRow } from './model/hierarchyRows';
import type { IssueFields } from './model/buildColumnCatalog';
import type { TableColumnEntry } from './model/persistence';
import {
  DEFAULT_TABLE_COLUMNS,
  buildColumnEntries,
  entriesToAggregationOverrides,
  entriesToColumnIds,
  toSortState,
} from './model/persistence';

/** A fully rolled-up issue as the pipeline hands it to reports (loose — columns read a narrow slice). */
type RollupIssue = Record<string, unknown> & { key?: string; hierarchyLevel?: number; issue?: { fields?: Record<string, unknown> } };

export interface TableReportProps {
  filteredDerivedIssuesObs: CanObservable<DerivedIssue[]>;
  rollupTimingLevelsAndCalculationsObs: CanObservable<Array<{ hierarchyLevel: number }>>;
  /** Roots for hierarchy mode (top-level rolled-up issues). Spread from TimelineReport baseProps. */
  primaryIssuesOrReleasesObs?: CanObservable<RollupIssue[]>;
  /** The full linked set for hierarchy mode (with `reportingHierarchy.childKeys` + rollups). */
  allIssuesOrReleasesObs?: CanObservable<RollupIssue[]>;

  // --- Phase 5 persisted view state (route-data observables). All optional: when a prop is absent
  // the report falls back to a stable local observable, so it still renders standalone (e.g. in unit
  // tests that don't wire routing). See `useOptionalObs`. ---
  /** Ordered shown-column list — each `{ sourceId, aggregation?, width? }`. */
  tableColumnsObs?: CanObservable<TableColumnEntry[]>;
  /** Active sort column id ('' = no sort). */
  tableSortColumnObs?: CanObservable<string>;
  /** Active sort direction: 'asc' | 'desc'. */
  tableSortDirObs?: CanObservable<string>;
  /** Per-column filter map. */
  tableFiltersObs?: CanObservable<FilterState>;
  /** Row-axis group column id ('' = ungrouped). */
  tableGroupByObs?: CanObservable<string>;
  /** Column-axis (2D) group column id ('' = none). */
  tableGroupByColObs?: CanObservable<string>;
  /** Cross-tab fields axis: 'rows' | 'cols'. */
  tableFieldAxisObs?: CanObservable<string>;
}

/**
 * A stable no-op observable used when an optional hierarchy-mode observable prop is absent (e.g. in
 * Phase 1 unit tests). Module-level so its identity never changes across renders — {@link useCanObservable}
 * subscribes on identity, and hooks must be called unconditionally.
 */
const EMPTY_OBS: CanObservable<RollupIssue[]> = {
  value: [],
  get: () => [],
  getData: () => [],
  on: () => {},
  off: () => {},
  set: () => {},
} as unknown as CanObservable<RollupIssue[]>;

/**
 * A minimal writable CanObservable backed by a plain closure — the local fallback used when a
 * persisted-state prop is absent. `.value` reads/writes live and fires subscribers, so
 * {@link useCanObservable} re-renders on write exactly like a real route-data observable.
 */
function createLocalObs<T>(initial: T): CanObservable<T> {
  let current = initial;
  const handlers = new Set<() => void>();
  const notify = () => handlers.forEach((h) => h());
  const o = {
    get value() {
      return current;
    },
    set value(v: T) {
      current = v;
      notify();
    },
    get: () => current,
    getData: () => current,
    set: (v: T) => {
      current = v;
      notify();
    },
    on: (h: () => void) => {
      handlers.add(h);
    },
    off: (h: () => void) => {
      handlers.delete(h);
    },
  };
  return o as unknown as CanObservable<T>;
}

/** Resolve to the provided observable, or a stable local fallback seeded with `initial`. */
function useOptionalObs<T>(obs: CanObservable<T> | undefined, initial: T): CanObservable<T> {
  const ref = React.useRef<CanObservable<T> | null>(null);
  if (ref.current === null) ref.current = createLocalObs(initial);
  return obs ?? ref.current;
}

/**
 * Adapt a linked DerivedIssue into the loose {@link TableIssue} shape the column model reads.
 * Spreads the whole derived issue so the normalized top-level properties (`parentKey`, `team`,
 * `projectKey`, `status`, `storyPoints`, `dueDate`, …) are available to normalized field sources
 * (issues-plan.md #3/#4), and surfaces the raw Jira `issue.fields` map under `fields` for the raw
 * fallback — matching how {@link toHierarchyIssue} already exposes both.
 */
function toTableIssue(issue: DerivedIssue): TableIssue {
  return { ...issue, fields: issue.issue?.fields as Record<string, unknown> | undefined };
}

/**
 * Adapt a rolled-up issue for hierarchy mode: keep every field the column model / breakdown modal
 * reads (key, summary, url, derivedTiming, completionRollup, reportingHierarchy, issueLastPeriod,
 * team, storyPointsMedian, raw `issue`) and surface Jira fields under `fields` (keyed by display
 * name) the same way flat mode does, so identity/field columns behave identically in both modes.
 */
function toHierarchyIssue(issue: RollupIssue): TableIssue {
  return { ...issue, fields: issue.issue?.fields };
}

/** Distinct rendered-string values a column takes across the issue set (for `select` filters). */
function distinctValues(column: ColumnDefinition, issues: TableIssue[]): string[] {
  const seen = new Set<string>();
  for (const issue of issues) {
    const raw = column.getValue(issue);
    if (raw != null && raw !== '') seen.add(String(raw));
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Placeholder shown for an empty cross-tab cell (no members). */
const EMPTY_CELL = '·';

// --- Phase 6: sticky headers / frozen label columns (design §8) ------------------------------------
// Implemented with inline React.CSSProperties objects rather than Tailwind utilities on purpose: the
// app loads PRECOMPILED Tailwind from dist/production.css (see MEMORY note), so a newly-introduced
// `sticky`/`top-0`/`left-*` utility that isn't already in that build would silently not apply at
// runtime. Inline styles are guaranteed to render and let us express exact left offsets. Every sticky
// cell needs an OPAQUE background so scrolled-under content doesn't bleed through — we use white
// (the @atlaskit `elevation.surface` table background) uniformly for guaranteed opacity.
const STICKY_BG = '#ffffff';
// z-index layering: frozen label column sits above the body, the sticky header row above that, and
// the header ∩ frozen-column corner above everything so it stays crisp in both scroll directions.
const Z_HEADER = 20;
const Z_FROZEN = 30;
const Z_CORNER = 40;
// Explicit widths for the frozen label columns so a second frozen column can be offset deterministically
// (its `left` = the first column's width). Only needed where two columns freeze (2D "Down rows").
const FROZEN_COL1_W = 180;
const FROZEN_COL2_W = 120;
// Height of a single header row, used as the `top` offset for the SECOND header row in the 2D
// "Across cols" two-row header so both rows stack and stay visible on vertical scroll. Matches the
// p-2 (8px top+bottom) padding plus a ~1rem line box.
const HEADER_ROW_H = 37;

/** Header cell that sticks to the top on vertical scroll. */
const stickyHeaderStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  position: 'sticky',
  top: 0,
  zIndex: Z_HEADER,
  background: STICKY_BG,
  ...extra,
});
/** Body label cell that freezes to the left on horizontal scroll. */
const frozenLabelStyle = (left = 0, extra?: React.CSSProperties): React.CSSProperties => ({
  position: 'sticky',
  left,
  zIndex: Z_FROZEN,
  background: STICKY_BG,
  ...extra,
});
/** The header ∩ frozen-column corner: sticks in BOTH directions, above both other layers. */
const stickyCornerStyle = (left = 0, top = 0, extra?: React.CSSProperties): React.CSSProperties => ({
  position: 'sticky',
  top,
  left,
  zIndex: Z_CORNER,
  background: STICKY_BG,
  ...extra,
});

/**
 * Table chrome to match the mock (spec/012 mockups/table-report.html, issues-plan.md #5). Injected as
 * a literal `<style>` block scoped to `[data-testid="table-report"]` rather than Tailwind utilities on
 * purpose: the app/Storybook load PRECOMPILED Tailwind (see MEMORY note + the sticky-style comment
 * above), so newly-introduced utilities like `border`/`rounded` would silently not apply. Literal CSS
 * always applies. Colours are the mock's Atlaskit-ish neutrals.
 */
/**
 * Small increasing-indent glyph shown next to a tree-capable column's label when it holds the
 * Hierarchy (tree) sort — a visible hint that the table is nested by this column
 * (design/tree-column-brainstorm §3).
 */
const HierarchySortGlyph: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    className="inline-block ml-1 align-middle text-blue-400"
    aria-hidden="true"
  >
    <line x1="2" y1="4" x2="13" y2="4" />
    <line x1="6" y1="8" x2="13" y2="8" />
    <line x1="10" y1="12" x2="13" y2="12" />
  </svg>
);

const TABLE_STYLES = `
[data-testid="table-report"] .overflow-x-auto {
  border: 1px solid #dfe1e6;
  border-radius: 8px;
  background: #fff;
}
[data-testid="table-report"] table { border-collapse: collapse; width: 100%; font-size: 13px; }
[data-testid="table-report"] thead th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #626f86;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 2px solid #dfe1e6;
  white-space: nowrap;
  padding: 8px 12px;
}
/* The label sits inside a <button>; Tailwind/normalize preflight resets button text-transform/color,
   so re-apply the uppercase-subtle header treatment directly to it. */
[data-testid="table-report"] thead th [data-testid="table-header-sort"] {
  text-transform: uppercase;
  color: #626f86;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.03em;
}
[data-testid="table-report"] tbody td { border-bottom: 1px solid #f1f2f4; vertical-align: middle; }
[data-testid="table-report"] tbody tr:hover td { background: #f7f8f9; }
[data-testid="table-report"] tbody tr[data-testid="table-group-header"]:hover td { background: #f4f5f7; }
[data-testid="table-report"] tbody a { color: #0c66e4; text-decoration: none; }
[data-testid="table-report"] tbody a:hover { text-decoration: underline; }
/* Combined "Icon & Summary" / Summary column: the summary link looks like plain body text at rest
   and only reveals the link affordance on hover/focus (design/tree-column-brainstorm §5). The class
   selector overrides the generic tbody-a blue above. */
[data-testid="table-report"] tbody a.table-summary-link { color: inherit; text-decoration: none; }
[data-testid="table-report"] tbody a.table-summary-link:hover,
[data-testid="table-report"] tbody a.table-summary-link:focus-visible { color: #0c66e4; text-decoration: underline; }
/* Cap the "Icon & Summary" column's width so long summaries ellipsis instead of stretching the
   table indefinitely wide (the column's cell content truncates itself via Tailwind's truncate utility). */
[data-testid="table-report"] td[data-column-id="identity:treeSummary"] { max-width: 420px; }
/* Column drag-and-drop reordering (spec/012 column-reordering). New Tailwind utilities won't apply
   (precompiled CSS), so the reveal/affordance lives here. The grip is hidden at rest so the resting
   header renders identically to before — revealed only on header hover, grip focus, or active drag. */
[data-testid="table-report"] thead th [data-testid="table-header-drag-handle"] { opacity: 0; transition: opacity 120ms ease; }
[data-testid="table-report"] thead th:hover [data-testid="table-header-drag-handle"],
[data-testid="table-report"] thead th [data-testid="table-header-drag-handle"]:focus-visible { opacity: 1; }
[data-testid="table-report"] thead th[data-dragging="true"] [data-testid="table-header-drag-handle"] { opacity: 1; }
[data-testid="table-report"] thead th[data-dragging="true"] { opacity: 0.5; }
[data-testid="table-report"] thead th[data-drag-over="true"] { box-shadow: inset 2px 0 0 #0c66e4; }
`;

interface CrossTabTableProps {
  crossTab: CrossTab;
  /** The field grouped down the rows. */
  rowColumn: ColumnDefinition;
  /** The field grouped across the columns. */
  colColumn: ColumnDefinition;
  /** The measure columns aggregated in each cell (shown columns minus identity minus both groups). */
  measures: ColumnDefinition[];
  fieldAxis: 'rows' | 'cols';
  overrides: AggregationOverrides;
}

/**
 * The 2D cross-tab render (Phase 4, design §7). One field runs down the rows, the other across the
 * columns; each cell shows one aggregated measure value over the `row ∩ column` issues, plus a total
 * column and total row.
 *
 *  - **Down rows** (`fieldAxis === 'rows'`, default): a single header row of column-values; each
 *    row-value spans one *sub-row per measure* (a "Field" column names the measure). Stays narrow.
 *  - **Across cols** (`fieldAxis === 'cols'`): a merged two-row header — each column-value spans a
 *    block of measure sub-columns — one row per row-value. Today's Grouper pivot shape.
 */
const CrossTabTable: React.FC<CrossTabTableProps> = ({ crossTab, rowColumn, colColumn, measures, fieldAxis, overrides }) => {
  const { rowAxis, colAxis, rowTotals, colTotals, grandTotal } = crossTab;
  // Column keys/titles with the synthetic total appended.
  const colKeys = [...colAxis.keys, TOTAL_KEY];
  const colTitles = [...colAxis.titles, TOTAL_LABEL];
  const rowKeys = [...rowAxis.keys, TOTAL_KEY];
  const rowTitles = [...rowAxis.titles, TOTAL_LABEL];

  const countFor = (rowKey: string) => (rowKey === TOTAL_KEY ? grandTotal.length : rowTotals[rowKey]?.length ?? 0);

  const cell = (rowKey: string, colKey: string, measure: ColumnDefinition) => {
    const value = cellValue(crossTab, rowKey, colKey, measure, overrides);
    return value == null ? EMPTY_CELL : formatMeasureValue(value);
  };

  const cellClass = (colKey: string) => `p-2 text-right align-top border-b border-neutral-201 ${colKey === TOTAL_KEY ? 'font-semibold bg-neutral-101' : ''}`;

  if (fieldAxis === 'rows') {
    // ↓ Down rows: one header row (row-field, Field, each col-value…, Total); one sub-row per measure.
    return (
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="table-crosstab" data-field-axis="rows">
          <thead>
            <tr className="border-b border-neutral-301">
              <th
                className="p-2 text-left font-semibold"
                data-testid="table-crosstab-row-label"
                style={stickyCornerStyle(0, 0, { width: FROZEN_COL1_W, minWidth: FROZEN_COL1_W })}
              >
                {rowColumn.label}
              </th>
              <th
                className="p-2 text-left font-semibold text-neutral-801"
                style={stickyCornerStyle(FROZEN_COL1_W, 0, { width: FROZEN_COL2_W, minWidth: FROZEN_COL2_W })}
              >
                Field
              </th>
              {colTitles.map((title, i) => (
                <th key={colKeys[i]} className={`p-2 text-right font-semibold ${colKeys[i] === TOTAL_KEY ? 'bg-neutral-101' : ''}`} style={stickyHeaderStyle()}>
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rowKey, rowIdx) => (
              <React.Fragment key={rowKey}>
                {measures.map((measure, mIdx) => (
                  <tr key={`${rowKey}-${measure.id}`} data-testid={rowKey === TOTAL_KEY ? 'table-crosstab-total-row' : 'table-crosstab-row'} className={rowKey === TOTAL_KEY ? 'bg-neutral-101 font-semibold' : ''}>
                    {mIdx === 0 && (
                      <td
                        rowSpan={measures.length || 1}
                        className="p-2 align-top font-semibold border-t border-neutral-301"
                        style={frozenLabelStyle(0, { width: FROZEN_COL1_W, minWidth: FROZEN_COL1_W })}
                      >
                        {rowTitles[rowIdx]}
                        <span className="text-neutral-801 font-normal"> {countFor(rowKey)}</span>
                      </td>
                    )}
                    <td className="p-2 align-top text-neutral-801" style={frozenLabelStyle(FROZEN_COL1_W, { width: FROZEN_COL2_W, minWidth: FROZEN_COL2_W })}>
                      {measure.label}
                    </td>
                    {colKeys.map((colKey) => (
                      <td key={colKey} className={cellClass(colKey)} data-testid="table-crosstab-cell">
                        {cell(rowKey, colKey, measure)}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // → Across cols: merged two-row header (column-value spanning a block of measure sub-columns).
  const span = measures.length || 1;
  return (
    <div className="overflow-x-auto">
      <table className="w-full" data-testid="table-crosstab" data-field-axis="cols">
        <thead>
          <tr className="border-b border-neutral-201">
            {/* Frozen corner: spans both header rows AND sticks left, so it stays put in both directions. */}
            <th
              rowSpan={2}
              className="p-2 text-left font-semibold align-bottom"
              data-testid="table-crosstab-row-label"
              style={stickyCornerStyle(0, 0, { width: FROZEN_COL1_W, minWidth: FROZEN_COL1_W })}
            >
              {rowColumn.label}
            </th>
            {/* Row 1 (column-value blocks): sticks at the very top. */}
            {colTitles.map((title, i) => (
              <th key={colKeys[i]} colSpan={span} className={`p-2 text-center font-semibold border-l border-neutral-301 ${colKeys[i] === TOTAL_KEY ? 'bg-neutral-101' : ''}`} style={stickyHeaderStyle()}>
                {title}
              </th>
            ))}
          </tr>
          {/* Row 2 (measure sub-headers): sticks BELOW row 1 (top = header row height) so both stay visible. */}
          <tr className="border-b border-neutral-301">
            {colKeys.map((colKey) =>
              measures.map((measure, mIdx) => (
                <th key={`${colKey}-${measure.id}`} className={`p-2 text-right font-medium text-neutral-801 ${mIdx === 0 ? 'border-l border-neutral-301' : ''} ${colKey === TOTAL_KEY ? 'bg-neutral-101' : ''}`} style={stickyHeaderStyle({ top: HEADER_ROW_H })}>
                  {measure.label}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rowKey, rowIdx) => (
            <tr key={rowKey} data-testid={rowKey === TOTAL_KEY ? 'table-crosstab-total-row' : 'table-crosstab-row'} className={rowKey === TOTAL_KEY ? 'bg-neutral-101 font-semibold border-t border-neutral-301' : 'border-b border-neutral-201'}>
              <td className="p-2 align-top font-semibold" style={frozenLabelStyle(0, { width: FROZEN_COL1_W, minWidth: FROZEN_COL1_W })}>
                {rowTitles[rowIdx]}
                <span className="text-neutral-801 font-normal"> {countFor(rowKey)}</span>
              </td>
              {colKeys.map((colKey) =>
                measures.map((measure, mIdx) => (
                  <td key={`${colKey}-${measure.id}`} className={`p-2 text-right align-top ${mIdx === 0 ? 'border-l border-neutral-301' : ''} ${colKey === TOTAL_KEY ? 'bg-neutral-101' : ''}`} data-testid="table-crosstab-cell">
                    {cell(rowKey, colKey, measure)}
                  </td>
                )),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TableReportInner: React.FC<TableReportProps> = ({
  filteredDerivedIssuesObs,
  primaryIssuesOrReleasesObs,
  allIssuesOrReleasesObs,
  tableColumnsObs,
  tableSortColumnObs,
  tableSortDirObs,
  tableFiltersObs,
  tableGroupByObs,
  tableGroupByColObs,
  tableFieldAxisObs,
}) => {
  const filteredDerivedIssues = useCanObservable(filteredDerivedIssuesObs) || [];
  const primaryIssues = useCanObservable(primaryIssuesOrReleasesObs ?? EMPTY_OBS) || [];
  const allRollupIssues = useCanObservable(allIssuesOrReleasesObs ?? EMPTY_OBS) || [];
  const fields = useJiraIssueFields() as IssueFields;

  const catalog = useMemo(() => buildColumnCatalog(fields), [fields]);
  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  // Flat-mode issue set: the FULL loaded issue set across all hierarchy levels (design fix — flat/sort
  // mode used to be filtered to the top level, hiding most rows). Prefer the rolled-up set so estimation
  // columns have rollup fields; fall back to the linked derived issues (e.g. unit tests with no rollup
  // obs), with no top-level filter.
  const flatIssues = useMemo<TableIssue[]>(() => {
    if (allRollupIssues.length > 0) return allRollupIssues.map(toHierarchyIssue);
    return linkIssues(filteredDerivedIssues).map((issue) => toTableIssue(issue as unknown as DerivedIssue));
  }, [allRollupIssues, filteredDerivedIssues]);

  // Hierarchy-mode issue sets (Phase 2): the fully rolled-up roots + full linked set.
  const hierarchyRoots = useMemo<TableIssue[]>(() => primaryIssues.map(toHierarchyIssue), [primaryIssues]);
  const hierarchyAll = useMemo<TableIssue[]>(() => allRollupIssues.map(toHierarchyIssue), [allRollupIssues]);

  // --- Phase 5 persisted configuration (route-data observables, with local fallback) ---------------
  // Configuration that should survive reload / be URL-shareable lives in observables. The per-column
  // aggregation override folds into each column entry (schema `{ sourceId, aggregation?, width? }`),
  // so there is no separate persisted aggregation map.
  const columnsObs = useOptionalObs(tableColumnsObs, DEFAULT_TABLE_COLUMNS);
  const sortColumnObs = useOptionalObs(tableSortColumnObs, 'identity:treeSummary');
  const sortDirObs = useOptionalObs(tableSortDirObs, 'tree');
  const filtersObs = useOptionalObs(tableFiltersObs, {} as FilterState);
  const groupByObs = useOptionalObs(tableGroupByObs, '');
  const groupByColObs = useOptionalObs(tableGroupByColObs, '');
  const fieldAxisObs = useOptionalObs(tableFieldAxisObs, 'rows');

  const columnEntries = useCanObservable(columnsObs) || DEFAULT_TABLE_COLUMNS;
  const sortColumnId = useCanObservable(sortColumnObs) || '';
  const sortDir = useCanObservable(sortDirObs) || 'asc';
  const filters = useCanObservable(filtersObs) || {};
  const groupByRaw = useCanObservable(groupByObs) || '';
  const groupByColRaw = useCanObservable(groupByColObs) || '';
  const fieldAxis = ((useCanObservable(fieldAxisObs) || 'rows') as 'rows' | 'cols');

  const columnIds = useMemo(() => entriesToColumnIds(columnEntries), [columnEntries]);
  const aggregationOverrides = useMemo<Record<string, AggregationId>>(
    () => entriesToAggregationOverrides(columnEntries),
    [columnEntries],
  );
  const sort = useMemo<SortState>(() => toSortState(sortColumnId, sortDir), [sortColumnId, sortDir]);
  // `groupBy`/`groupByCol` are null when unset (the rest of the component reasons in terms of null).
  const groupBy = groupByRaw || null;
  const groupByCol = groupByColRaw || null;

  // Row ordering is a property of the tree column's sort (design/tree-column-brainstorm §3/§4): the
  // table nests when a tree-capable column holds the `tree` sort AND we aren't grouping (grouping and
  // hierarchy are mutually exclusive). `activeTreeId` is the column that owns the indent + caret.
  const isHierarchy = isHierarchySort(sort, TREE_CAPABLE_IDS) && groupBy == null;
  const activeTreeId = isHierarchy ? sort!.columnId : null;

  // Ephemeral UI toggles — deliberately NOT persisted (pure expand/collapse view state + modal).
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [breakdownIssue, setBreakdownIssue] = useState<TableIssue | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  // Group-ordering control: local-only (not in the Phase 5 persisted schema, plan lines 199-210).
  const [groupSort, setGroupSort] = useState<GroupSort>({ by: 'label', dir: 'asc' });

  // --- Write-back helpers: mirror GroupingReport (obs.value = next) instead of setState -------------
  const writeColumns = (nextIds: string[], nextOverrides: Record<string, AggregationId> = aggregationOverrides) => {
    columnsObs.value = buildColumnEntries(nextIds, nextOverrides, columnEntries);
  };
  const setSort = (next: SortState) => {
    sortColumnObs.value = next ? next.columnId : '';
    if (next) sortDirObs.value = next.dir;
  };

  // Resolve shown column ids into definitions (dropping any that no longer exist in the catalog).
  const columns = useMemo(
    () => columnIds.map((id) => catalogById.get(id)).filter((c): c is ColumnDefinition => c != null),
    [columnIds, catalogById],
  );

  // The issue set the header's `select` filter options are drawn from.
  const filterSourceIssues = isHierarchy ? hierarchyAll : flatIssues;

  // Flat rows: filter + sort. Each row is a plain issue (depth 0, no tree decoration).
  const flatRows = useMemo(
    () => applyView(flatIssues, columns, filters, sort).map<HierarchyRow>((issue) => ({ issue, depth: 0, hasChildren: false, childKeys: [] })),
    [flatIssues, columns, filters, sort],
  );

  // Hierarchy rows: filter the full set, then depth-first flatten from surviving roots; column sort
  // (if any) orders within siblings (design §4); collapsed rows hide their descendants.
  const hierarchyRows = useMemo(() => {
    const filteredAll = applyFilters(hierarchyAll, columns, filters);
    const roots = applyFilters(hierarchyRoots, columns, filters);
    // A `tree` sort nests by the reporting hierarchy, so siblings keep their natural order; only an
    // asc/desc sort on a column orders within siblings (design §4).
    const sortColumn = sort && sort.dir !== 'tree' ? columns.find((c) => c.id === sort.columnId) ?? null : null;
    const compareSiblings = sortColumn
      ? (a: TableIssue, b: TableIssue) => (sort!.dir === 'desc' ? -1 : 1) * sortColumn.compare(sortColumn.getValue(a), sortColumn.getValue(b))
      : undefined;
    return buildHierarchyRows({ roots, allIssues: filteredAll, collapsedKeys, compareSiblings });
  }, [hierarchyAll, hierarchyRoots, columns, filters, sort, collapsedKeys]);

  const rows = isHierarchy ? hierarchyRows : flatRows;

  // --- Phase 3 grouping ------------------------------------------------------
  // Grouping and hierarchy are mutually exclusive (design/tree-column-brainstorm §3): grouping only
  // applies in flat ordering, and `isHierarchy` is already false whenever a group is active.
  const groupColumn = groupBy ? catalogById.get(groupBy) ?? null : null;
  const groupColColumn = groupByCol ? catalogById.get(groupByCol) ?? null : null;
  // 2D cross-tab needs both group columns (and flat ordering); 1D needs only the row group column.
  const is2D = groupColumn != null && groupColColumn != null && !isHierarchy;
  const isGrouped = groupColumn != null && !is2D && !isHierarchy;

  // When 1D-grouped, the grouped field becomes the leading LABEL column (design §7 / mockup
  // preview-3-grouped.png): pull it to the front so its header sits first and its group-header cell
  // holds the caret + group label + member count. Every other shown column keeps its order behind it.
  // Flat, hierarchy, and 2D layouts keep the plain shown-column order (displayColumns === columns).
  const displayColumns = useMemo<ColumnDefinition[]>(
    () => (isGrouped && groupColumn ? [groupColumn, ...columns.filter((c) => c.id !== groupColumn.id)] : columns),
    [isGrouped, groupColumn, columns],
  );

  // Which shown columns are measures (aggregated per group): shown minus identity minus grouped
  // col(s). In 2D BOTH grouped fields drop out (design §7).
  const measureColumnIds = useMemo(
    () => new Set(selectMeasureColumns(columns, groupColumn, is2D ? groupColColumn : null).map((c) => c.id)),
    [columns, groupColumn, groupColColumn, is2D],
  );

  // Cross-tab measures (ordered): shown columns minus identity minus both grouped fields.
  const crossTabMeasures = useMemo(
    () => (is2D ? selectMeasureColumns(columns, groupColumn, groupColColumn) : []),
    [is2D, columns, groupColumn, groupColColumn],
  );

  // Build the cross-tab from the filtered flat issue set (design §7 — reuse the cartesian axis/grid).
  const crossTab = useMemo<CrossTab | null>(() => {
    if (!is2D || !groupColumn || !groupColColumn) return null;
    const filtered = applyFilters(flatIssues, columns, filters);
    return buildCrossTab(filtered, groupColumn, groupColColumn);
  }, [is2D, groupColumn, groupColColumn, flatIssues, columns, filters]);

  // Filter → group → order groups → sort members within each group by the active column sort.
  const groups = useMemo(() => {
    if (!isGrouped || !groupColumn) return [];
    const filtered = applyFilters(flatIssues, columns, filters);
    let result = groupIssues(filtered, groupColumn);
    result = sortGroups(result, groupSort, columns, aggregationOverrides);
    if (sort) {
      const sortColumn = columns.find((c) => c.id === sort.columnId) ?? null;
      if (sortColumn) {
        result = result.map((g) => ({ ...g, members: applySort(g.members, sortColumn, sort.dir) }));
      }
    }
    return result;
  }, [isGrouped, groupColumn, flatIssues, columns, filters, groupSort, aggregationOverrides, sort]);

  const setColumnFilter = (columnId: string, value: FilterValue | undefined) => {
    const next = { ...filters };
    if (value == null) delete next[columnId];
    else next[columnId] = value;
    filtersObs.value = next;
  };

  const handleRemoveColumn = (columnId: string) => {
    writeColumns(removeColumn(columnIds, columnId));
    if (sort?.columnId === columnId) setSort(null);
    setColumnFilter(columnId, undefined);
  };

  // Column reordering. Move-left/right (keyboard-accessible menu) and pointer drag both resolve to
  // the same primitive: compute source/target ids in the *displayed* order, then reorder the
  // PERSISTED `columnIds` (not the transient `displayColumns`, which pulls the grouped field to the
  // front). reorderColumn inserts source just-before target, so re-applying the group-front pull
  // afterward keeps the grouped label column pinned regardless of the underlying persisted order.
  const reorderPersisted = (sourceId: string, targetId: string | null) => {
    writeColumns(reorderColumn(columnIds, sourceId, targetId));
  };
  const moveColumnLeft = (colIndex: number) => {
    const source = displayColumns[colIndex];
    const target = displayColumns[colIndex - 1];
    if (source && target) reorderPersisted(source.id, target.id);
  };
  const moveColumnRight = (colIndex: number) => {
    const source = displayColumns[colIndex];
    if (!source) return;
    // Insert just-before the column two slots to the right (or append when the right neighbor is last).
    reorderPersisted(source.id, displayColumns[colIndex + 2]?.id ?? null);
  };

  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const handleColumnDrop = (targetId: string) => {
    if (draggedColumnId && draggedColumnId !== targetId) reorderPersisted(draggedColumnId, targetId);
    setDraggedColumnId(null);
    setDragOverColumnId(null);
  };

  const toggleCollapse = (key: string | undefined) => {
    if (key == null) return;
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAllGroups = () => setExpandedGroups(new Set(groups.map((g) => g.key)));
  const collapseAllGroups = () => setExpandedGroups(new Set());

  const setColumnAggregation = (columnId: string, value: AggregationId) => {
    writeColumns(columnIds, { ...aggregationOverrides, [columnId]: value });
  };

  const showStats = isHierarchy && FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES();

  return (
    <div className="p-2 mb-10" data-testid="table-report">
      <style>{TABLE_STYLES}</style>
      {/* The PRIMARY controls (Rows / Group by / 2D dimension / Fields axis / Add column) live in the
          shared Report-type control row via <TableReportControls /> — they write the same route-data
          keys this body reads, so the two stay in sync. The controls below are contextual to the
          grouped view and act on body-local ephemeral state (group ordering + expand/collapse), so
          they stay here, rendered only when grouped. */}
      {isGrouped && (
        <div className="flex items-center gap-2 pb-2 flex-wrap" data-testid="table-group-controls">
          <label className="flex items-center gap-1 text-sm" data-testid="table-group-sort">
            <span className="text-neutral-801">Order groups</span>
            <select
              className="border border-neutral-301 rounded px-2 py-1 text-sm bg-white"
              value={typeof groupSort.by === 'string' ? groupSort.by : `col:${groupSort.by.columnId}`}
              onChange={(e) => {
                const raw = e.target.value;
                const by: GroupSort['by'] = raw.startsWith('col:') ? { columnId: raw.slice(4) } : (raw as 'label' | 'count');
                setGroupSort((prev) => ({ ...prev, by }));
              }}
            >
              <option value="label">Label</option>
              <option value="count">Count</option>
              {selectMeasureColumns(columns, groupColumn).map((c) => (
                <option key={c.id} value={`col:${c.id}`}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-testid="table-group-sort-dir"
              className="border border-neutral-301 rounded px-2 py-1 text-sm bg-white"
              onClick={() => setGroupSort((prev) => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))}
            >
              {groupSort.dir === 'asc' ? '▲' : '▼'}
            </button>
          </label>

          <Button testId="table-expand-all" appearance="default" spacing="compact" onClick={expandAllGroups}>
            Expand all
          </Button>
          <Button testId="table-collapse-all" appearance="default" spacing="compact" onClick={collapseAllGroups}>
            Collapse all
          </Button>
        </div>
      )}

      {showStats && (
        <Stats
          primaryIssuesOrReleasesObs={
            primaryIssuesOrReleasesObs as unknown as React.ComponentProps<typeof Stats>['primaryIssuesOrReleasesObs']
          }
        />
      )}

      <>
        {is2D && crossTab && groupColumn && groupColColumn ? (
          <CrossTabTable
            crossTab={crossTab}
            rowColumn={groupColumn}
            colColumn={groupColColumn}
            measures={crossTabMeasures}
            fieldAxis={fieldAxis}
            overrides={aggregationOverrides}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {displayColumns.map((column, colIndex) => {
                    const active = isFilterActive(filters[column.id]);
                    const columnSortMode = sort?.columnId === column.id ? sort.dir : null;
                    // The first column is the row-label column and freezes on horizontal scroll, so its
                    // header is the sticky corner (top + left); the rest only stick to the top.
                    const headerStyle = colIndex === 0 ? stickyCornerStyle(0, 0) : stickyHeaderStyle();
                    // The grouped label column is pinned to the front (design §7), so it isn't reorderable;
                    // every other shown column can move. Move-left stops at the first movable slot.
                    const isPinnedGroup = isGrouped && groupColumn != null && column.id === groupColumn.id;
                    const firstMovableIndex = isGrouped ? 1 : 0;
                    const canMoveLeft = !isPinnedGroup && colIndex > firstMovableIndex;
                    const canMoveRight = !isPinnedGroup && colIndex < displayColumns.length - 1;
                    return (
                      <th
                        key={column.id}
                        data-column-id={column.id}
                        data-drag-over={dragOverColumnId === column.id ? 'true' : undefined}
                        data-dragging={draggedColumnId === column.id ? 'true' : undefined}
                        className="p-2 text-left align-bottom"
                        style={headerStyle}
                        onDragOver={
                          isPinnedGroup
                            ? undefined
                            : (e) => {
                                if (!draggedColumnId || draggedColumnId === column.id) return;
                                e.preventDefault();
                                if (dragOverColumnId !== column.id) setDragOverColumnId(column.id);
                              }
                        }
                        onDragLeave={() => setDragOverColumnId((cur) => (cur === column.id ? null : cur))}
                        onDrop={
                          isPinnedGroup
                            ? undefined
                            : (e) => {
                                e.preventDefault();
                                handleColumnDrop(column.id);
                              }
                        }
                      >
                        <div className="group flex items-center" style={{ position: 'relative' }}>
                          {!isPinnedGroup && (
                            <span
                              role="button"
                              aria-label={`Drag ${column.label} column to reorder`}
                              data-testid="table-header-drag-handle"
                              draggable
                              tabIndex={0}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', column.id);
                                setDraggedColumnId(column.id);
                              }}
                              onDragEnd={() => {
                                setDraggedColumnId(null);
                                setDragOverColumnId(null);
                              }}
                              style={{
                                position: 'absolute',
                                left: '-11px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                cursor: 'grab',
                                userSelect: 'none',
                                lineHeight: 1,
                                letterSpacing: '-3px',
                                color: '#626f86',
                              }}
                            >
                              ⋮⋮
                            </span>
                          )}
                          <button
                            type="button"
                            className="font-semibold text-left cursor-pointer hover:underline"
                            data-testid="table-header-sort"
                            // Tree-capable columns cycle Hierarchy → A→Z → Z→A; others cycle asc/desc/none.
                            onClick={() => setSort((column.isTree ? cycleTreeSort : cycleSort)(sort, column.id))}
                          >
                            {column.label}
                            {columnSortMode === 'tree' ? (
                              <HierarchySortGlyph />
                            ) : columnSortMode === 'asc' ? (
                              ' ▲'
                            ) : columnSortMode === 'desc' ? (
                              ' ▼'
                            ) : (
                              ''
                            )}
                          </button>
                          <ColumnHeaderMenu
                            column={column}
                            filterValue={filters[column.id]}
                            onFilterChange={(value) => setColumnFilter(column.id, value)}
                            onRemove={() => handleRemoveColumn(column.id)}
                            filterOptions={column.filter?.kind === 'select' ? distinctValues(column, filterSourceIssues) : undefined}
                            isActive={active}
                            sortMode={columnSortMode}
                            onSortChange={(mode) => setSort(mode == null ? null : { columnId: column.id, dir: mode })}
                            aggregationOverride={aggregationOverrides[column.id]}
                            onAggregationChange={
                              isGrouped && measureColumnIds.has(column.id)
                                ? (value) => setColumnAggregation(column.id, value)
                                : undefined
                            }
                            onMoveLeft={canMoveLeft ? () => moveColumnLeft(colIndex) : undefined}
                            onMoveRight={canMoveRight ? () => moveColumnRight(colIndex) : undefined}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {isGrouped
                  ? groups.map((group) => {
                      const expanded = expandedGroups.has(group.key);
                      return (
                        <React.Fragment key={group.key}>
                          <tr className="bg-neutral-101 font-semibold border-t border-neutral-301" data-testid="table-group-header">
                            {displayColumns.map((column) => {
                              // The grouped field is pulled to the FRONT as the label column: its cell holds
                              // the caret + group label + member count (design §7 / mockup preview-3-grouped).
                              if (column.id === groupColumn?.id) {
                                return (
                                  <td key={column.id} className="p-2 align-top" style={frozenLabelStyle()}>
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 cursor-pointer text-left"
                                      data-testid="table-group-caret"
                                      aria-expanded={expanded}
                                      aria-label={expanded ? 'Collapse group' : 'Expand group'}
                                      onClick={() => toggleGroupExpanded(group.key)}
                                    >
                                      <span className="w-4 text-neutral-801">{expanded ? '▼' : '▶'}</span>
                                      <span>{group.label}</span>
                                      <span className="text-neutral-801 font-normal" data-testid="table-group-count">
                                        ({group.members.length})
                                      </span>
                                    </button>
                                  </td>
                                );
                              }
                              if (measureColumnIds.has(column.id)) {
                                const value = computeMeasureValue(column, group.members, aggregationOverrides[column.id]);
                                return (
                                  <td key={column.id} className="p-2 align-top" data-testid="table-group-measure">
                                    {formatMeasureValue(value)}
                                  </td>
                                );
                              }
                              // Remaining shown columns are identity columns (Issue Key, Summary, …). Rather
                              // than leave them blank, list the group members' distinct values (issues.md —
                              // "issue key and summary should be given the list").
                              return (
                                <td key={column.id} className="p-2 align-top text-neutral-801" data-testid="table-group-identity-list">
                                  {distinctValues(column, group.members).join(', ')}
                                </td>
                              );
                            })}
                          </tr>
                          {expanded &&
                            group.members.map((issue, index) => (
                              <tr key={`${group.key}-${issue.key ?? 'row'}-${index}`} data-testid="table-group-member">
                                {displayColumns.map((column, colIndex) => (
                                  <td
                                    key={column.id}
                                    data-column-id={column.id}
                                    className="p-2 align-top pl-6"
                                    style={colIndex === 0 ? frozenLabelStyle() : undefined}
                                  >
                                    {column.render(column.getValue(issue), {
                                      issue,
                                      depth: 0,
                                      allIssues: filterSourceIssues,
                                      onEstimateBreakdown: (i) => setBreakdownIssue(i),
                                    })}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })
                  : rows.map((row, index) => (
                      <tr key={`${row.issue.key ?? 'row'}-${index}`}>
                        {displayColumns.map((column, colIndex) => {
                          const content = column.render(column.getValue(row.issue), {
                            issue: row.issue,
                            depth: row.depth,
                            allIssues: filterSourceIssues,
                            onEstimateBreakdown: (issue) => setBreakdownIssue(issue),
                          });
                          const isTreeCell = column.isTree && isHierarchy && column.id === activeTreeId;
                          return (
                            <td
                              key={column.id}
                              data-column-id={column.id}
                              className="p-2 align-top"
                              style={colIndex === 0 ? frozenLabelStyle() : undefined}
                            >
                              {isTreeCell ? (
                                <div className="flex items-center gap-1 min-w-0" style={{ paddingLeft: row.depth * 20 }}>
                                  {row.hasChildren ? (
                                    <button
                                      type="button"
                                      className="cursor-pointer w-4 text-neutral-801 flex-none"
                                      data-testid="table-tree-caret"
                                      aria-expanded={!collapsedKeys.has(row.issue.key ?? '')}
                                      aria-label={collapsedKeys.has(row.issue.key ?? '') ? 'Expand' : 'Collapse'}
                                      onClick={() => toggleCollapse(row.issue.key)}
                                    >
                                      {collapsedKeys.has(row.issue.key ?? '') ? '▶' : '▼'}
                                    </button>
                                  ) : (
                                    <span className="inline-block w-4 flex-none" />
                                  )}
                                  <span className="truncate min-w-0 flex-1">{content}</span>
                                </div>
                              ) : (
                                content
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        <EstimateBreakdownModal issue={breakdownIssue as EstimationIssue | null} onClose={() => setBreakdownIssue(null)} />
      </>
    </div>
  );
};

/**
 * The report entry point. Wraps the data-fetching inner component in a Suspense boundary because
 * {@link useJiraIssueFields} suspends (React Query `useSuspenseQuery`).
 */
export const TableReport: React.FC<TableReportProps> = (props) => (
  <Suspense fallback={<div className="p-2">Loading table…</div>}>
    <TableReportInner {...props} />
  </Suspense>
);

export default TableReport;
