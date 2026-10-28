import { getUTCEndDateFromStartDateAndBusinessDays } from '../../../../utils/date/business-days';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calendar days are compared as whole-day numbers since the epoch, because the two sides of every
 * comparison here come from different conventions: `selectedStartDate` is a UTC midnight, while Jira
 * dates are parsed into *local* midnight (`parseDateIntoLocalTimezone`). Comparing raw timestamps
 * would put a Jira date on the wrong side of the plan start for anyone west of UTC.
 */
function utcCalendarDay(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS);
}

function localCalendarDay(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

// 1970-01-01 (day 0) was a Thursday.
function isWeekend(day: number): boolean {
  const dayOfWeek = (((day + 4) % 7) + 7) % 7;
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/** Business days in `[from, to)`, for `from <= to`. */
function businessDaysInRange(from: number, to: number): number {
  const span = to - from;
  let count = Math.floor(span / 7) * 5;
  for (let day = from + Math.floor(span / 7) * 7; day < to; day++) {
    if (!isWeekend(day)) count++;
  }
  return count;
}

/** Signed business days from `planStart` to `day`: how many to skip forward (or back) to reach it. */
function businessDayIndex(planStart: number, day: number): number {
  return day >= planStart ? businessDaysInRange(planStart, day) : 0 - businessDaysInRange(day, planStart);
}

/** Business-day offset of a Jira start date from the plan start. Negative when it is before the plan. */
export function jiraStartDayOffset(planStartDate: Date, jiraStart: Date): number {
  return businessDayIndex(utcCalendarDay(planStartDate), localCalendarDay(jiraStart));
}

/**
 * Business-day offset of the end of a Jira due date. The due date is inclusive, so this is
 * `jiraStartDayOffset(start) + getBusinessDatesCount(start, due)` — the span formula `work-timing.ts`
 * uses — without needing a start date.
 */
export function jiraDueDayOffset(planStartDate: Date, jiraDue: Date): number {
  return businessDayIndex(utcCalendarDay(planStartDate), localCalendarDay(jiraDue) + 1);
}

export type JiraDayOffsets = { startDay: number | null; dueDay: number | null };

export function jiraDayOffsets(
  planStartDate: Date,
  { start, due }: { start?: Date | null; due?: Date | null },
): JiraDayOffsets {
  return {
    startDay: start ? jiraStartDayOffset(planStartDate, start) : null,
    dueDay: due ? jiraDueDayOffset(planStartDate, due) : null,
  };
}

/**
 * The date `businessDays` business days from `planStartDate`. Unlike
 * `getUTCEndDateFromStartDateAndBusinessDays` this handles negative offsets, which a deadline before
 * the plan start produces.
 */
export function businessDayOffsetToDate(planStartDate: Date, businessDays: number): Date {
  if (businessDays >= 0) {
    return getUTCEndDateFromStartDateAndBusinessDays(planStartDate, businessDays);
  }
  const anchor = getUTCEndDateFromStartDateAndBusinessDays(planStartDate, 0);
  let day = utcCalendarDay(anchor);
  let remaining = Math.ceil(-businessDays);
  while (remaining > 0) {
    day--;
    if (!isWeekend(day)) remaining--;
  }
  return new Date(day * DAY_MS);
}
