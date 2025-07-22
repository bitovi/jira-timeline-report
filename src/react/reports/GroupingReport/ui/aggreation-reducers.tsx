import { getBusinessDatesCount } from '../../../../utils/date/business-days';
import type { AggregationReducer } from '../data/aggregate';
import type { LinkedIssue } from '../jira/linked-issue/linked-issue';
import type { YearMonthGroupValue, YearQuarterGroupValue } from './grouper';
import React from 'react';

export const groupAllIssues: AggregationReducer<LinkedIssue, LinkedIssue[], 'issues'> = {
  name: 'issues',
  initial: (groupContext) => [] as LinkedIssue[],
  update: (acc: LinkedIssue[], item: LinkedIssue, groupContext) => {
    acc.push(item);
    return acc;
  },
};

const hoursPerWeekField = 'Hours per week';
const billingRateField = 'Billing Rate';

const numberFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const revenueReducer: AggregationReducer<LinkedIssue, number, 'revenue', React.ReactNode> = {
  name: 'revenue',
  initial: (groupContext) => 0 as number,
  update: (acc: number, item: LinkedIssue, groupContext: Record<string, any>) => {
    if (groupContext.timeRange) {
      const timeRange = groupContext.timeRange as YearMonthGroupValue | YearQuarterGroupValue;
      if (!timeRange.start || !timeRange.end) {
        return acc;
      }
      // find the number of days of overlap between the item and the timeRange
      const startDate = new Date(timeRange.start);
      const endDate = new Date(timeRange.end);
      const itemStartDate = item.derivedTiming.start;
      const itemEndDate = item.derivedTiming.due;
      if (!itemStartDate || !itemEndDate) {
        return acc; // No valid dates to calculate revenue
      }
      // Calculate the overlap in business days
      const overlapStart = itemStartDate > startDate ? itemStartDate : startDate;
      const overlapEnd = itemEndDate < endDate ? itemEndDate : endDate;
      if (overlapStart > overlapEnd) {
        return acc; // No overlap
      }

      const businessDays: number = getBusinessDatesCount(overlapStart, overlapEnd);

      const hoursPerWeek: number = (item.issue.fields[hoursPerWeekField] as number) || 0;
      const billingRate: number = (item.linkedParent?.issue.fields[billingRateField] as number) || 0;
      if (hoursPerWeek && billingRate) {
        const weeks = businessDays / 5; // Assuming 5 business days in a week
        const revenue = weeks * hoursPerWeek * billingRate;
        acc += revenue;
      } else {
        return acc;
      }
    }

    return acc;
  },
  finalize: (acc) => {
    // return the revenue as a formatted string with commas
    return <div className="text-right">{numberFormat.format(acc)}</div>;
  },
};

export const issuesListReducer: AggregationReducer<LinkedIssue, LinkedIssue[], 'issuesList', React.ReactNode> = {
  name: 'issuesList',
  initial: (groupContext) => [] as LinkedIssue[],
  update: (acc: LinkedIssue[], item: LinkedIssue, groupContext) => {
    acc.push(item);
    return acc;
  },
  finalize: (acc) => {
    // return a list of issues as a React node
    return (
      <ul className="list-disc pl-5">
        {acc.map((issue) => (
          <li key={issue.issue.id}>
            <a href={issue.url} target="_blank" rel="noopener noreferrer">
              {issue.summary}
            </a>
          </li>
        ))}
      </ul>
    );
  },
};

export const top5IssuesByRankReducer: AggregationReducer<
  LinkedIssue,
  LinkedIssue[],
  'top5IssuesByRank',
  React.ReactNode
> = {
  name: 'top5IssuesByRank',
  initial: (groupContext) => [] as LinkedIssue[],
  update: (acc: LinkedIssue[], item: LinkedIssue, groupContext) => {
    acc.push(item);
    return acc;
  },
  finalize: (acc) => {
    // Sort by rank (using Jira's string-based rank format) and take top 5
    const sortedIssues = acc
      .filter((issue) => issue.rank !== undefined && issue.rank !== null)
      .sort((a, b) => {
        const rankA = String(a.rank || '');
        const rankB = String(b.rank || '');
        return rankA.localeCompare(rankB);
      })
      .slice(0, 5);

    if (sortedIssues.length === 0) {
      return <div className="text-sm text-gray-500">No ranked issues</div>;
    }

    return (
      <div className="text-sm">
        <ol className="list-decimal pl-4">
          {sortedIssues.map((issue, index) => (
            <li key={issue.issue.id}>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-800 hover:underline"
              >
                {issue.summary}
              </a>
            </li>
          ))}
        </ol>
      </div>
    );
  },
};
