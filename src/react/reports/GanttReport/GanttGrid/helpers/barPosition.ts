import { roundDate } from '../../../../../utils/date/round.js';
import type { AxisRange, BarPosition, Work } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

type DateRounder = (date: Date) => Date;
type RoundStrategy = { start: DateRounder; end: DateRounder };
const roundStrategies = roundDate as Record<string, RoundStrategy>;

// Pure rounding wrappers over the `roundDate` table (src/utils/date/round.js). `roundTo` is a
// PARAM — never read `routeData.roundTo` via `roundDateByRoundToParam`. Unknown keys fall back
// to `day` (identity), matching the scatter rewrite's `roundAndShiftDueDate` fallback. NOTE: no
// `oneDayLater` shift here (that is scatter-only); the Gantt's "+ DAY_MS" lives in the width calc.
const roundDownStart = (d: Date, roundTo: string): Date =>
  (roundStrategies[roundTo]?.start ?? roundStrategies.day.start)(d);
const roundUpEnd = (d: Date, roundTo: string): Date => (roundStrategies[roundTo]?.end ?? roundStrategies.day.end)(d);

/**
 * Convert a `{ start, due }` work window into CSS-grid bar geometry + extension flags.
 *
 * Replaces gantt-grid.js's `getPositionsFromWork`.
 */
export const computeBarPosition = (range: AxisRange, work: Work, roundTo: string): BarPosition => {
  const firstDay = range.firstDay.getTime();
  const lastDay = range.lastDay.getTime();
  const totalTime = lastDay - firstDay;

  const rStart = work.start ? roundDownStart(work.start, roundTo)?.getTime() : null;
  const rDue = work.due ? roundUpEnd(work.due, roundTo)?.getTime() : null;

  if (rStart == null && rDue == null) {
    return {
      isEmpty: true,
      startExtends: false,
      endExtends: false,
      endIsBeforeFirstDay: false,
      startIsAfterLastDay: false,
      widthPercent: 0,
      marginLeftPercent: 0,
    };
  }
  const start = Math.max(firstDay, rStart ?? firstDay);
  const end = Math.min(lastDay, rDue ?? lastDay);
  return {
    isEmpty: false,
    startExtends: (rStart ?? firstDay) < firstDay,
    endExtends: (rDue ?? lastDay) > lastDay,
    endIsBeforeFirstDay: rDue != null && rDue <= firstDay,
    startIsAfterLastDay: rStart != null && rStart >= lastDay,
    widthPercent: Math.max(((end + DAY_MS - start) / totalTime) * 100, 0),
    marginLeftPercent: ((start - firstDay) / totalTime) * 100, // component applies max(_, 1px)
  };
};
