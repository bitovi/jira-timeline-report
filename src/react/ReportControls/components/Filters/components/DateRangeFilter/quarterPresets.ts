/**
 * Pure quarter-window math for the Scatter Plot's "Due date range" preset chips
 * (This quarter / This and next quarter).
 */

export interface QuarterPreset {
  label: string;
  from: string;
  to: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Format a local `Date` as an ISO `YYYY-MM-DD` string (no timezone conversion). */
const toIsoDateString = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Compute the `[from, to]` ISO window covering `quarterSpan` quarters, starting
 * `quartersAhead` quarters from `now`'s current quarter (0 = this quarter, 1 = next quarter, ...).
 */
const getQuarterWindow = (now: Date, quartersAhead: number, quarterSpan: number): { from: string; to: string } => {
  const currentQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const startMonth = currentQuarterStartMonth + quartersAhead * 3;
  const start = new Date(now.getFullYear(), startMonth, 1);
  const end = new Date(now.getFullYear(), startMonth + quarterSpan * 3, 0);
  return { from: toIsoDateString(start), to: toIsoDateString(end) };
};

/** The Scatter Plot "Due date range" preset chips, computed relative to `now`. */
export const getDateRangePresets = (now: Date = new Date()): QuarterPreset[] => [
  { label: 'This quarter', ...getQuarterWindow(now, 0, 1) },
  { label: 'This and next quarter', ...getQuarterWindow(now, 0, 2) },
];
