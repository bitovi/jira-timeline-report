import type { LinkedIssue } from '../linked-issue';

export type PercentCompleteRollup = {
  userSpecifiedValues: boolean;
  totalWorkingDays: number;
  completedWorkingDays: number;
  source: 'self' | 'children' | 'empty';
  readonly remainingWorkingDays: number;
  /** Array of children that had no estimates (or whose children had no estimates) */
  childrenLinkedIssuesWithoutEstimates: LinkedIssue[];
};

function sum(arr: number[]): number {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}

function emptyRollup(): PercentCompleteRollup {
  return {
    completedWorkingDays: 0,
    totalWorkingDays: 0,
    userSpecifiedValues: false,
    get remainingWorkingDays() {
      return this.totalWorkingDays - this.completedWorkingDays;
    },
    source: 'empty',
    childrenLinkedIssuesWithoutEstimates: [],
  };
}

export function sumChildRollups(children: PercentCompleteRollup[]): PercentCompleteRollup {
  const userSpecifiedValues = children.every((child) => child.userSpecifiedValues);

  // Only filter when we have a true mixed situation (some children with userSpecifiedValues: true and some with false)
  // and there are actually children with userSpecifiedValues: true to prefer
  const hasUserSpecifiedChildren = children.some((child) => child.userSpecifiedValues);
  const hasNonUserSpecifiedChildren = children.some((child) => !child.userSpecifiedValues);
  const isTrulyMixed = hasUserSpecifiedChildren && hasNonUserSpecifiedChildren;

  const childrenToSum = isTrulyMixed ? children.filter((child) => child.userSpecifiedValues) : children;

  const totalDays = childrenToSum.map((child) => child.totalWorkingDays);
  const completedDays = childrenToSum.map((child) => child.completedWorkingDays);

  // Collect all children without estimates from all child rollups
  const childrenLinkedIssuesWithoutEstimates = children.flatMap((child) => child.childrenLinkedIssuesWithoutEstimates);

  return {
    completedWorkingDays: sum(completedDays),
    totalWorkingDays: sum(totalDays),
    userSpecifiedValues: userSpecifiedValues,
    get remainingWorkingDays() {
      return this.totalWorkingDays - this.completedWorkingDays;
    },
    source: 'children',
    childrenLinkedIssuesWithoutEstimates,
  };
}

/**
 * Calculates percent complete rollup using the "children first, then parent" strategy.
 * Only tallies objects with values (or parents with children who have values).
 */
function calculatePercentCompleteRollup(
  issue: LinkedIssue,
  childrenRollups: PercentCompleteRollup[],
): PercentCompleteRollup {
  // if there is hard child data, use it
  if (childrenRollups.length && childrenRollups.every((d) => d.userSpecifiedValues)) {
    return sumChildRollups(childrenRollups);
  }
  // if there is hard parent data, use it
  else if (issue.derivedTiming?.totalDaysOfWork) {
    return {
      completedWorkingDays: issue.derivedTiming.completedDaysOfWork || 0,
      totalWorkingDays: issue.derivedTiming.totalDaysOfWork,
      userSpecifiedValues: true,
      get remainingWorkingDays() {
        return this.totalWorkingDays - this.completedWorkingDays;
      },
      source: 'self',
      childrenLinkedIssuesWithoutEstimates: [],
    };
  }
  // if there is weak children data, use it
  else if (childrenRollups.length && childrenRollups.some((d) => d.totalWorkingDays > 0 && d.source !== 'empty')) {
    const rollup = sumChildRollups(childrenRollups);

    // Don't add children to tracking - sumChildRollups already collected all tracking from child rollups
    // The children have already tracked themselves if they need tracking

    return rollup;
  }
  // if there are no children with estimates, return empty and track children that lack estimates
  else {
    const data = emptyRollup();
    data.completedWorkingDays = data.totalWorkingDays = issue.derivedTiming?.completedDaysOfWork || 0;

    // If this issue has children, they all lack estimates
    if (issue.linkedChildren.length > 0) {
      data.childrenLinkedIssuesWithoutEstimates.push(...issue.linkedChildren);
    } else {
      // For leaf nodes with no estimates, track the issue itself
      data.childrenLinkedIssuesWithoutEstimates.push(issue);
    }

    return data;
  }
}

// WeakMap cache for storing calculated rollups
const rollupCache = new WeakMap<LinkedIssue, PercentCompleteRollup>();

/**
 * Recursively calculates percent complete for a linked issue and all its children.
 * Uses a bottom-up approach where children are calculated first.
 */
function calculatePercentCompleteRecursive(issue: LinkedIssue): PercentCompleteRollup {
  // Check if already calculated to avoid infinite recursion
  if (rollupCache.has(issue)) {
    return rollupCache.get(issue)!;
  }

  // Calculate children first (bottom-up approach)
  const childrenRollups: PercentCompleteRollup[] = [];

  for (const child of issue.linkedChildren) {
    const childRollup = calculatePercentCompleteRecursive(child);
    childrenRollups.push(childRollup);
  }

  // Calculate this issue's rollup based on children
  const rollup = calculatePercentCompleteRollup(issue, childrenRollups);

  // Cache the result
  rollupCache.set(issue, rollup);

  return rollup;
}

/**
 * Utility function to get percent complete data for a single issue.
 * Useful when you need rollup data for just one issue without processing an entire array.
 */
export function getPercentCompleteForLinkedIssue(issue: LinkedIssue): PercentCompleteRollup {
  return calculatePercentCompleteRecursive(issue);
}
