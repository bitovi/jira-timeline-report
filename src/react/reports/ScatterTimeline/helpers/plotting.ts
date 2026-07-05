import type { IssueOrRelease, PlottedIssue } from '../types';
import { roundAndShiftDueDate } from '../../../../utils/date/round-and-shift-due-date';
import { calculatePositionPercentages } from './positioning';
import { getStatusColorClass } from './status';

const labelOf = (issue: IssueOrRelease): string => issue.names?.shortVersion || issue.summary;

export interface PlotConfig {
  /** Measured label pixel widths, keyed by label text. */
  widthsByText: Map<string, number>;
  /** `routeData.roundTo` — rounding strategy for due dates. */
  roundTo: string;
  /** Pixels available for plotting (container width minus the group gutter, if any). */
  widthOfArea: number;
  /** Calendar range boundaries. */
  firstDay: Date;
  lastDay: Date;
  /** Density flag (> 20 issues) → smaller markers and text. */
  isLotsOfIssues: boolean;
}

/**
 * Turn filtered issues into positioned {@link PlottedIssue}s against a given calendar range.
 *
 * Pure (measurement is passed in via `widthsByText`), so the component can run it more than
 * once — e.g. a first pass to find the content extent, then a second pass against a trimmed
 * range — without duplicating the mapping logic.
 */
export const computePlottedIssues = (issues: IssueOrRelease[], config: PlotConfig): PlottedIssue[] => {
  const { widthsByText, roundTo, widthOfArea, firstDay, lastDay, isLotsOfIssues } = config;

  return issues.map((issue) => {
    const textWidth = widthsByText.get(labelOf(issue)) ?? 0;
    const positions = calculatePositionPercentages({
      roundedDueDate: roundAndShiftDueDate(issue.rollupStatuses.rollup.due as Date, roundTo),
      textWidth,
      widthOfArea,
      firstDay,
      lastDay,
    });
    return {
      key: issue.key,
      issue,
      ...positions,
      statusColorClass: getStatusColorClass(issue.rollupStatuses.rollup.status),
      textSize: isLotsOfIssues ? 'text-xs' : '',
      markerRadius: isLotsOfIssues ? 6 : 8,
    };
  });
};
