import type { Month } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the left margin (percentage) for the "today" indicator line.
 *
 * A 2-day offset is subtracted for visual centering (matches the legacy `todayMarginLeft`
 * getter). The result may fall outside 0–100 when today is before/after the timeline.
 */
export const calculateTodayMargin = (today: Date, firstDay: Date, lastDay: Date): number => {
  const totalTime = lastDay.getTime() - firstDay.getTime();
  const offset = today.getTime() - firstDay.getTime() - 2 * DAY_MS;
  return (offset / totalTime) * 100;
};

/**
 * Convert month definitions to a CSS Grid `grid-template-columns` string, sized by the
 * number of days in each month (so date positioning stays proportional).
 *
 * Reads `daysInMonth` straight from {@link Month} — it never recomputes days, so it
 * inherits the correct (century-year-safe) value from `computeQuartersAndMonths`.
 */
export const computeGridColumnCSS = (months: Month[]): string => months.map((m) => `${m.daysInMonth}fr`).join(' ');
