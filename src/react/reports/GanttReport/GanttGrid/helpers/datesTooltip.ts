import { daysBetween } from '../../../../../utils/date/days-between';
import { timeRangeShorthand } from '../../../../../utils/date/time-range-shorthand';
import type { DatesTooltipData, IssueOrRelease, RollupStatus } from '../types';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Format a date, appending a signed `+/-<shorthand>` diff against the prior period's date when
 * the two differ.
 *
 * Ports gantt-grid.js's `makeDateAndDiff`.
 */
export const formatDateAndDiff = (date?: Date | null, lastDate?: Date | null): string | undefined => {
  if (!date) return undefined;
  let result = dateFormatter.format(date);
  if (lastDate) {
    const days = daysBetween(date, lastDate);
    if (days !== 0) {
      result += ' ' + (days >= 0 ? '+' : '-') + timeRangeShorthand((days >= 0 ? 1 : -1) * days);
    }
  }
  return result;
};

/**
 * The three pills shown on bar hover — pure data, rendered by the tooltip component.
 *
 * Ports gantt-grid.js's `datesTooltipStache` + `makeDateAndDiff`.
 */
export const buildDatesTooltip = (issue: IssueOrRelease): DatesTooltipData => {
  const { start, due } = issue.rollupDates;
  const last = issue.issueLastPeriod?.rollupDates;
  return {
    startPill: formatDateAndDiff(start, last?.start),
    endPill: formatDateAndDiff(due, last?.due),
    durationPill: start && due ? timeRangeShorthand(daysBetween(due, start)) : undefined,
  };
};

/** Human-readable label for a work-type key shown in the breakdown segment tooltip. */
const workTypeLabel = (type: string): string =>
  type === 'qa' || type === 'uat' ? type.toUpperCase() : type.charAt(0).toUpperCase() + type.slice(1);

/**
 * The pills for a single work-type segment bar (dev/qa/uat/design) in breakdown mode — using that
 * work type's own start/due/last-period dates rather than the issue's overall rollup, so hovering a
 * specific segment shows that segment's timing. Prepends a label pill naming the work type.
 */
export const buildWorkDatesTooltip = (type: string, work: RollupStatus): DatesTooltipData => {
  const { start, due, lastPeriod } = work;
  return {
    labelPill: workTypeLabel(type),
    startPill: formatDateAndDiff(start, lastPeriod?.start),
    endPill: formatDateAndDiff(due, lastPeriod?.due),
    durationPill: start && due ? timeRangeShorthand(daysBetween(due, start)) : undefined,
  };
};
