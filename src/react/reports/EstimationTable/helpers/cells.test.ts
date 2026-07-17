import { describe, expect, it } from 'vitest';
import { anythingToString, compareToLast, estimatedDaysOfWork, timedDays, rolledUpDays } from './cells';
import type { EstimationIssue } from '../types';

const makeIssue = (overrides: Partial<EstimationIssue> = {}): EstimationIssue => ({
  key: 'X-1',
  summary: 'x',
  reportingHierarchy: { childKeys: [] },
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

describe('compareToLast', () => {
  const getValue = (i: EstimationIssue) => i.completionRollup?.totalWorkingDays;
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
});

describe('estimatedDaysOfWork', () => {
  it('uses the median deterministic days when story-points-median is valid', () => {
    const issue = makeIssue({
      derivedTiming: { isStoryPointsMedianValid: true, deterministicTotalDaysOfWork: 4.6 },
    });
    expect(estimatedDaysOfWork(issue)).toBe('🚫 ➡ 5');
  });

  it('falls back to story-points days when only story points are valid', () => {
    const issue = makeIssue({
      derivedTiming: { isStoryPointsMedianValid: false, isStoryPointsValid: true, storyPointsDaysOfWork: 2.2 },
    });
    expect(estimatedDaysOfWork(issue)).toBe('🚫 ➡ 2');
  });

  it('is ∅ when neither estimate is valid', () => {
    const issue = makeIssue({ derivedTiming: {} });
    expect(estimatedDaysOfWork(issue)).toBe('🚫 ➡ ∅');
  });
});

describe('timedDays', () => {
  it('rounds datesDaysOfWork', () => {
    const issue = makeIssue({ derivedTiming: { datesDaysOfWork: 7.8 } });
    expect(timedDays(issue)).toBe('🚫 ➡ 8');
  });
  it('is ∅ when there is no dates-based work', () => {
    expect(timedDays(makeIssue({ derivedTiming: {} }))).toBe('🚫 ➡ ∅');
  });
});

describe('rolledUpDays', () => {
  it('rounds completionRollup.totalWorkingDays', () => {
    const issue = makeIssue({ completionRollup: { totalWorkingDays: 12.4 } });
    expect(rolledUpDays(issue)).toBe('🚫 ➡ 12');
  });
});
