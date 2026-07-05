import type { Month, PositionConfig, IssuePosition } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute left/right percentages for an issue on the timeline grid.
 *
 * The issue is anchored by its right edge at the (rounded) due date. `overflowsLeft` is
 * true when the label would extend past the left boundary — the component uses it to flip
 * the label to the right of the marker so it stays in view. Measurement is a parameter
 * (`textWidth`), keeping this pure.
 */
export const calculatePositionPercentages = (config: PositionConfig): IssuePosition => {
  const { roundedDueDate, textWidth, widthOfArea, firstDay, lastDay } = config;

  const totalTime = lastDay.getTime() - firstDay.getTime();
  const dueOffset = roundedDueDate.getTime() - firstDay.getTime();

  const widthInPercent = (textWidth * 100) / widthOfArea;
  const rightPercentEnd = (dueOffset / totalTime) * 100;
  const endPercentFromRight = ((totalTime - dueOffset) / totalTime) * 100;
  const leftPercentStart = rightPercentEnd - widthInPercent;

  return {
    leftPercentStart,
    rightPercentEnd,
    endPercentFromRight,
    widthInPercent,
    overflowsLeft: leftPercentStart < 0,
  };
};

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
