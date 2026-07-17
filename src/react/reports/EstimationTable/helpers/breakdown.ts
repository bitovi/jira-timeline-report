import type { EstimationIssue } from '../types';

/**
 * Helpers for the Estimate Breakdown modal, ported from table-grid.js's `EstimateBreakdown`.
 */

/** Read a dotted path off an object (replaces CanJS's `key.get`). */
export function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), obj);
}

/** table-grid.js's `round`: fixed-decimal number, or the `∅` placeholder for non-numbers. */
export function round(value: unknown, decimals = 0): number | string {
  return typeof value === 'number' ? parseFloat(value.toFixed(decimals)) : '∅';
}

export function formatPercent(value: number | string): string {
  return value + '%';
}

/** The story-points-median estimate path is only shown when it's valid and confidence isn't a flat 100%. */
export function usedStoryPointsMedian(issue: EstimationIssue): boolean {
  return !!issue?.derivedTiming?.isStoryPointsMedianValid && issue?.derivedTiming?.usedConfidence !== 100;
}

/** When the prior period's team is the same object, the team-config row shows single (not last➡current) values. */
export function teamsAreTheSame(issue: EstimationIssue): boolean {
  if (!issue.issueLastPeriod) {
    return false;
  }
  return issue.issueLastPeriod.team === issue.team;
}
