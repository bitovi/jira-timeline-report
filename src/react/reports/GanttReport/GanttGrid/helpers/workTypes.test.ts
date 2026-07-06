import { describe, expect, it } from 'vitest';
import { computeWorkTypesWithWork } from './workTypes';
import { breakdownIssues, makeIssue } from '../fixtures';

describe('computeWorkTypesWithWork', () => {
  it('marks a work type as having work when at least one issue has issueKeys', () => {
    const result = computeWorkTypesWithWork(breakdownIssues);
    expect(result).toEqual([
      { type: 'design', hasWork: false },
      { type: 'dev', hasWork: true },
      { type: 'qa', hasWork: true },
      { type: 'uat', hasWork: true },
    ]);
  });

  it('marks all work types as false when no issue has work-type rollups', () => {
    const result = computeWorkTypesWithWork([makeIssue({ key: 'A' })]);
    expect(result.every((w) => w.hasWork === false)).toBe(true);
  });
});
