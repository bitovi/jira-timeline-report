import React from 'react';
import type { AggregationReducer } from '../data/aggregate';
import type { LinkedIssue } from '../jira/linked-issue/linked-issue';
import { getPercentCompleteForLinkedIssue } from '../jira/linked-issue/percent-complete/percent-complete';

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Aggregates total working days across all issues in a group
 */
export const totalWorkingDaysReducer: AggregationReducer<LinkedIssue, number, 'totalWorkingDays', React.ReactNode> = {
  name: 'totalWorkingDays',
  initial: (groupContext) => 0,
  update: (acc: number, item: LinkedIssue, groupContext) => {
    const percentComplete = getPercentCompleteForLinkedIssue(item);
    return acc + percentComplete.totalWorkingDays;
  },
  finalize: (acc) => {
    return <div className="text-right font-mono">{numberFormat.format(acc)} days</div>;
  },
};

/**
 * Aggregates completed working days across all issues in a group
 */
export const completedWorkingDaysReducer: AggregationReducer<
  LinkedIssue,
  number,
  'completedWorkingDays',
  React.ReactNode
> = {
  name: 'completedWorkingDays',
  initial: (groupContext) => 0,
  update: (acc: number, item: LinkedIssue, groupContext) => {
    const percentComplete = getPercentCompleteForLinkedIssue(item);
    return acc + percentComplete.completedWorkingDays;
  },
  finalize: (acc) => {
    return <div className="text-right font-mono">{numberFormat.format(acc)} days</div>;
  },
};

/**
 * Aggregates remaining working days across all issues in a group
 */
export const remainingWorkingDaysReducer: AggregationReducer<
  LinkedIssue,
  number,
  'remainingWorkingDays',
  React.ReactNode
> = {
  name: 'remainingWorkingDays',
  initial: (groupContext) => 0,
  update: (acc: number, item: LinkedIssue, groupContext) => {
    const percentComplete = getPercentCompleteForLinkedIssue(item);
    return acc + percentComplete.remainingWorkingDays;
  },
  finalize: (acc) => {
    return <div className="text-right font-mono">{numberFormat.format(acc)} days</div>;
  },
};

/**
 * Calculates the overall completion percentage for all issues in a group
 */
export const workingDaysCompletionPercentageReducer: AggregationReducer<
  LinkedIssue,
  { totalWorkingDays: number; completedWorkingDays: number },
  'completionPercentage',
  React.ReactNode
> = {
  name: 'completionPercentage',
  initial: (groupContext) => ({ totalWorkingDays: 0, completedWorkingDays: 0 }),
  update: (acc, item: LinkedIssue, groupContext) => {
    const percentComplete = getPercentCompleteForLinkedIssue(item);
    return {
      totalWorkingDays: acc.totalWorkingDays + percentComplete.totalWorkingDays,
      completedWorkingDays: acc.completedWorkingDays + percentComplete.completedWorkingDays,
    };
  },
  finalize: (acc) => {
    const percentage = acc.totalWorkingDays === 0 ? 0 : (acc.completedWorkingDays / acc.totalWorkingDays) * 100;
    const isComplete = percentage >= 100;
    const colorClass = isComplete ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600';

    return <div className={`text-right font-mono ${colorClass}`}>{numberFormat.format(percentage)}%</div>;
  },
};

/**
 * Shows a detailed breakdown of working days for all issues in a group
 */
export const workingDaysBreakdownReducer: AggregationReducer<
  LinkedIssue,
  {
    totalWorkingDays: number;
    completedWorkingDays: number;
    issueCount: number;
    issuesWithEstimates: number;
    issuesWithoutEstimates: number;
  },
  'workingDaysBreakdown',
  React.ReactNode
> = {
  name: 'workingDaysBreakdown',
  initial: (groupContext) => ({
    totalWorkingDays: 0,
    completedWorkingDays: 0,
    issueCount: 0,
    issuesWithEstimates: 0,
    issuesWithoutEstimates: 0,
  }),
  update: (acc, item: LinkedIssue, groupContext) => {
    const percentComplete = getPercentCompleteForLinkedIssue(item);
    const hasEstimate = percentComplete.source !== 'empty';

    return {
      totalWorkingDays: acc.totalWorkingDays + percentComplete.totalWorkingDays,
      completedWorkingDays: acc.completedWorkingDays + percentComplete.completedWorkingDays,
      issueCount: acc.issueCount + 1,
      issuesWithEstimates: acc.issuesWithEstimates + (hasEstimate ? 1 : 0),
      issuesWithoutEstimates: acc.issuesWithoutEstimates + (hasEstimate ? 0 : 1),
    };
  },
  finalize: (acc) => {
    const percentage = acc.totalWorkingDays === 0 ? 0 : (acc.completedWorkingDays / acc.totalWorkingDays) * 100;
    const remaining = acc.totalWorkingDays - acc.completedWorkingDays;

    return (
      <div className="text-sm">
        <div className="font-mono">
          <div>Total: {numberFormat.format(acc.totalWorkingDays)} days</div>
          <div>Complete: {numberFormat.format(acc.completedWorkingDays)} days</div>
          <div>Remaining: {numberFormat.format(remaining)} days</div>
          <div className="mt-1">
            Progress:{' '}
            <span
              className={percentage >= 100 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}
            >
              {numberFormat.format(percentage)}%
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          <div>{acc.issueCount} total issues</div>
          <div className="flex gap-4">
            <span className="text-green-600">{acc.issuesWithEstimates} with estimates</span>
            {acc.issuesWithoutEstimates > 0 && (
              <span className="text-yellow-600">{acc.issuesWithoutEstimates} without estimates</span>
            )}
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Lists issues without estimates in a group
 */
export const issuesWithoutEstimatesReducer: AggregationReducer<
  LinkedIssue,
  LinkedIssue[],
  'issuesWithoutEstimates',
  React.ReactNode
> = {
  name: 'issuesWithoutEstimates',
  initial: (groupContext) => [],
  update: (acc: LinkedIssue[], item: LinkedIssue, groupContext) => {
    const percentComplete = getPercentCompleteForLinkedIssue(item);
    const uniqueIssues = new Set([...acc, ...percentComplete.childrenLinkedIssuesWithoutEstimates]);
    return Array.from(uniqueIssues);
  },
  finalize: (acc) => {
    if (acc.length === 0) {
      return <div className="text-sm text-green-600">All issues have estimates</div>;
    }

    return (
      <div className="text-sm">
        <div className="text-yellow-600 font-medium mb-1">
          {acc.length} issue{acc.length !== 1 ? 's' : ''} without estimates:
        </div>
        <ul className="list-disc pl-4 space-y-1">
          {acc.map((issue) => (
            <li key={issue.key}>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {issue.key}: {issue.summary}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
};

/**
 * Lists issues that have no estimates at all (source is 'empty')
 */
export const issuesWithoutAnyEstimatesReducer: AggregationReducer<
  LinkedIssue,
  LinkedIssue[],
  'issuesWithoutAnyEstimates',
  React.ReactNode
> = {
  name: 'issuesWithoutAnyEstimates',
  initial: (groupContext) => [],
  update: (acc: LinkedIssue[], item: LinkedIssue, groupContext) => {
    const percentComplete = getPercentCompleteForLinkedIssue(item);
    if (percentComplete.source === 'empty') {
      acc.push(item);
    }
    return acc;
  },
  finalize: (acc) => {
    if (acc.length === 0) {
      return <div className="text-sm text-green-600">All issues have estimates</div>;
    }

    return (
      <div className="text-sm">
        <div className="text-red-600 font-medium mb-1">
          {acc.length} issue{acc.length !== 1 ? 's' : ''} with no estimates:
        </div>
        <ul className="list-disc pl-4 space-y-1">
          {acc.map((issue) => (
            <li key={issue.key}>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {issue.key}: {issue.summary}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
};
