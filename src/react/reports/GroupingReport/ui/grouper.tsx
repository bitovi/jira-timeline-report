import React from 'react';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { WithRollups } from '../../../../jira/rolledup-and-rolledback/rollup-and-rollback';
import type { GroupByKey } from '../data/group';

export type RolledUpIssue = DerivedIssue & WithRollups;

export interface Grouper<Issue = any, GroupValueType = any, Key extends string = string> {
  /** Unique name/id for this grouping */
  name: string;
  /** Human-readable label for UI */
  label: string;
  /**
   * GroupByKey object that defines how to extract group values from items.
   * If an item belongs to multiple groups, the value function can return an array of group values.
   */
  groupByKey: GroupByKey<Issue, GroupValueType, Key>;
  /** Sorts the group keys (for columns/rows) */
  sort?: (a: GroupValueType, b: GroupValueType) => number;
  /** Fills in missing keys for display (e.g., fill missing quarters) */
  fillGaps?: (keys: GroupValueType[]) => GroupValueType[];
  /** Returns display titles for the group values (e.g., '2023 Q1', 'Q2', ... or parent summaries). Can return strings or JSX. */
  titles: (values: GroupValueType[]) => Array<string | React.ReactNode>;
  /** If true, this grouping is a "single column" (e.g., 'All Issues') */
  singleColumn?: boolean;
  /** If true, this grouping is a "multi-column" (e.g., time, status, etc) */
  multiColumn?: boolean;
  /** Optional: custom cell renderer for this grouping */
  renderCell?: (groupKey: string, items: Issue[]) => React.ReactNode;
}

/**
 * Grouper for grouping by calendar quarter (e.g., '2023-Q1').
 * Expects items with a `rollupDates.due: Date` property (e.g., RolledUpIssue).
 */
export const quarterGrouper: Grouper<RolledUpIssue, string, 'yearQuarter'> = {
  name: 'quarter',
  label: 'Quarter',
  groupByKey: {
    key: 'yearQuarter',
    value: (item) => {
      const due = item?.rollupDates?.due;
      return due ? getYearQuarter(due) : 'no-dates';
    },
  } as const,
  sort: (a: string, b: string) => {
    if (a === b) return 0;
    if (a === 'no-dates') return 1; // Put 'no-dates' last
    if (b === 'no-dates') return -1;
    const [aYear, aQ] = a.split('-Q');
    const [bYear, bQ] = b.split('-Q');
    const yearDiff = Number(aYear) - Number(bYear);
    if (yearDiff !== 0) return yearDiff;
    return Number(aQ) - Number(bQ);
  },
  fillGaps: (yearQuarters: string[]) => {
    if (yearQuarters.length === 0) return [];
    const filled: string[] = [];
    const [startYear, startQuarter] = yearQuarters[0].split('-Q').map(Number);
    const [endYear, endQuarter] = yearQuarters[yearQuarters.length - 1].split('-Q').map(Number);
    for (let year = startYear; year <= endYear; year++) {
      for (let quarter = 1; quarter <= 4; quarter++) {
        if (year === startYear && quarter < startQuarter) continue;
        if (year === endYear && quarter > endQuarter) continue;
        filled.push(`${year}-Q${quarter}`);
      }
    }
    return filled;
  },
  titles: (yearQuarters: (string | null)[]) => {
    const filtered = yearQuarters.filter((q): q is string => q !== null);
    if (filtered.length === 0) return [];
    const titles: string[] = [];
    let currentYear = '';
    for (const yearQuarter of filtered) {
      const [year, quarter] = yearQuarter.split('-Q');
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
 * Helper to get a 'YYYY-QN' string from a Date.
 */
function getYearQuarter(date: Date): string {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

/**
 * Grouper for grouping by parent key, but displaying the parent summary as the title.
 * Expects items with `issue.fields?.Parent?.key` and `issue.fields?.Parent?.fields?.summary`.
 */

type ParentGroupValue = { key: string; summary: string; url: string };
export const parentGrouper: Grouper<RolledUpIssue, ParentGroupValue, 'parent'> = {
  name: 'parent',
  label: 'Parent',
  groupByKey: {
    key: 'parent',
    value: (item) => {
      const parentKey = item?.issue?.fields?.Parent?.key || 'no-parent';
      const summary = item?.issue?.fields?.Parent?.fields?.summary || 'No Parent';
      return { key: parentKey, summary, url: replaceIssueKeyInUrl(item.url, parentKey) };
    },
  } as const,
  sort: (a: ParentGroupValue, b: ParentGroupValue) => {
    if (a.summary === b.summary) return 0;
    if (a.summary === 'no-parent') return 1; // Put 'No Parent' last
    if (b.summary === 'no-parent') return -1;
    return a.summary.localeCompare(b.summary, undefined, { sensitivity: 'base' });
  },
  titles: (values) => {
    return values.map((v) => {
      return (
        <a href={v.url} target="_blank" rel="noopener noreferrer">
          {v.summary}
        </a>
      );
    });
  },
};

// given a url like https://bitovi-training.atlassian.net/browse/SUNNYSUSHI-2,
// and a key like FOO-123, returns https://bitovi-training.atlassian.net/browse/FOO-123
export function replaceIssueKeyInUrl(url: string, key: string): string {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  pathParts[pathParts.length - 1] = key;
  urlObj.pathname = pathParts.join('/');
  return urlObj.toString();
}

export const groupByProjectKey = {
  key: 'projectKey',
  value: (item: RolledUpIssue) => {
    // returns an array of objects like {yearMonth: '2023-01', key: 'PROJECT-123'}
    return item.projectKey;
  },
} as const;

export const projectKeyGrouper: Grouper<RolledUpIssue, string, 'projectKey'> = {
  name: 'projectKey',
  label: 'Project',
  groupByKey: groupByProjectKey,
  sort: (a, b) => {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  },
  titles: (values) => {
    return values.map((projectKey) => {
      return <span>{projectKey}</span>;
    });
  },
};

export type YearMonthGroupValue = { year: number; month: number };
export const monthGrouper: Grouper<RolledUpIssue, YearMonthGroupValue, 'yearMonth'> = {
  name: 'yearMonth',
  label: 'Month',
  groupByKey: {
    key: 'yearMonth',
    value: (item) => {
      const start = item.rollupDates.start;
      const due = item.rollupDates.due;
      if (!start || !due) {
        return { year: -1, month: -1 };
      } else {
        // make an array of every month between start and due
        return getMonthsBetweenInclusive(start, due).map((date) => {
          return getYearMonth(date);
        });
      }
    },
  } as const,
  sort: (a, b) => {
    if (a.year === b.year) {
      return a.month - b.month; // Sort by month if years are the same
    }
    return a.year - b.year; // Sort by year otherwise
  },
  fillGaps: (groupValues) => {
    if (groupValues.length === 0) return [];
    const filled: YearMonthGroupValue[] = [];
    const startYear = groupValues[0].year;
    const startMonth = groupValues[0].month;
    const endYear = groupValues[groupValues.length - 1].year;
    const endMonth = groupValues[groupValues.length - 1].month;
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        if (year === startYear && month < startMonth) continue;
        if (year === endYear && month > endMonth) continue;
        filled.push({ year, month });
      }
    }
    return filled;
  }, // No gaps to fill for parent keys
  titles: (values) => {
    return values.map((v) => {
      return (
        <span>
          {v.year} {v.month}
        </span>
      );
    });
  },
};

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
 * Returns the year and the month like {year: 2023, month: 1} for the given Date (UTC).
 */
export function getYearMonth(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // getUTCMonth() is zero-based
  return { year, month };
}
