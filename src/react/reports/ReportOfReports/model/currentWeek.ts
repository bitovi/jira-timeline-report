/**
 * The week a Status Update has to fall in.
 *
 * Monday 00:00 UTC to the following Monday 00:00 UTC, half-open — `start` is in the week, `end` is the
 * next week's Monday. UTC rather than local so every viewer of a shared report agrees on which week a
 * comment belongs to; the cost is that `formatCommentTime` renders local, so a late-Sunday comment in a
 * western timezone shows a Sunday date and counts as the following week.
 * See spec/027-status-updates § Known trade-offs.
 *
 * Pure and clock-free: `weekContaining(Date.now())` is called by the hook, so every test here drives
 * the boundary with an explicit number.
 */

/** Half-open: `start` is in the week, `end` is the next week's Monday. */
export interface WeekWindow {
  start: number;
  end: number;
}

// Exact in UTC, which has no DST — the reason the window is UTC in the first place.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The Monday 00:00 UTC that starts the week containing `time`.
 *
 * A copy of `dateBucketing.ts`'s `startOfWeekUTC`, deliberately: the two live in different report
 * modlets with no shared date module between them, and inventing one to move six lines is more churn
 * than the duplication costs. Worth consolidating the day a third caller appears — not before.
 */
export const startOfWeekUTC = (time: number): number => {
  const date = new Date(time);
  const day = date.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diffToMonday);
};

export const weekContaining = (time: number): WeekWindow => {
  const start = startOfWeekUTC(time);

  return { start, end: start + WEEK_MS };
};

/**
 * Whether a Jira timestamp falls in `week`.
 *
 * `false` for a missing or unparseable timestamp — never a throw, and never a silent `NaN` compare,
 * which would quietly answer `false` anyway but for the wrong reason. A comment whose timestamp Jira
 * can't be read for is not this week's status update.
 */
export const isWithinWeek = (timestamp: string | undefined, week: WeekWindow): boolean => {
  if (!timestamp) {
    return false;
  }

  const time = Date.parse(timestamp);

  return !Number.isNaN(time) && time >= week.start && time < week.end;
};
