/**
 * Persistence schema for the Table report (`table2`, spec/012-table-and-grouper Phase 5).
 *
 * The report's *configuration* (which columns are shown + their per-column aggregation, the active
 * sort, filters, grouping and cross-tab axis) is stored in route-data observables so the view
 * survives reload and is URL-shareable. This module is the pure adapter between those persisted
 * shapes and the internal component model. Ephemeral UI toggles (tree expand/collapse, group
 * expand/collapse) are intentionally NOT persisted and stay as local React state.
 *
 * The persisted column list is an ordered array of {@link TableColumnEntry} — `{ sourceId,
 * aggregation?, width? }`. The per-column aggregation override folds directly into each entry rather
 * than living in a separate map, so a column and its override travel together.
 */
import type { AggregationId } from './aggregations';
import type { AggregationOverrides } from './grouping';
import type { SortMode, SortState } from './applyView';

/** One persisted shown-column: its catalog id plus optional per-column aggregation + width. */
export interface TableColumnEntry {
  sourceId: string;
  aggregation?: AggregationId;
  width?: number;
}

/** The default shown columns: the combined "Icon & Summary" tree column. */
export const DEFAULT_TABLE_COLUMNS: TableColumnEntry[] = [{ sourceId: 'identity:treeSummary' }];

/** The ordered shown-column ids from a persisted entry list. */
export function entriesToColumnIds(entries: readonly TableColumnEntry[]): string[] {
  return entries.map((e) => e.sourceId);
}

/** The `columnId → AggregationId` override map from a persisted entry list (entries with one set). */
export function entriesToAggregationOverrides(entries: readonly TableColumnEntry[]): AggregationOverrides {
  const overrides: AggregationOverrides = {};
  for (const entry of entries) {
    if (entry.aggregation != null) overrides[entry.sourceId] = entry.aggregation;
  }
  return overrides;
}

/**
 * Rebuild the persisted entry list from the internal (ordered ids + override map) model, preserving
 * any `width` already stored on a prior entry of the same id.
 */
export function buildColumnEntries(
  columnIds: readonly string[],
  overrides: AggregationOverrides,
  prev: readonly TableColumnEntry[] = [],
): TableColumnEntry[] {
  const prevById = new Map(prev.map((e) => [e.sourceId, e]));
  return columnIds.map((sourceId) => {
    const entry: TableColumnEntry = { sourceId };
    const width = prevById.get(sourceId)?.width;
    if (width != null) entry.width = width;
    if (overrides[sourceId] != null) entry.aggregation = overrides[sourceId];
    return entry;
  });
}

/** Compose the internal {@link SortState} from the two persisted scalars ('' column ⇒ no sort). */
export function toSortState(sortColumn: string, sortDir: string): SortState {
  if (!sortColumn) return null;
  const dir: SortMode = sortDir === 'desc' ? 'desc' : sortDir === 'tree' ? 'tree' : 'asc';
  return { columnId: sortColumn, dir };
}
