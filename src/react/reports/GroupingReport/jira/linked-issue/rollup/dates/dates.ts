import type { LinkedIssue } from '../../linked-issue';
import { selectDue, selectStart, descSortByDue, sortByStart } from '../../../../../../../jira/shared/helpers';
import {
  DueData,
  StartData,
  getStartDateAndDueDataFromFieldsOrSprints,
  getStartDateAndDueDataFromSprints,
} from '../../../../../../../shared/issue-data/date-data';

export type RollupDateData = Partial<StartData & DueData>;

export type WithDateRollup = {
  rollupDates: RollupDateData;
};

export const getStartData = (d: Partial<StartData> | null) => {
  if (!d) return {};

  const { start, startFrom } = d;

  return {
    ...(start && { start }),
    ...(startFrom && { startFrom }),
  };
};

export const getDueData = (d: Partial<DueData> | null) => {
  if (!d) return {};

  const { due, dueTo } = d;

  return {
    ...(due && { due }),
    ...(dueTo && { dueTo }),
  };
};

export const getStartAndDueData = (d: RollupDateData | null) => {
  return {
    ...getStartData(d),
    ...getDueData(d),
  };
};

/**
 * Merges start and due data from multiple records, taking the earliest start and latest due
 */
export function mergeStartAndDueData<T extends RollupDateData>(records: T[]) {
  const startDataSortAsc: Partial<StartData>[] = records.filter(selectStart).map(getStartData).sort(sortByStart);
  const dueDataSortDesc: Partial<DueData>[] = records.filter(selectDue).map(getDueData).sort(descSortByDue);

  const firstStart = startDataSortAsc.length ? startDataSortAsc[0] : {};
  const lastDue = dueDataSortDesc.length ? dueDataSortDesc[0] : {};

  return {
    ...firstStart,
    ...lastDue,
  };
}

/**
 * Gets date data from various sources for a linked issue
 * Priority: start/due dates, then sprint dates
 */
function getDateDataFromLinkedIssue(issue: LinkedIssue): RollupDateData {
  // Get timing data from derivedTiming (includes start/due dates and sprint data)
  const timingData = getStartAndDueData(issue.derivedTiming) as RollupDateData;

  // If we have timing data, use it
  if (timingData.start || timingData.due) {
    return timingData;
  }

  // Fall back to getting sprint data directly if available
  const sprintData = getStartDateAndDueDataFromSprints(issue);
  return getStartAndDueData({
    start: sprintData.startData?.start,
    startFrom: sprintData.startData?.startFrom,
    due: sprintData.dueData?.due,
    dueTo: sprintData.dueData?.dueTo,
  }) as RollupDateData;
}

/**
 * Calculates date rollup using the "widest range" strategy.
 * Always takes the earliest start date and latest due date from parent and all children.
 */
function calculateDateRollup(issue: LinkedIssue, childrenRollups: RollupDateData[]): RollupDateData {
  // Get parent's own date data
  const parentDateData = getDateDataFromLinkedIssue(issue);

  // Combine parent and children data to find the widest range
  const allData = [parentDateData, ...childrenRollups];

  return mergeStartAndDueData(allData);
}

// WeakMap cache for storing calculated rollups
let rollupCache = new WeakMap<LinkedIssue, RollupDateData>();

/**
 * Recursively calculates date rollups for a linked issue and all its children.
 * Uses a bottom-up approach where children are calculated first.
 */
function calculateDateRollupRecursive(issue: LinkedIssue): RollupDateData {
  // Check if already calculated to avoid infinite recursion
  if (rollupCache.has(issue)) {
    return rollupCache.get(issue)!;
  }

  // Calculate children first (bottom-up approach)
  const childrenRollups: RollupDateData[] = [];

  for (const child of issue.linkedChildren) {
    const childRollup = calculateDateRollupRecursive(child);
    childrenRollups.push(childRollup);
  }

  // Calculate this issue's rollup based on children using widest range strategy
  const rollup = calculateDateRollup(issue, childrenRollups);

  // Cache the result
  rollupCache.set(issue, rollup);

  return rollup;
}

/**
 * Utility function to get date rollup data for a single issue.
 * Useful when you need rollup data for just one issue without processing an entire array.
 */
export function getDateRollupForLinkedIssue(issue: LinkedIssue): RollupDateData {
  return calculateDateRollupRecursive(issue);
}

/**
 * Adds date rollup data to an array of linked issues.
 * Each issue will get a rollupDates property containing the widest date range
 * from itself and all its descendants.
 */
export function addDateRollupsToLinkedIssues<T extends LinkedIssue>(issues: T[]): (T & WithDateRollup)[] {
  return issues.map((issue) => ({
    ...issue,
    rollupDates: getDateRollupForLinkedIssue(issue),
  }));
}

/**
 * Clears the rollup cache. Useful for testing or when processing new sets of data.
 * Note: WeakMap doesn't have a clear method, so we create a new instance.
 */
export function clearDateRollupCache(): void {
  rollupCache = new WeakMap<LinkedIssue, RollupDateData>();
}
