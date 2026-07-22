/**
 * 1D grouping + per-column aggregation for the Table report
 * (spec/012-table-and-grouper, Phase 3, design §7 / mockup README).
 *
 * Grouping is the only feature that introduces *synthetic* rows (group-header rows) and requires
 * aggregating a column's value across a group's member issues. This module is the pure model layer:
 *
 *  - {@link groupIssues} buckets the (already filtered) issue set by a chosen "group column" using
 *    the shared {@link groupByKeys} / {@link createStableObjectKey} engine, and returns ordered
 *    `{ key, label, members }` groups.
 *  - {@link selectMeasureColumns} derives the measures automatically: the shown columns MINUS the
 *    identity columns MINUS the grouped column (there is no separate measures picker — design §7).
 *  - {@link computeMeasureValue} aggregates one measure column over a group's members using that
 *    column's effective aggregation (per-column override → `column.aggregate` → `defaultAggregate`).
 *
 * By convention (Phase 0) an aggregation reducer's item IS the already-extracted column value, so a
 * group is aggregated via `aggregateGroup(members.map(column.getValue), [reducer])`.
 */
import { aggregateGroup } from '../../GroupingReport/data/aggregate';
import { createStableObjectKey, groupByKeys } from '../../GroupingReport/data/group';

import { aggregations } from './aggregations';

import type { AggregationId } from './aggregations';
import type { ColumnDefinition, TableIssue } from './columns';

/** A single 1D group: its stable key, a display label, and the member issues in it. */
export interface TableGroup {
  /** Stable string key for the group value (from {@link createStableObjectKey}); React key + state. */
  key: string;
  /** Human-readable label for the group header (the grouped-column value, formatted). */
  label: string;
  /** The issues that fall in this group. */
  members: TableIssue[];
}

/** Per-column aggregation overrides, keyed by column id (set from the column's `⋯` menu). */
export type AggregationOverrides = Record<string, AggregationId>;

/** The label shown for an empty / missing group value. */
export const EMPTY_GROUP_LABEL = '(empty)';

/** Format a grouped-column value into a header label. */
export function formatGroupLabel(value: unknown): string {
  if (value == null || value === '') return EMPTY_GROUP_LABEL;
  if (Array.isArray(value)) return value.length === 0 ? EMPTY_GROUP_LABEL : value.map(formatGroupLabel).join(', ');
  if (typeof value === 'object') {
    const named = value as { name?: unknown; value?: unknown };
    if (named.name != null) return String(named.name);
    if (named.value != null) return String(named.value);
  }
  return String(value);
}

/**
 * Group `issues` by `groupColumn`'s value. Uses the shared {@link groupByKeys} engine keyed on
 * `groupColumn.getValue` (via {@link createStableObjectKey} for object values). Groups are returned
 * ordered by label ascending (the {@link EMPTY_GROUP_LABEL} bucket sorts last), which
 * {@link sortGroups} can then re-order.
 */
export function groupIssues(issues: TableIssue[], groupColumn: ColumnDefinition): TableGroup[] {
  const buckets = groupByKeys(issues, [
    { key: groupColumn.id, value: (issue: TableIssue) => groupColumn.getValue(issue) ?? null },
  ]);

  const groups: TableGroup[] = [];
  for (const [key, members] of buckets) {
    groups.push({ key, label: formatGroupLabel(groupColumn.getValue(members[0])), members });
  }

  return orderByLabel(groups);
}

/** Default group ordering: label ascending, with the empty bucket last. */
function orderByLabel(groups: TableGroup[], dir: 'asc' | 'desc' = 'asc'): TableGroup[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...groups].sort((a, b) => {
    const aEmpty = a.label === EMPTY_GROUP_LABEL;
    const bEmpty = b.label === EMPTY_GROUP_LABEL;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    return sign * a.label.localeCompare(b.label);
  });
}

/**
 * The measures are the shown columns automatically minus the identity columns and minus the grouped
 * column(s) (design §7, mockup README "Measures = the columns you're already showing"). No separate
 * picker. In 2D cross-tab BOTH grouped fields (rows + columns) drop out, so this accepts a variadic
 * list of grouped columns and excludes every one of them.
 */
export function selectMeasureColumns(
  columns: ColumnDefinition[],
  ...groupColumns: Array<ColumnDefinition | null>
): ColumnDefinition[] {
  const excluded = new Set(groupColumns.filter((c): c is ColumnDefinition => c != null).map((c) => c.id));
  return columns.filter((c) => !c.isIdentity && !excluded.has(c.id));
}

/**
 * The effective aggregation id for a column: per-column override (from the `⋯` menu) → the column's
 * own `aggregate` → its `defaultAggregate` → `count` as a last resort.
 */
export function effectiveAggregationId(column: ColumnDefinition, override?: AggregationId): AggregationId {
  return override ?? column.aggregate ?? column.defaultAggregate ?? 'count';
}

/**
 * Aggregate one measure column over a group's members using its effective aggregation. By convention
 * the reducer's item is the already-extracted column value, so we map `members` through
 * `column.getValue` before reducing. Returns the raw aggregated value (number | string | string[] |
 * null) — the caller formats it for display.
 */
export function computeMeasureValue(
  column: ColumnDefinition,
  members: TableIssue[],
  override?: AggregationId,
): unknown {
  const id = effectiveAggregationId(column, override);
  const spec = aggregations[id];
  const values = members.map((issue) => column.getValue(issue));
  const result = aggregateGroup(values, [spec.reducer]) as Record<string, unknown>;
  return result[spec.reducer.name];
}

/** Format an aggregated measure value for display in a group-header cell. */
export function formatMeasureValue(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

/** The aggregations that make sense for a column, based on its filter kind / `applicableTo`. */
export function applicableAggregations(column: ColumnDefinition): AggregationId[] {
  const kind = column.filter?.kind;
  return (Object.keys(aggregations) as AggregationId[]).filter((id) => {
    const applicable = aggregations[id].applicableTo;
    if (applicable === '*') return true;
    return kind != null && applicable.includes(kind);
  });
}

/** Group-level ordering spec: by the group label, or by a measure column's aggregated value. */
export type GroupSort = { by: 'label' | 'count' | { columnId: string }; dir: 'asc' | 'desc' };

/**
 * Order the groups themselves (design §4 "a separate control orders the groups"). Supports ordering
 * by label, by member count, or by a measure column's aggregated value (numeric where possible,
 * falling back to a string compare of the formatted value).
 */
export function sortGroups(
  groups: TableGroup[],
  sort: GroupSort | null,
  columns: ColumnDefinition[],
  overrides: AggregationOverrides = {},
): TableGroup[] {
  if (!sort) return groups;
  const sign = sort.dir === 'desc' ? -1 : 1;

  if (sort.by === 'label') return orderByLabel(groups, sort.dir);

  if (sort.by === 'count') {
    return [...groups].sort((a, b) => sign * (a.members.length - b.members.length));
  }

  const by = sort.by;
  const column = columns.find((c) => c.id === by.columnId);
  if (!column) return groups;

  const valueFor = (group: TableGroup) => computeMeasureValue(column, group.members, overrides[column.id]);
  return [...groups].sort((a, b) => {
    const av = valueFor(a);
    const bv = valueFor(b);
    const an = typeof av === 'number' ? av : Number(av);
    const bn = typeof bv === 'number' ? bv : Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) return sign * (an - bn);
    return sign * String(av ?? '').localeCompare(String(bv ?? ''));
  });
}
