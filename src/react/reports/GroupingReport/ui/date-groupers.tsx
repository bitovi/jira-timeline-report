import React from 'react';
import type { Grouper } from './grouper';
import type { LinkedIssue } from '../jira/linked-issue/linked-issue';

/**
 * Date range groupers for grouping issues by time periods.
 * All groupers use the 'timeRange' key and work with DateRangeGroupValue.
 */

export type DateRangeGroupValue = { start: string; end: string };

// Legacy type aliases for backward compatibility
export type YearQuarterGroupValue = DateRangeGroupValue;
export type YearMonthGroupValue = DateRangeGroupValue;

/**
 * Grouper for grouping by calendar quarter (e.g., {start: '2023-01-01', end: '2023-03-31'}).
 * Expects items with a `derivedTiming.due: Date` property (e.g., LinkedIssue).
 */
export const dueInQuarterGrouper: Grouper<LinkedIssue, DateRangeGroupValue, 'timeRange'> = {
  name: 'quarter',
  label: 'Quarter',
  groupByKey: {
    key: 'timeRange',
    value: (item) => {
      const due = item.derivedTiming.due;
      return due ? getYearQuarterRange(due) : { start: '', end: '' };
    },
  } as const,
  sort: sortDateRanges,
  fillGaps: (yearQuarters: DateRangeGroupValue[]) => {
    if (yearQuarters.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = hasNoDatesGroup(yearQuarters);

    const firstValidIndex = yearQuarters.findIndex((q) => q.start && q.end);
    const lastValidIndex = yearQuarters.findLastIndex((q) => q.start && q.end);

    if (firstValidIndex === -1 || lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }

    const startQuarter = yearQuarters[firstValidIndex];
    const endQuarter = yearQuarters[lastValidIndex];

    // Fill quarters without filtering past quarters
    const filled = fillQuarterGaps(startQuarter, endQuarter, false);

    // Add "no dates" group at the end if it was present in the original data
    appendNoDatesIfNeeded(filled, hasNoDates);

    return filled;
  },
  titles: (yearQuarters: DateRangeGroupValue[]) => {
    if (yearQuarters.length === 0) return [];
    const titles: string[] = [];
    let currentYear = '';

    for (const yearQuarter of yearQuarters) {
      if (!yearQuarter.start || !yearQuarter.end) {
        titles.push('Missing dates');
        continue;
      }

      const startDate = new Date(yearQuarter.start);
      const year = startDate.getUTCFullYear().toString();
      const quarter = Math.floor(startDate.getUTCMonth() / 3) + 1;

      if (year !== currentYear) {
        titles.push(`${year} Q${quarter}`);
        currentYear = year;
      } else {
        titles.push(`Q${quarter}`);
      }
    }
    return titles;
  },
};

/**
 * Grouper for grouping by the specific month containing the due date.
 * Expects items with a `derivedTiming.due: Date` property (e.g., LinkedIssue).
 */
export const dueInMonthGrouper: Grouper<LinkedIssue, DateRangeGroupValue, 'timeRange'> = {
  name: 'dueMonth',
  label: 'Due Month',
  groupByKey: {
    key: 'timeRange',
    value: (item) => {
      const due = item.derivedTiming.due;
      return due ? getYearMonthRange(due) : { start: '', end: '' };
    },
  } as const,
  sort: sortDateRanges,
  fillGaps: (yearMonths: DateRangeGroupValue[]) => {
    if (yearMonths.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = hasNoDatesGroup(yearMonths);

    const firstValidIndex = yearMonths.findIndex((m) => m.start && m.end);
    const lastValidIndex = yearMonths.findLastIndex((m) => m.start && m.end);

    if (firstValidIndex === -1 || lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }

    const startMonth = yearMonths[firstValidIndex];
    const endMonth = yearMonths[lastValidIndex];

    // Fill months with past filtering enabled
    const filled = fillMonthGaps(startMonth, endMonth, true);

    // Add "no dates" group at the end if it was present in the original data
    appendNoDatesIfNeeded(filled, hasNoDates);

    return filled;
  },
  titles: (values) => {
    return values.map((v) => {
      // returns the year and month name like "2025 Jul"
      if (!v.start || !v.end) {
        return <span>Missing dates</span>;
      } else {
        const startDate = new Date(v.start);
        const yearMonth = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
        }).format(startDate);
        return <span>{yearMonth}</span>;
      }
    });
  },
};

export const intersectMonthGrouper: Grouper<LinkedIssue, DateRangeGroupValue, 'timeRange'> = {
  name: 'yearMonth',
  label: 'Month',
  groupByKey: {
    key: 'timeRange',
    value: (item) => {
      const start = item.derivedTiming.start;
      const due = item.derivedTiming.due;
      if (!start || !due) {
        return { start: '', end: '' };
      } else {
        // make an array of every month between start and due
        return getMonthsBetweenInclusive(start, due).map((date) => {
          return getYearMonthRange(date);
        });
      }
    },
  } as const,
  sort: sortDateRanges,
  fillGaps: (groupValues) => {
    if (groupValues.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = hasNoDatesGroup(groupValues);

    // walk backwards to find the last groupValue that isn't empty...
    const lastValidIndex = groupValues.findLastIndex((v) => v.start && v.end);
    if (lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }
    const endValue = groupValues[lastValidIndex];
    if (!endValue.start || !endValue.end) {
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }

    const startValue = groupValues[0];
    if (!startValue.start || !startValue.end) {
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }

    // Fill months with past filtering enabled
    const filled = fillMonthGaps(startValue, endValue, true);

    // Add "no dates" group at the end if it was present in the original data
    appendNoDatesIfNeeded(filled, hasNoDates);

    return filled;
  },
  titles: (values) => {
    return values.map((v) => {
      // returns the year and month name like "2023 Jan"
      if (!v.start || !v.end) {
        return <span>Missing dates</span>;
      } else {
        const startDate = new Date(v.start);
        const yearMonth = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
        }).format(startDate);
        return <span>{yearMonth}</span>;
      }
    });
  },
};

export const intersectQuarterGrouper: Grouper<LinkedIssue, DateRangeGroupValue, 'timeRange'> = {
  name: 'yearQuarter',
  label: 'Quarter',
  groupByKey: {
    key: 'timeRange',
    value: (item) => {
      const start = item.derivedTiming.start;
      const due = item.derivedTiming.due;
      if (!start || !due) {
        return { start: '', end: '' };
      } else {
        // make an array of every quarter between start and due
        return getQuartersBetweenInclusive(start, due).map((date: Date) => {
          return getYearQuarterRange(date);
        });
      }
    },
  } as const,
  sort: sortDateRanges,
  fillGaps: (groupValues) => {
    if (groupValues.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = hasNoDatesGroup(groupValues);

    // walk backwards to find the last groupValue that isn't empty...
    const lastValidIndex = groupValues.findLastIndex((v) => v.start && v.end);
    if (lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }
    const endValue = groupValues[lastValidIndex];
    if (!endValue.start || !endValue.end) {
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }

    const startValue = groupValues[0];
    if (!startValue.start || !startValue.end) {
      return hasNoDates ? [createNoDatesGroup() as DateRangeGroupValue] : [];
    }

    // Fill quarters with filtering for past quarters
    const filled = fillQuarterGaps(startValue, endValue, true);

    // Add "no dates" group at the end if it was present in the original data
    appendNoDatesIfNeeded(filled, hasNoDates);

    return filled;
  },
  titles: (values) => {
    return values.map((v) => {
      // returns the year and quarter like "2023 Q1"
      if (!v.start || !v.end) {
        return <span>Missing dates</span>;
      } else {
        const startDate = new Date(v.start);
        const year = startDate.getUTCFullYear();
        const quarter = Math.floor(startDate.getUTCMonth() / 3) + 1;
        return (
          <span>
            {year} Q{quarter}
          </span>
        );
      }
    });
  },
};

// Utility functions for date range calculations

/**
 * Shared sort function for date range groupers.
 * Sorts date ranges by start date, putting empty dates at the end.
 */
export function sortDateRanges(a: DateRangeGroupValue, b: DateRangeGroupValue): number {
  if (a.start === b.start && a.end === b.end) return 0;
  if (!a.start || !a.end) return 1; // Put empty dates last
  if (!b.start || !b.end) return -1;
  return a.start.localeCompare(b.start);
}

/**
 * Checks if a date range array contains "no dates" entries.
 */
export function hasNoDatesGroup(dateRanges: DateRangeGroupValue[]): boolean {
  return dateRanges.some((item) => !item.start || !item.end);
}

/**
 * Returns an empty date range object for "no dates" groups.
 */
export function createNoDatesGroup(): DateRangeGroupValue {
  return { start: '', end: '' };
}

/**
 * Adds a "no dates" group to the end of an array if needed.
 */
export function appendNoDatesIfNeeded<T extends DateRangeGroupValue>(filled: T[], hasNoDates: boolean): void {
  if (hasNoDates) {
    filled.push(createNoDatesGroup() as T);
  }
}

/**
 * Shared function to fill quarter gaps between start and end quarters.
 * @param startQuarter - The starting quarter range
 * @param endQuarter - The ending quarter range
 * @param filterPastQuarters - Whether to filter out quarters in the past
 * @returns Array of filled quarter ranges
 */
export function fillQuarterGaps(
  startQuarter: DateRangeGroupValue,
  endQuarter: DateRangeGroupValue,
  filterPastQuarters: boolean = false,
): DateRangeGroupValue[] {
  const filled: DateRangeGroupValue[] = [];

  const startDate = new Date(startQuarter.start);
  const endDate = new Date(endQuarter.start);

  const startYear = startDate.getUTCFullYear();
  const startQ = Math.floor(startDate.getUTCMonth() / 3) + 1;
  const endYear = endDate.getUTCFullYear();
  const endQ = Math.floor(endDate.getUTCMonth() / 3) + 1;

  for (let year = startYear; year <= endYear; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      if (year === startYear && quarter < startQ) continue;
      if (year === endYear && quarter > endQ) continue;

      const quarterRange = getYearQuarterRangeFromYearQuarter(year, quarter);

      if (filterPastQuarters) {
        // filter out any quarters in the past
        const now = new Date();
        const currentQuarter = Math.floor(now.getUTCMonth() / 3) + 1;
        const currentYear = now.getUTCFullYear();
        if (year > currentYear || (year === currentYear && quarter >= currentQuarter)) {
          filled.push(quarterRange);
        }
      } else {
        filled.push(quarterRange);
      }
    }
  }

  return filled;
}

/**
 * Shared function to fill gaps between start and end months with configurable past filtering
 */
export function fillMonthGaps(
  startMonth: DateRangeGroupValue,
  endMonth: DateRangeGroupValue,
  filterPastMonths: boolean = false,
): DateRangeGroupValue[] {
  const filled: DateRangeGroupValue[] = [];

  const startDate = new Date(startMonth.start);
  const endDate = new Date(endMonth.start);

  let current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const endMonthNum = endDate.getUTCMonth();
  const endYear = endDate.getUTCFullYear();

  while (
    current.getUTCFullYear() < endYear ||
    (current.getUTCFullYear() === endYear && current.getUTCMonth() <= endMonthNum)
  ) {
    const monthRange = getYearMonthRange(current);

    if (filterPastMonths) {
      // filter out any months in the past
      const now = new Date();
      const currentMonth = current.getUTCMonth() + 1;
      const currentYear = current.getUTCFullYear();
      if (
        currentYear > now.getUTCFullYear() ||
        (currentYear === now.getUTCFullYear() && currentMonth >= now.getUTCMonth() + 1)
      ) {
        filled.push(monthRange);
      }
    } else {
      filled.push(monthRange);
    }

    // Move to next month
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return filled;
}

/**
 * Returns an array of Date objects representing the first day of each month between start and end, inclusive.
 * Both start and end are included, and the returned Dates are set to the first of the month (UTC).
 */
export function getMonthsBetweenInclusive(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  if (!start || !end) return months;
  // Clone and set to first of month UTC
  let current = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = end.getUTCMonth();
  const endYear = end.getUTCFullYear();
  while (
    current.getUTCFullYear() < endYear ||
    (current.getUTCFullYear() === endYear && current.getUTCMonth() <= endMonth)
  ) {
    months.push(new Date(current));
    // Move to next month
    current.setUTCMonth(current.getUTCMonth() + 1);
  }
  return months;
}

/**
 * Returns an array of Date objects representing the first day of each quarter between start and end, inclusive.
 * Both start and end are included, and the returned Dates are set to the first of the quarter (UTC).
 */
export function getQuartersBetweenInclusive(start: Date, end: Date): Date[] {
  const quarters: Date[] = [];
  if (!start || !end) return quarters;

  // Get the start quarter and year
  const startYear = start.getUTCFullYear();
  const startQuarter = Math.floor(start.getUTCMonth() / 3) + 1;

  // Get the end quarter and year
  const endYear = end.getUTCFullYear();
  const endQuarter = Math.floor(end.getUTCMonth() / 3) + 1;

  // Generate quarters from start to end
  for (let year = startYear; year <= endYear; year++) {
    const firstQuarter = year === startYear ? startQuarter : 1;
    const lastQuarter = year === endYear ? endQuarter : 4;

    for (let quarter = firstQuarter; quarter <= lastQuarter; quarter++) {
      // First month of the quarter (0-based)
      const quarterMonth = (quarter - 1) * 3;
      quarters.push(new Date(Date.UTC(year, quarterMonth, 1)));
    }
  }

  return quarters;
}

/**
 * Returns the year and the month like {year: 2023, month: 1} for the given Date (UTC).
 */
export function getYearMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // getUTCMonth() is zero-based
  return { year, month };
}

/**
 * Returns a month range with start and end date strings for the given Date (UTC).
 * The start is the first day of the month, the end is the last day of the month.
 */
export function getYearMonthRange(date: Date): DateRangeGroupValue {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-based

  // First day of the month
  const start = new Date(Date.UTC(year, month, 1));
  // Last day of the month (first day of next month minus 1 day)
  const end = new Date(Date.UTC(year, month + 1, 0));

  return {
    start: start.toISOString().split('T')[0], // YYYY-MM-DD format
    end: end.toISOString().split('T')[0], // YYYY-MM-DD format
  };
}

/**
 * Returns a quarter range with start and end date strings for the given Date (UTC).
 * The start is the first day of the quarter, the end is the last day of the quarter.
 */
export function getYearQuarterRange(date: Date): DateRangeGroupValue {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;

  // First day of the quarter
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));

  // Last day of the quarter
  const endMonth = quarter * 3;
  const end = new Date(Date.UTC(year, endMonth, 0)); // Last day of the last month in quarter

  return {
    start: start.toISOString().split('T')[0], // YYYY-MM-DD format
    end: end.toISOString().split('T')[0], // YYYY-MM-DD format
  };
}

/**
 * Returns a quarter range for a specific year and quarter number.
 */
export function getYearQuarterRangeFromYearQuarter(year: number, quarter: number): DateRangeGroupValue {
  // First day of the quarter
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));

  // Last day of the quarter
  const endMonth = quarter * 3;
  const end = new Date(Date.UTC(year, endMonth, 0)); // Last day of the last month in quarter

  return {
    start: start.toISOString().split('T')[0], // YYYY-MM-DD format
    end: end.toISOString().split('T')[0], // YYYY-MM-DD format
  };
}
