import { describe, expect, it } from 'vitest';

import { anythingToString, compareToLast, roundIfNumber } from './diffRender';

import type { TableIssue } from './columns';

const makeIssue = (overrides: Partial<TableIssue> = {}): TableIssue => ({
  key: 'X-1',
  summary: 'x',
  ...overrides,
});

describe('anythingToString', () => {
  it('maps null/undefined to the ∅ placeholder', () => {
    expect(anythingToString(null)).toBe('∅');
    expect(anythingToString(undefined)).toBe('∅');
  });
  it('stringifies everything else', () => {
    expect(anythingToString(0)).toBe('0');
    expect(anythingToString(5)).toBe('5');
  });
});

describe('roundIfNumber', () => {
  it('rounds numbers and passes other values through', () => {
    expect(roundIfNumber(4.6)).toBe(5);
    expect(roundIfNumber('x')).toBe('x');
    expect(roundIfNumber(undefined)).toBeUndefined();
  });
});

describe('compareToLast', () => {
  const getValue = (i: TableIssue) => (i.completionRollup as { totalWorkingDays?: number } | undefined)?.totalWorkingDays;
  const identity = (v: unknown) => v;

  it('prefixes 🚫 when there is no prior period', () => {
    const issue = makeIssue({ completionRollup: { totalWorkingDays: 5 } });
    expect(compareToLast(issue, getValue, identity)).toBe('🚫 ➡ 5');
  });

  it('shows last ➡ current when the value changed', () => {
    const issue = makeIssue({
      completionRollup: { totalWorkingDays: 5 },
      issueLastPeriod: makeIssue({ completionRollup: { totalWorkingDays: 3 } }),
    });
    expect(compareToLast(issue, getValue, identity)).toBe('3 ➡ 5');
  });

  it('shows a single value when unchanged', () => {
    const issue = makeIssue({
      completionRollup: { totalWorkingDays: 5 },
      issueLastPeriod: makeIssue({ completionRollup: { totalWorkingDays: 5 } }),
    });
    expect(compareToLast(issue, getValue, identity)).toBe('5');
  });

  it('renders empty string when unchanged and both are the ∅ placeholder', () => {
    const issue = makeIssue({ issueLastPeriod: makeIssue() });
    expect(compareToLast(issue, getValue, identity)).toBe('');
  });

  it('rounds by default (no formatValue argument)', () => {
    const issue = makeIssue({ completionRollup: { totalWorkingDays: 12.4 } });
    expect(compareToLast(issue, getValue)).toBe('🚫 ➡ 12');
  });
});
