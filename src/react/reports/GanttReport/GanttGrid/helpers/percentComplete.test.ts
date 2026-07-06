import { describe, expect, it } from 'vitest';
import { computePercentComplete } from './percentComplete';
import { makeIssue } from '../fixtures';

describe('computePercentComplete', () => {
  it('returns null when totalWorkingDays is 0 (divide-by-zero guard)', () => {
    const issue = makeIssue({ key: 'A', completedWorkingDays: 0, totalWorkingDays: 0 });
    expect(computePercentComplete(issue)).toBeNull();
  });

  it('rounds the percentage', () => {
    const issue = makeIssue({ key: 'A', completedWorkingDays: 1, totalWorkingDays: 3 });
    expect(computePercentComplete(issue)).toBe(33);
  });

  it('returns 100 when fully complete', () => {
    const issue = makeIssue({ key: 'A', completedWorkingDays: 10, totalWorkingDays: 10 });
    expect(computePercentComplete(issue)).toBe(100);
  });
});
