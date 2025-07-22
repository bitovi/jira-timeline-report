import React from 'react';
import type { DerivedIssue } from '../../../../jira/derived/derive';
import type { WithRollups } from '../../../../jira/rolledup-and-rolledback/rollup-and-rollback';
import type { GroupByKey } from '../data/group';
import type { DateRangeGroupValue, YearQuarterGroupValue, YearMonthGroupValue } from './date-groupers';

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

// Re-export the types for backward compatibility
export type { DateRangeGroupValue, YearQuarterGroupValue, YearMonthGroupValue };

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

type IssueKeyGroupValue = { key: string; summary: string; url: string };
export const issueKeyGrouper: Grouper<LinkedIssue, IssueKeyGroupValue, 'issueKey'> = {
  name: 'issueKey',
  label: 'Issue Key',
  groupByKey: {
    key: 'issueKey',
    value: (item) => {
      const key = item?.issue?.key || 'no-key';
      const summary = item?.issue?.fields?.summary || 'No Summary';
      return { key, summary: String(summary), url: item.url };
    },
  } as const,
  sort: (a, b) => {
    if (a.key === 'no-key') return 1; // Put 'no-key' last
    if (b.key === 'no-key') return -1;
    return a.key.localeCompare(b.key, undefined, { sensitivity: 'base' });
  },
  titles: (values) => {
    return values.map((v) => {
      return (
        <a href={v.url} target="_blank" rel="noopener noreferrer">
          {v.key}
        </a>
      );
    });
  },
};
