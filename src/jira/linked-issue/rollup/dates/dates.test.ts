import { describe, test, expect, beforeEach } from 'vitest';
import type { LinkedIssue } from '../../linked-issue';
import { getDateRollupForLinkedIssue, addDateRollupsToLinkedIssues, clearDateRollupCache } from './dates';

// Simple mock factory
const createMockLinkedIssue = (
  key: string,
  dateData: { start?: Date; due?: Date } = {},
  children: LinkedIssue[] = [],
): LinkedIssue => {
  const derivedTiming = {
    ...dateData,
    ...(dateData.start && { startFrom: { message: 'test', reference: {} as any } }),
    ...(dateData.due && { dueTo: { message: 'test', reference: {} as any } }),
  };

  return {
    key,
    derivedTiming,
    linkedChildren: children,
    // Minimal required properties
    summary: `Test ${key}`,
    type: 'Story',
    team: { name: 'Test Team' },
  } as any as LinkedIssue;
};

describe('linked-issue date rollups', () => {
  beforeEach(() => {
    clearDateRollupCache();
  });

  test('should return empty rollup for issue with no dates', () => {
    const issue = createMockLinkedIssue('TEST-1');
    const rollup = getDateRollupForLinkedIssue(issue);
    expect(rollup).toEqual({});
  });

  test('should return parent dates when parent has dates and no children', () => {
    const startDate = new Date('2024-01-01');
    const dueDate = new Date('2024-01-10');

    const issue = createMockLinkedIssue('TEST-1', { start: startDate, due: dueDate });
    const rollup = getDateRollupForLinkedIssue(issue);

    expect(rollup.start).toEqual(startDate);
    expect(rollup.due).toEqual(dueDate);
  });

  test('should return widest range from parent and children', () => {
    const parentStart = new Date('2024-01-05');
    const parentDue = new Date('2024-01-15');
    const childStart = new Date('2024-01-01'); // Earlier than parent
    const childDue = new Date('2024-01-20'); // Later than parent

    const child = createMockLinkedIssue('TEST-2', { start: childStart, due: childDue });
    const parent = createMockLinkedIssue('TEST-1', { start: parentStart, due: parentDue }, [child]);

    const rollup = getDateRollupForLinkedIssue(parent);

    // Should take earliest start (child) and latest due (child)
    expect(rollup.start).toEqual(childStart);
    expect(rollup.due).toEqual(childDue);
  });

  test('should add rollup data to array of linked issues', () => {
    const issue1Start = new Date('2024-01-01');
    const issue1Due = new Date('2024-01-10');
    const issue2Start = new Date('2024-02-01');
    const issue2Due = new Date('2024-02-10');

    const issue1 = createMockLinkedIssue('TEST-1', { start: issue1Start, due: issue1Due });
    const issue2 = createMockLinkedIssue('TEST-2', { start: issue2Start, due: issue2Due });

    const issues = [issue1, issue2];
    const result = addDateRollupsToLinkedIssues(issues);

    expect(result).toHaveLength(2);
    expect(result[0].rollupDates.start).toEqual(issue1Start);
    expect(result[0].rollupDates.due).toEqual(issue1Due);
    expect(result[1].rollupDates.start).toEqual(issue2Start);
    expect(result[1].rollupDates.due).toEqual(issue2Due);
  });
});
