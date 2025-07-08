import React from 'react';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { WithRollups } from '../../../../jira/rolledup-and-rolledback/rollup-and-rollback';
import type { GroupByKey } from '../data/group';

import type { LinkedIssue } from '../jira/linked-issue/linked-issue';

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
 * Grouper for grouping by calendar quarter (e.g., {start: '2023-01-01', end: '2023-03-31'}).
 * Expects items with a `rollupDates.due: Date` property (e.g., LinkedIssue).
 */
export type YearQuarterGroupValue = { start: string; end: string };
export const dueInQuarterGrouper: Grouper<LinkedIssue, YearQuarterGroupValue, 'timeRange'> = {
  name: 'quarter',
  label: 'Quarter',
  groupByKey: {
    key: 'timeRange',
    value: (item) => {
      const due = item.derivedTiming.due;
      return due ? getYearQuarterRange(due) : { start: '', end: '' };
    },
  } as const,
  sort: (a: YearQuarterGroupValue, b: YearQuarterGroupValue) => {
    if (a.start === b.start && a.end === b.end) return 0;
    if (!a.start || !a.end) return 1; // Put empty dates last
    if (!b.start || !b.end) return -1;
    return a.start.localeCompare(b.start);
  },
  fillGaps: (yearQuarters: YearQuarterGroupValue[]) => {
    if (yearQuarters.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = yearQuarters.some((q) => !q.start || !q.end);

    const filled: YearQuarterGroupValue[] = [];

    const firstValidIndex = yearQuarters.findIndex((q) => q.start && q.end);
    const lastValidIndex = yearQuarters.findLastIndex((q) => q.start && q.end);

    if (firstValidIndex === -1 || lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }

    const startQuarter = yearQuarters[firstValidIndex];
    const endQuarter = yearQuarters[lastValidIndex];

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
        filled.push(getYearQuarterRangeFromYearQuarter(year, quarter));
      }
    }

    // Add "no dates" group at the end if it was present in the original data
    if (hasNoDates) {
      filled.push({ start: '', end: '' });
    }

    return filled;
  },
  titles: (yearQuarters: YearQuarterGroupValue[]) => {
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
 * Grouper for grouping by parent key, but displaying the parent summary as the title.
 * Expects items with `issue.fields?.Parent?.key` and `issue.fields?.Parent?.fields?.summary`.
 */

type ParentGroupValue = { key: string; summary: string; url: string };
export const parentGrouper: Grouper<LinkedIssue, ParentGroupValue, 'parent'> = {
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

export function makeLinkGrouper(linkType: string) {
  const linkGrouper: Grouper<LinkedIssue, ParentGroupValue, 'links'> = {
    name: 'links',
    label: linkType.charAt(0).toUpperCase() + linkType.slice(1) + ' Link',
    groupByKey: {
      key: 'links',
      value: (item) => {
        const links = (item.issue.fields.issuelinks || item.issue.fields['Linked Issues'] || [])
          .filter((link) => link.type.outward === linkType)
          .map((link) => {
            return {
              key: link.outwardIssue?.key || 'no-link',
              summary: link.outwardIssue?.fields?.summary || 'No Link',
              url: replaceIssueKeyInUrl(item.url, link.outwardIssue?.key || 'no-link'),
            };
          });

        if (links.length === 0) {
          return { key: 'no-link', summary: 'No Link', url: '' };
        } else {
          return links;
        }
      },
    } as const,
    sort: (a: ParentGroupValue, b: ParentGroupValue) => {
      if (a.summary === b.summary) return 0;
      if (a.key === 'no-link') return 1; // Put 'No Parent' last
      if (b.key === 'no-link') return -1;
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
  return linkGrouper;
}

/**
 * Grouper for grouping by great-grandparent key, but displaying the great-grandparent summary as the title.
 * Expects items with `linkedParent.linkedParent.issue.fields?.Parent?.key` and `linkedParent.linkedParent.issue.fields?.Parent?.fields?.summary`.
 */

type GreatGrandParentGroupValue = { key: string; summary: string; url: string };
export const greatGrandParentGrouper: Grouper<LinkedIssue, GreatGrandParentGroupValue, 'greatGrandParent'> = {
  name: 'greatGrandParent',
  label: 'Great-grandparent',
  groupByKey: {
    key: 'greatGrandParent',
    value: (item) => {
      const greatGrandParentKey =
        item?.linkedParent?.linkedParent?.issue?.fields?.Parent?.key || 'no-great-grandparent';
      const summary =
        item?.linkedParent?.linkedParent?.issue?.fields?.Parent?.fields?.summary || 'No Great-grandparent';
      return { key: greatGrandParentKey, summary, url: replaceIssueKeyInUrl(item.url, greatGrandParentKey) };
    },
  } as const,
  sort: (a: GreatGrandParentGroupValue, b: GreatGrandParentGroupValue) => {
    if (a.summary === b.summary) return 0;
    if (a.summary === 'No Great-grandparent') return 1; // Put 'No Great-grandparent' last
    if (b.summary === 'No Great-grandparent') return -1;
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

/**
 * Grouper for grouping by the specific month containing the due date.
 * Expects items with a `derivedTiming.due: Date` property (e.g., LinkedIssue).
 */
export const dueInMonthGrouper: Grouper<LinkedIssue, YearMonthGroupValue, 'timeRange'> = {
  name: 'dueMonth',
  label: 'Due Month',
  groupByKey: {
    key: 'timeRange',
    value: (item) => {
      const due = item.derivedTiming.due;
      return due ? getYearMonthRange(due) : { start: '', end: '' };
    },
  } as const,
  sort: (a: YearMonthGroupValue, b: YearMonthGroupValue) => {
    if (a.start === b.start && a.end === b.end) return 0;
    if (!a.start || !a.end) return 1; // Put empty dates last
    if (!b.start || !b.end) return -1;
    return a.start.localeCompare(b.start);
  },
  fillGaps: (yearMonths: YearMonthGroupValue[]) => {
    if (yearMonths.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = yearMonths.some((m) => !m.start || !m.end);

    const filled: YearMonthGroupValue[] = [];

    const firstValidIndex = yearMonths.findIndex((m) => m.start && m.end);
    const lastValidIndex = yearMonths.findLastIndex((m) => m.start && m.end);

    if (firstValidIndex === -1 || lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }

    const startMonth = yearMonths[firstValidIndex];
    const endMonth = yearMonths[lastValidIndex];

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
      // Move to next month
      current.setUTCMonth(current.getUTCMonth() + 1);
    }

    // Add "no dates" group at the end if it was present in the original data
    if (hasNoDates) {
      filled.push({ start: '', end: '' });
    }

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
  value: (item: LinkedIssue) => {
    // returns an array of objects like {yearMonth: '2023-01', key: 'PROJECT-123'}
    return item.projectKey;
  },
} as const;

export const projectKeyGrouper: Grouper<LinkedIssue, string, 'projectKey'> = {
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

export type YearMonthGroupValue = { start: string; end: string };
export const intersectMonthGrouper: Grouper<LinkedIssue, YearMonthGroupValue, 'timeRange'> = {
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
  sort: (a, b) => {
    if (a.start === b.start && a.end === b.end) return 0;
    if (!a.start || !a.end) return 1; // Put empty dates last
    if (!b.start || !b.end) return -1;
    return a.start.localeCompare(b.start);
  },
  fillGaps: (groupValues) => {
    if (groupValues.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = groupValues.some((v) => !v.start || !v.end);

    // walk backwards to find the last groupValue that isn't empty...
    const lastValidIndex = groupValues.findLastIndex((v) => v.start && v.end);
    if (lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }
    const endValue = groupValues[lastValidIndex];
    if (!endValue.start || !endValue.end) {
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }

    const filled: YearMonthGroupValue[] = [];
    const startValue = groupValues[0];
    if (!startValue.start || !startValue.end) {
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }

    const startDate = new Date(startValue.start);
    const endDate = new Date(endValue.start);

    let current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const endMonth = endDate.getUTCMonth();
    const endYear = endDate.getUTCFullYear();

    while (
      current.getUTCFullYear() < endYear ||
      (current.getUTCFullYear() === endYear && current.getUTCMonth() <= endMonth)
    ) {
      const monthRange = getYearMonthRange(current);
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
      // Move to next month
      current.setUTCMonth(current.getUTCMonth() + 1);
    }

    // Add "no dates" group at the end if it was present in the original data
    if (hasNoDates) {
      filled.push({ start: '', end: '' });
    }

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

export const intersectQuarterGrouper: Grouper<LinkedIssue, YearQuarterGroupValue, 'timeRange'> = {
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
  sort: (a, b) => {
    if (a.start === b.start && a.end === b.end) return 0;
    if (!a.start || !a.end) return 1; // Put empty dates last
    if (!b.start || !b.end) return -1;
    return a.start.localeCompare(b.start);
  },
  fillGaps: (groupValues) => {
    if (groupValues.length === 0) return [];

    // Check if there's a "no dates" group value
    const hasNoDates = groupValues.some((v) => !v.start || !v.end);

    // walk backwards to find the last groupValue that isn't empty...
    const lastValidIndex = groupValues.findLastIndex((v) => v.start && v.end);
    if (lastValidIndex === -1) {
      // If no valid dates, just return the no dates group if it exists
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }
    const endValue = groupValues[lastValidIndex];
    if (!endValue.start || !endValue.end) {
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }

    const filled: YearQuarterGroupValue[] = [];
    const startValue = groupValues[0];
    if (!startValue.start || !startValue.end) {
      return hasNoDates ? [{ start: '', end: '' }] : [];
    }

    const startDate = new Date(startValue.start);
    const endDate = new Date(endValue.start);

    const startYear = startDate.getUTCFullYear();
    const startQ = Math.floor(startDate.getUTCMonth() / 3) + 1;
    const endYear = endDate.getUTCFullYear();
    const endQ = Math.floor(endDate.getUTCMonth() / 3) + 1;

    for (let year = startYear; year <= endYear; year++) {
      for (let quarter = 1; quarter <= 4; quarter++) {
        if (year === startYear && quarter < startQ) continue;
        if (year === endYear && quarter > endQ) continue;

        const quarterRange = getYearQuarterRangeFromYearQuarter(year, quarter);
        // filter out any quarters in the past
        const now = new Date();
        const currentQuarter = Math.floor(now.getUTCMonth() / 3) + 1;
        const currentYear = now.getUTCFullYear();
        if (year > currentYear || (year === currentYear && quarter >= currentQuarter)) {
          filled.push(quarterRange);
        }
      }
    }

    // Add "no dates" group at the end if it was present in the original data
    if (hasNoDates) {
      filled.push({ start: '', end: '' });
    }

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
export function getYearMonthRange(date: Date): YearMonthGroupValue {
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
export function getYearQuarterRange(date: Date): YearQuarterGroupValue {
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
export function getYearQuarterRangeFromYearQuarter(year: number, quarter: number): YearQuarterGroupValue {
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
