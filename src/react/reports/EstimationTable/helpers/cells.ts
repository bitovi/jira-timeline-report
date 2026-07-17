import type { EstimationIssue } from '../types';

/**
 * Pure cell-formatting functions for the Estimation Table's numeric columns.
 *
 * Ported verbatim from table-grid.js: each column value is diffed against the prior period
 * (`issueLastPeriod`) and rendered as a "last ➡ current" string.
 */

export function anythingToString(value: unknown): string {
  return value == null ? '∅' : '' + value;
}

/** table-grid.js's shared `formatValue` for the three numeric columns: round numbers, pass through the rest. */
function roundIfNumber(value: unknown): unknown {
  return typeof value === 'number' ? Math.round(value) : value;
}

/**
 * Format a value against its prior-period counterpart:
 * - no prior period → `🚫 ➡ current`
 * - changed → `last ➡ current`
 * - unchanged → the value alone (empty string when it's the `∅` placeholder)
 */
export function compareToLast(
  issue: EstimationIssue,
  getValue: (issue: EstimationIssue) => unknown,
  formatValue: (value: unknown) => unknown,
): string {
  const currentValue = anythingToString(formatValue(getValue(issue)));

  if (!issue.issueLastPeriod) {
    return '🚫 ➡ ' + currentValue;
  }

  const lastValue = anythingToString(formatValue(getValue(issue.issueLastPeriod)));

  if (currentValue !== lastValue) {
    return lastValue + ' ➡ ' + currentValue;
  }
  return currentValue === '∅' ? '' : currentValue;
}

export function estimatedDaysOfWork(issue: EstimationIssue): string {
  return compareToLast(
    issue,
    (i) => {
      // if we have story points median, use that
      if (i?.derivedTiming?.isStoryPointsMedianValid) {
        return i.derivedTiming.deterministicTotalDaysOfWork;
      } else if (i?.derivedTiming?.isStoryPointsValid) {
        return i?.derivedTiming?.storyPointsDaysOfWork;
      }
      return undefined;
    },
    roundIfNumber,
  );
}

export function timedDays(issue: EstimationIssue): string {
  return compareToLast(issue, (i) => i?.derivedTiming?.datesDaysOfWork || undefined, roundIfNumber);
}

export function rolledUpDays(issue: EstimationIssue): string {
  return compareToLast(issue, (i) => i?.completionRollup?.totalWorkingDays || undefined, roundIfNumber);
}
