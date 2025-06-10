import React from 'react';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { WithRollups } from '../../../../jira/rolledup-and-rolledback/rollup-and-rollback';
export type RolledUpIssue = DerivedIssue & WithRollups;

export interface Grouper<Issue = any, GroupKey = string, GroupValueType = any> {
  /** Unique name/id for this grouping */
  name: string;
  /** Human-readable label for UI */
  label: string;
  /** GroupByKey object: { key: string, value: (item: Issue) => GroupValueType } */
  groupByKey: { key: GroupKey; value: (item: Issue) => GroupValueType };
  /** Sorts the group keys (for columns/rows) */
  sort?: (a: GroupKey, b: GroupKey) => number;
  /** Fills in missing keys for display (e.g., fill missing quarters) */
  fillGaps?: (keys: GroupKey[]) => GroupKey[];
  /** Returns display titles for the group values (e.g., '2023 Q1', 'Q2', ... or parent summaries). Can return strings or JSX. */
  titles: (values: GroupValueType[]) => Array<string | React.ReactNode>;
  /** If true, this grouping is a "single column" (e.g., 'All Issues') */
  singleColumn?: boolean;
  /** If true, this grouping is a "multi-column" (e.g., time, status, etc) */
  multiColumn?: boolean;
  /** Optional: custom cell renderer for this grouping */
  renderCell?: (groupKey: GroupKey, items: Issue[]) => React.ReactNode;
}

/**
 * Grouper for grouping by calendar quarter (e.g., '2023-Q1').
 * Expects items with a `rollupDates.due: Date` property (e.g., RolledUpIssue).
 */
export const quarterGrouper: Grouper<RolledUpIssue, string, string | null> = {
  name: 'quarter',
  label: 'Quarter',
  groupByKey: {
    key: 'yearQuarter',
    value: (item) => {
      const due = item?.rollupDates?.due;
      return due ? getYearQuarter(due) : null;
    },
  },
  sort: (a: string, b: string) => {
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
export const parentGrouper: Grouper<RolledUpIssue, string, { key: string; summary: string; url: string }> = {
  name: 'parent',
  label: 'Parent',
  groupByKey: {
    key: 'parent',
    value: (item) => {
      const parentKey = item?.issue?.fields?.Parent?.key || 'no-parent';
      const summary = item?.issue?.fields?.Parent?.fields?.summary || 'No Parent';
      return { key: parentKey, summary, url: replaceIssueKeyInUrl(item.url, parentKey) };
    },
  },
  sort: (a: string, b: string) => {
    if (a === b) return 0;
    if (a === 'no-parent') return 1; // Put 'No Parent' last
    if (b === 'no-parent') return -1;
    // Defensive: ensure both are strings before localeCompare
    if (typeof a === 'string' && typeof b === 'string') {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    }
    // Fallback: compare as strings
    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
  },
  fillGaps: (parentKeys: string[]) => parentKeys, // No gaps to fill for parent keys
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
