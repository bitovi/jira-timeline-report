/**
 * Persistence schema for the Table report (spec/012-table-and-grouper Phase 5).
 *
 * The report's *configuration* (which columns are shown + their per-column aggregation, the active
 * sort, filters, grouping and cross-tab axis) is stored in route-data observables so the view
 * survives reload and is URL-shareable. This module is the pure adapter between those persisted
 * shapes and the internal component model. Ephemeral UI toggles (tree expand/collapse, group
 * expand/collapse) are intentionally NOT persisted and stay as local React state.
 *
 * The persisted column list is an ordered array of {@link TableColumnEntry} — `{ sourceId,
 * aggregation?, width?, format?, valueOrder?, valueColors? }`. The per-column aggregation override folds directly into each entry rather
 * than living in a separate map, so a column and its override travel together.
 */
import type { AggregationId } from './aggregations';
import type { AggregationOverrides, DateFormatOverrides } from './grouping';
import type { ValueColors, ValueOrders } from './valueOrder';
import type { DateFormat } from './relativeDate';
import type { SortMode, SortState } from './applyView';

/** One persisted shown-column: its catalog id plus optional per-column aggregation, width + format. */
export interface TableColumnEntry {
  sourceId: string;
  aggregation?: AggregationId;
  width?: number;
  /** A date column's display format. Absent means `'date'`, so only `'relative'` is ever stored. */
  format?: DateFormat;
  /** The order of this column's values inside grouped cells (⋯ → Order and colors). Absent = A→Z. */
  valueOrder?: string[];
  /** Colours picked for this column's values, value → colour id (see `chartColors.ts`). */
  valueColors?: Record<string, string>;
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

/** The `columnId → DateFormat` map from a persisted entry list (entries with a non-default format). */
export function entriesToDateFormats(entries: readonly TableColumnEntry[]): DateFormatOverrides {
  const formats: DateFormatOverrides = {};
  for (const entry of entries) {
    if (entry.format === 'relative') formats[entry.sourceId] = entry.format;
  }
  return formats;
}

/** The `columnId → value order` map from a persisted entry list (entries with one set). */
export function entriesToValueOrders(entries: readonly TableColumnEntry[]): ValueOrders {
  const orders: ValueOrders = {};
  for (const entry of entries) {
    if (entry.valueOrder?.length) orders[entry.sourceId] = entry.valueOrder;
  }
  return orders;
}

/** The `columnId → picked colours` map from a persisted entry list (entries with any). */
export function entriesToValueColors(entries: readonly TableColumnEntry[]): ValueColors {
  const colors: ValueColors = {};
  for (const entry of entries) {
    if (entry.valueColors && Object.keys(entry.valueColors).length) colors[entry.sourceId] = entry.valueColors;
  }
  return colors;
}

/**
 * Set one column's value order and picked colours (⋯ → Order and colors). An empty or `undefined`
 * part drops its key so the default applies.
 */
export function setEntryValueSettings(
  entries: readonly TableColumnEntry[],
  sourceId: string,
  { valueOrder, valueColors }: { valueOrder?: string[]; valueColors?: Record<string, string> },
): TableColumnEntry[] {
  return entries.map((entry) => {
    if (entry.sourceId !== sourceId) return entry;
    const { valueOrder: _order, valueColors: _colors, ...rest } = entry;
    return {
      ...rest,
      ...(valueOrder?.length ? { valueOrder } : {}),
      ...(valueColors && Object.keys(valueColors).length ? { valueColors } : {}),
    };
  });
}

/** Set one column's date format, dropping the key for the default (`'date'`). */
export function setEntryFormat(
  entries: readonly TableColumnEntry[],
  sourceId: string,
  format: DateFormat,
): TableColumnEntry[] {
  return entries.map((entry) => {
    if (entry.sourceId !== sourceId) return entry;
    const { format: _previous, ...rest } = entry;
    return format === 'date' ? rest : { ...rest, format };
  });
}

/**
 * Rebuild the persisted entry list from the internal (ordered ids + override map) model, preserving
 * any `width`, `format`, `valueOrder` and `valueColors` already stored on a prior entry of the same id.
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
    const format = prevById.get(sourceId)?.format;
    if (format != null) entry.format = format;
    const valueOrder = prevById.get(sourceId)?.valueOrder;
    if (valueOrder != null) entry.valueOrder = valueOrder;
    const valueColors = prevById.get(sourceId)?.valueColors;
    if (valueColors != null) entry.valueColors = valueColors;
    return entry;
  });
}

/** Compose the internal {@link SortState} from the two persisted scalars ('' column ⇒ no sort). */
export function toSortState(sortColumn: string, sortDir: string): SortState {
  if (!sortColumn) return null;
  const dir: SortMode = sortDir === 'desc' ? 'desc' : sortDir === 'tree' ? 'tree' : sortDir === 'rank' ? 'rank' : 'asc';
  return { columnId: sortColumn, dir };
}
