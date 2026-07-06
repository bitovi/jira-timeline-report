import { roundDate } from './round.js';
import { oneDayLater } from './date-helpers.js';

type DateRounder = (date: Date) => Date;
type RoundStrategy = { start: DateRounder; end: DateRounder };
const roundStrategies = roundDate as Record<string, RoundStrategy>;

/**
 * Apply a rounding strategy to a due date and shift it one day later.
 *
 * Due dates are displayed as "due at end of day", so after rounding we add one calendar
 * day via {@link oneDayLater} (which uses `setDate`, avoiding DST drift).
 *
 * Composes the low-level {@link roundDate} table (keyed by strategy string) — NOT
 * `roundDateByRoundToParam`, which reads the global `routeData.roundTo` and is not keyed by
 * a string. Passing `roundTo` in as a parameter keeps this function pure. Unknown keys fall
 * back to `day` (identity rounding).
 */
export const roundAndShiftDueDate = (dueDate: Date, roundTo: string): Date => {
  const rounder = roundStrategies[roundTo]?.end ?? roundStrategies.day.end;
  return oneDayLater(rounder(dueDate));
};
