/**
 * Date display formats for the Table report's date columns (spec/044-planning-health-mvp §2).
 *
 * A date column shows either the date itself (`'date'`, the default) or how far it is from today
 * (`'relative'`, labelled "How far out" in the column menu). The distance counts whole LOCAL calendar
 * days, so a DST change or the hour of day never moves a date into the next bucket.
 */

export type DateFormat = 'date' | 'relative';

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  date: 'Date',
  relative: 'How far out',
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Coerce a date-ish value (Date | epoch number | parseable string) to a Date, or null. A bare
 * `YYYY-MM-DD` string is read as local midnight; `Date.parse` would read it as UTC midnight, which
 * is the previous day anywhere west of UTC.
 */
function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isNaN(value) ? null : new Date(value);
  const text = String(value);
  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

/** Whole local calendar days from `from` to `to` (negative when `to` is earlier). */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Calendar months from `from` to `to`, with the day-of-month difference as a fraction. */
function calendarMonthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return months + (to.getDate() - from.getDate()) / 30.44;
}

function plural(count: number, unit: string, past: boolean): string {
  return `${count} ${unit}${count === 1 ? '' : 's'} ${past ? 'ago' : 'out'}`;
}

/**
 * How far `value` is from `today`: `Today`, `N days out` (under 14 days), `N weeks out` (under 8
 * weeks), `N months out` (under 24 months), then `N years out`. Past dates read `… ago`. Weeks and
 * months round to the nearest whole unit; the thresholds apply to the rounded value. Returns `''`
 * for a missing or unparseable value.
 */
export function formatHowFarOut(value: unknown, today: Date): string {
  const date = toDate(value);
  if (!date) return '';
  const days = calendarDaysBetween(today, date);
  if (days === 0) return 'Today';
  const past = days < 0;
  const absDays = Math.abs(days);
  if (absDays < 14) return plural(absDays, 'day', past);
  const weeks = Math.round(absDays / 7);
  if (weeks < 8) return plural(weeks, 'week', past);
  const months = Math.round(Math.abs(calendarMonthsBetween(today, date)));
  if (months < 24) return plural(months, 'month', past);
  return plural(Math.round(months / 12), 'year', past);
}

/**
 * Format a date-ish value as `YYYY-MM-DD` (the `'date'` format). Unchanged from the original date
 * cell: strings go through `Date.parse` and the result is printed in UTC (see the spec's
 * possible-off-by-one follow-up).
 */
export function formatIsoDate(value: unknown): string {
  if (value == null) return '';
  const time = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isNaN(time) ? '' : new Date(time).toISOString().slice(0, 10);
}

/** Format a date-ish value in the given {@link DateFormat}. `today` defaults to now. */
export function formatDateValue(value: unknown, format: DateFormat | undefined, today: Date = new Date()): string {
  return format === 'relative' ? formatHowFarOut(value, today) : formatIsoDate(value);
}
