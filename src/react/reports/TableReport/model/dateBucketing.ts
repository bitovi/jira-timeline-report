/**
 * Date-bucket grouping for the Table report (spec/012-table-and-grouper, date-bucket-grouping).
 *
 * `groupIssues` (1D) and the cross-tab (`getAxisValues` / `buildGrid`) both key on a column's exact
 * `getValue(issue)` result. For a date/datetime column that's a full timestamp, so grouping by e.g.
 * "Due Date" produces one group per distinct instant rather than a useful bucket. Rather than teach
 * those generic engines about dates, {@link bucketedDateColumn} wraps a date column into a new
 * `ColumnDefinition` whose `getValue` returns a bucket LABEL STRING (e.g. `"2024-07"` for Month)
 * instead of the raw date — so grouping/cross-tab code needs no changes.
 *
 * Every label is a zero-padded, ISO-ish string chosen so plain string comparison already sorts
 * chronologically (no dedicated date-aware sort mode needed for "Order groups: Label").
 */
import type { ColumnDefinition } from './columns';

export type DateGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export const DATE_GRANULARITIES: DateGranularity[] = ['day', 'week', 'month', 'quarter', 'year'];

export const DATE_GRANULARITY_LABELS: Record<DateGranularity, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

/** Coerce a date-ish value (Date | epoch number | parseable string) to epoch ms, or null. */
function toTime(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** The Monday (UTC) that starts the week containing `time`. */
function startOfWeekUTC(time: number): number {
  const date = new Date(time);
  const day = date.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diffToMonday);
  return monday;
}

/**
 * Bucket a date-ish value into a sortable label string for `granularity`, or `null` when the value
 * is missing/unparseable (callers fall back to the existing {@link EMPTY_GROUP_LABEL} bucket).
 */
export function bucketDateValue(value: unknown, granularity: DateGranularity): string | null {
  const time = toTime(value);
  if (time == null) return null;
  const date = new Date(time);

  switch (granularity) {
    case 'day':
      return isoDate(time);
    case 'week':
      return isoDate(startOfWeekUTC(time));
    case 'month':
      return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
    case 'quarter':
      return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    case 'year':
      return String(date.getUTCFullYear());
    default:
      return isoDate(time);
  }
}

/**
 * Wrap a date/datetime column so grouping/cross-tab code sees bucket labels instead of raw dates.
 * `getValue`/`render` both return the label string; `compare` stays a plain string compare (labels
 * already sort chronologically). The wrapped column's own `id` is unchanged (so persistence/lookup
 * by catalog id is unaffected) but `label` gets the granularity suffix for display in the group
 * header / dropdown trigger. Returns the widened `ColumnDefinition` (not `<string | null>`) so it
 * drops straight into the same `ColumnDefinition[]`/`ColumnDefinition` slots as any other column.
 */
export function bucketedDateColumn(column: ColumnDefinition, granularity: DateGranularity): ColumnDefinition {
  const bucketed: ColumnDefinition<string | null> = {
    ...column,
    label: `${column.label} (${DATE_GRANULARITY_LABELS[granularity]})`,
    getValue: (issue) => bucketDateValue(column.getValue(issue), granularity),
    render: (value) => value ?? '',
    compare: (a, b) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return a.localeCompare(b);
    },
  };
  return bucketed as ColumnDefinition;
}
