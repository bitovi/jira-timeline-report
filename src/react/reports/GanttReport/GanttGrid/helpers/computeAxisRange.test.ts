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

  it('starts the axis at range.from, before today, when a lower bound is chosen', () => {
    const today = new Date('2025-06-15');
    const issues = [makeIssue({ key: 'A', start: new Date('2025-01-10'), due: new Date('2025-02-01') })];
    const { axisStart, axisEnd } = computeAxisRange(issues, today, { from: new Date('2025-01-01') });

    expect(axisStart).toEqual(new Date('2025-01-01'));
    expect(axisEnd).toEqual(new Date('2025-02-01'));
  });

  it('ends the axis at range.to, ignoring the content extent', () => {
    const today = new Date('2025-01-15');
    const issues = [makeIssue({ key: 'A', start: new Date('2025-01-01'), due: new Date('2025-12-01') })];
    const { axisStart, axisEnd } = computeAxisRange(issues, today, { to: new Date('2025-03-31') });

    expect(axisStart).toEqual(today);
    expect(axisEnd).toEqual(new Date('2025-03-31'));
  });

  it('uses both bounds verbatim when the whole window is in the past', () => {
    const today = new Date('2025-06-15');
    const issues = [makeIssue({ key: 'A', start: new Date('2024-01-15'), due: new Date('2024-02-15') })];
    const { axisStart, axisEnd } = computeAxisRange(issues, today, {
      from: new Date('2024-01-01'),
      to: new Date('2024-03-31'),
    });

    expect(axisStart).toEqual(new Date('2024-01-01'));
    expect(axisEnd).toEqual(new Date('2024-03-31'));
  });

  it('rejects an inverted window (from > to) rather than yielding a negative span', () => {
    const today = new Date('2025-01-15');
    const issues = [makeIssue({ key: 'A', start: new Date('2025-07-01'), due: new Date('2025-08-01') })];
    const { axisStart, axisEnd } = computeAxisRange(issues, today, {
      from: new Date('2025-06-01'),
      to: new Date('2025-01-01'),
    });

    expect(axisStart).toEqual(new Date('2025-06-01'));
    expect(axisEnd).toEqual(new Date('2025-08-01'));
    expect(axisEnd.getTime()).toBeGreaterThan(axisStart.getTime());
  });

  it('defaults to from → from+90d when no dated issue survives the window', () => {
    const today = new Date('2025-06-15');
    const { axisStart, axisEnd } = computeAxisRange([], today, { from: new Date('2024-01-01') });

    expect(axisStart).toEqual(new Date('2024-01-01'));
    expect(axisEnd).toEqual(new Date(new Date('2024-01-01').getTime() + 90 * DAY_MS));
  });
});
