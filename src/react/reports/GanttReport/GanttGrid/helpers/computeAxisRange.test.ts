import { describe, expect, it } from 'vitest';
import { computeAxisRange } from './computeAxisRange';
import { makeIssue } from '../fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('computeAxisRange', () => {
  it('defaults to today → today+90d for an empty list', () => {
    const today = new Date('2025-01-15');
    const { axisStart, axisEnd } = computeAxisRange([], today);

    expect(axisStart).toEqual(today);
    expect(axisEnd).toEqual(new Date(today.getTime() + 90 * DAY_MS));
  });

  it('defaults due to start+90d when all issues are missing a due date', () => {
    const today = new Date('2025-01-15');
    const issues = [makeIssue({ key: 'A', start: new Date('2025-01-01') })];
    const { axisStart, axisEnd } = computeAxisRange(issues, today);

    expect(axisStart).toEqual(today);
    expect(axisEnd).toEqual(new Date(new Date('2025-01-01').getTime() + 90 * DAY_MS));
  });

  it('clamps to today+90d when the latest due date is in the past', () => {
    const today = new Date('2025-01-15');
    const issues = [makeIssue({ key: 'A', start: new Date('2024-10-01'), due: new Date('2024-11-01') })];
    const { axisStart, axisEnd } = computeAxisRange(issues, today);

    expect(axisStart).toEqual(today);
    expect(axisEnd).toEqual(new Date(today.getTime() + 90 * DAY_MS));
  });

  it('axisStart is always today, axisEnd is the latest due date across all issues', () => {
    const today = new Date('2025-01-15');
    const issues = [
      makeIssue({ key: 'A', start: new Date('2025-01-01'), due: new Date('2025-02-01') }),
      makeIssue({ key: 'B', start: new Date('2025-01-10'), due: new Date('2025-03-14') }),
    ];
    const { axisStart, axisEnd } = computeAxisRange(issues, today);

    expect(axisStart).toEqual(today);
    expect(axisEnd).toEqual(new Date('2025-03-14'));
  });
});
