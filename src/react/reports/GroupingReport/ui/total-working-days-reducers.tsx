import React from 'react';
import { getBusinessDatesCount } from '../../../../utils/date/business-days';
import type { AggregationReducer } from '../data/aggregate';
import type { LinkedIssue } from '../jira/linked-issue/linked-issue';
import type { YearMonthGroupValue, YearQuarterGroupValue } from './grouper';
import { getPercentCompleteForLinkedIssue } from '../jira/linked-issue/percent-complete/percent-complete';
import { businessDaysInclusive, toISODateString } from '../../../../utils/date/business-days-inclusive';

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

/**
 * Helper function to calculate intersecting work days for an item within a time range
 */
function calculateIntersectingWorkDays(
  item: LinkedIssue,
  timeRange: YearMonthGroupValue | YearQuarterGroupValue,
): number {
  if (!timeRange.start || !timeRange.end) {
    return 0;
  }

  const itemStartDate = item.derivedTiming.start;
  const itemEndDate = item.derivedTiming.due;
  let estimatedDaysOfWork = item.derivedTiming.estimatedDaysOfWork;

  if (!itemStartDate || !itemEndDate) {
    return 0; // No valid dates to calculate intersecting work days
  }

  // If there's no estimate, use the business days between start and end dates
  if (!estimatedDaysOfWork) {
    estimatedDaysOfWork = getBusinessDatesCount(itemStartDate, itemEndDate);
  }

  const timeRangeStart = new Date(timeRange.start);
  const timeRangeEnd = new Date(timeRange.end);

  // Calculate the overlap between the item's timeline and the time range
  const overlapStart = itemStartDate > timeRangeStart ? itemStartDate : timeRangeStart;
  const overlapEnd = itemEndDate < timeRangeEnd ? itemEndDate : timeRangeEnd;

  if (overlapStart > overlapEnd) {
    return 0; // No overlap
  }

  // Get total business days for the entire issue
  const totalBusinessDays = getBusinessDatesCount(itemStartDate, itemEndDate);

  // Get business days for the overlapping period
  const overlapBusinessDays = getBusinessDatesCount(overlapStart, overlapEnd);

  if (totalBusinessDays === 0) {
    return 0; // Avoid division by zero
  }

  // Calculate the proportion of estimated work days that fall within the time range
  const proportion = overlapBusinessDays / totalBusinessDays;
  return estimatedDaysOfWork * proportion;
}

/**
 * Aggregates intersecting working days - the proportion of estimated work that falls within a time range
 */
export const intersectingWorkingDays: AggregationReducer<
  LinkedIssue,
  number,
  'intersectingWorkingDays',
  React.ReactNode
> = {
  name: 'intersectingWorkingDays',
  initial: (groupContext) => 0 as number,
  update: (acc: number, item: LinkedIssue, groupContext: Record<string, any>) => {
    if (groupContext.timeRange) {
      const timeRange = groupContext.timeRange as YearMonthGroupValue | YearQuarterGroupValue;
      const intersectingWorkDays = calculateIntersectingWorkDays(item, timeRange);
      acc += intersectingWorkDays;
    }

    return acc;
  },
  finalize: (acc) => {
    // Format to 2 decimal places
    return <div className="text-right font-mono">{numberFormat.format(acc)} days</div>;
  },
};

/**
 * Calculates capacity need - the average number of people (FTE) required to complete work in a time period
 */
export const capacityNeed: AggregationReducer<LinkedIssue, number, 'capacityNeed', React.ReactNode> = {
  name: 'capacityNeed',
  initial: (groupContext) => 0 as number,
  update: (acc: number, item: LinkedIssue, groupContext: Record<string, any>) => {
    if (groupContext.timeRange) {
      const timeRange = groupContext.timeRange as YearMonthGroupValue | YearQuarterGroupValue;
      const intersectingWorkDays = calculateIntersectingWorkDays(item, timeRange);

      if (intersectingWorkDays > 0 && timeRange.start && timeRange.end) {
        // Calculate the business days in the time range to determine capacity need
        const timeRangeStart = new Date(timeRange.start);
        const timeRangeEnd = new Date(timeRange.end);
        const timeRangeBusinessDays = getBusinessDatesCount(timeRangeStart, timeRangeEnd);

        if (timeRangeBusinessDays > 0) {
          // Capacity need = intersecting work days / business days in time range
          const capacityForThisItem = intersectingWorkDays / timeRangeBusinessDays;
          acc += capacityForThisItem;
        }
      }
    }

    return acc;
  },
  finalize: (acc) => {
    return <div className="text-right font-mono">{numberFormat.format(acc)} FTE</div>;
  },
};

/**
 * Calculates the maximum capacity needed for any single day in the time range
 */
export const maxCapacity: AggregationReducer<LinkedIssue, Map<string, number>, 'maxCapacity', React.ReactNode> = {
  name: 'maxCapacity',
  initial: (groupContext) => {
    const dailyCapacity = new Map<string, number>();

    if (groupContext.timeRange) {
      const timeRange = groupContext.timeRange as YearMonthGroupValue | YearQuarterGroupValue;
      if (timeRange.start && timeRange.end) {
        const timeRangeStart = new Date(timeRange.start);
        const timeRangeEnd = new Date(timeRange.end);

        // Initialize each business day in the time range with 0 capacity
        for (const current of businessDaysInclusive(timeRangeStart, timeRangeEnd)) {
          const dateString = toISODateString(current);
          dailyCapacity.set(dateString, 0);
        }
      }
    }

    return dailyCapacity;
  },
  update: (acc: Map<string, number>, item: LinkedIssue, groupContext: Record<string, any>) => {
    if (groupContext.timeRange) {
      const timeRange = groupContext.timeRange as YearMonthGroupValue | YearQuarterGroupValue;
      const intersectingWorkDays = calculateIntersectingWorkDays(item, timeRange);

      if (intersectingWorkDays > 0 && timeRange.start && timeRange.end) {
        const itemStartDate = item.derivedTiming.start;
        const itemEndDate = item.derivedTiming.due;

        if (itemStartDate && itemEndDate) {
          const timeRangeStart = new Date(timeRange.start);
          const timeRangeEnd = new Date(timeRange.end);

          // Find the overlap between item timeline and time range
          const overlapStart = itemStartDate > timeRangeStart ? itemStartDate : timeRangeStart;
          const overlapEnd = itemEndDate < timeRangeEnd ? itemEndDate : timeRangeEnd;

          if (overlapStart <= overlapEnd) {
            // Get all business days in the overlap period
            const overlapBusinessDays = Array.from(businessDaysInclusive(overlapStart, overlapEnd));

            if (overlapBusinessDays.length > 0) {
              // Distribute work evenly across business days
              const workPerDay = intersectingWorkDays / overlapBusinessDays.length;

              overlapBusinessDays.forEach((day) => {
                const dateString = toISODateString(day);
                const currentCapacity = acc.get(dateString) || 0;
                acc.set(dateString, currentCapacity + workPerDay);
              });
            }
          }
        }
      }
    }

    return acc;
  },
  finalize: (acc) => {
    if (acc.size === 0) {
      return <div className="text-right font-mono">0.0 FTE</div>;
    }

    // Find the maximum capacity across all days
    const maxCapacityValue = Math.max(...Array.from(acc.values()));

    return <div className="text-right font-mono">{numberFormat.format(maxCapacityValue)} FTE</div>;
  },
};
