import { describe, expect, it } from 'vitest';
import { getPath, round, formatPercent, usedStoryPointsMedian, teamsAreTheSame } from './breakdown';
import type { EstimationIssue } from '../types';

const makeIssue = (overrides: Partial<EstimationIssue> = {}): EstimationIssue => ({
  key: 'X-1',
  summary: 'x',
  reportingHierarchy: { childKeys: [] },
  ...overrides,
});

describe('getPath', () => {
  it('reads a dotted path', () => {
    expect(getPath({ a: { b: { c: 3 } } }, 'a.b.c')).toBe(3);
  });
  it('returns undefined through a null/missing segment without throwing', () => {
    expect(getPath({ a: null }, 'a.b.c')).toBeUndefined();
    expect(getPath({}, 'x.y')).toBeUndefined();
  });
});

describe('round', () => {
  it('fixes decimals for numbers', () => {
    expect(round(4.567, 1)).toBe(4.6);
    expect(round(5, 0)).toBe(5);
  });
  it('returns the ∅ placeholder for non-numbers', () => {
    expect(round(undefined)).toBe('∅');
    expect(round(null)).toBe('∅');
    expect(round('nope')).toBe('∅');
  });
});

describe('formatPercent', () => {
  it('appends a percent sign', () => {
    expect(formatPercent(80)).toBe('80%');
    expect(formatPercent('∅')).toBe('∅%');
  });
});

describe('usedStoryPointsMedian', () => {
  it('is true when the median is valid and confidence is not a flat 100', () => {
    expect(
      usedStoryPointsMedian(makeIssue({ derivedTiming: { isStoryPointsMedianValid: true, usedConfidence: 80 } })),
    ).toBe(true);
  });
  it('is false at 100% confidence', () => {
    expect(
      usedStoryPointsMedian(makeIssue({ derivedTiming: { isStoryPointsMedianValid: true, usedConfidence: 100 } })),
    ).toBe(false);
  });
  it('is false when the median is not valid', () => {
    expect(usedStoryPointsMedian(makeIssue({ derivedTiming: { isStoryPointsMedianValid: false } }))).toBe(false);
  });
});

describe('teamsAreTheSame', () => {
  it('is false without a prior period', () => {
    expect(teamsAreTheSame(makeIssue())).toBe(false);
  });
  it('is true when the prior period references the same team object', () => {
    const team = { velocity: 10 };
    const issue = makeIssue({ team, issueLastPeriod: makeIssue({ team }) });
    expect(teamsAreTheSame(issue)).toBe(true);
  });
  it('is false when the team objects differ', () => {
    const issue = makeIssue({ team: { velocity: 10 }, issueLastPeriod: makeIssue({ team: { velocity: 12 } }) });
    expect(teamsAreTheSame(issue)).toBe(false);
  });
});
