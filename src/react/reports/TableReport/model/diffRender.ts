/**
 * "last ➡ current" diff formatting for the Table report (spec/012-table-and-grouper, Phase 2).
 *
 * The `anythingToString` / `compareToLast` formatting (ported from the former Estimation Table),
 * generalised to operate on the Table report's loose {@link TableIssue} shape. Each estimation
 * column formats its current value against the prior-period counterpart read from
 * `issue.issueLastPeriod`, producing a "last ➡ current" string.
 */
import type { TableIssue } from './columns';

/** The `∅` placeholder for nullish values (matches Estimation Table). */
export function anythingToString(value: unknown): string {
  return value == null ? '∅' : '' + value;
}

/** Round numbers, pass everything else through unchanged (Estimation Table's `formatValue`). */
export function roundIfNumber(value: unknown): unknown {
  return typeof value === 'number' ? Math.round(value) : value;
}

/**
 * The prior-period snapshot of an issue, if any. Kept structural so callers don't have to import a
 * concrete issue type: any {@link TableIssue} may carry an `issueLastPeriod` of the same shape.
 */
type WithLastPeriod = TableIssue & { issueLastPeriod?: TableIssue | null };

/**
 * Format an issue's value against its prior-period counterpart:
 * - no prior period → `🚫 ➡ current`
 * - changed → `last ➡ current`
 * - unchanged → the value alone (empty string when it's the `∅` placeholder)
 */
export function compareToLast(
  issue: TableIssue,
  getValue: (issue: TableIssue) => unknown,
  formatValue: (value: unknown) => unknown = roundIfNumber,
): string {
  const currentValue = anythingToString(formatValue(getValue(issue)));

  const lastPeriod = (issue as WithLastPeriod).issueLastPeriod;
  if (!lastPeriod) {
    return '🚫 ➡ ' + currentValue;
  }

  const lastValue = anythingToString(formatValue(getValue(lastPeriod)));

  if (currentValue !== lastValue) {
    return lastValue + ' ➡ ' + currentValue;
  }
  return currentValue === '∅' ? '' : currentValue;
}
