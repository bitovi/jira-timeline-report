import { describe, it, expect } from 'vitest';
import {
  totalWorkingDaysReducer,
  completedWorkingDaysReducer,
  workingDaysCompletionPercentageReducer,
  workingDaysBreakdownReducer,
  issuesWithoutAnyEstimatesReducer,
} from './total-working-days-reducers';
import { createMockLinkedIssue } from '../jira/linked-issue/percent-complete/percent-complete.test';

describe('Total Working Days Reducers', () => {
  const mockGroupContext = {};

  describe('totalWorkingDaysReducer', () => {
    it('should sum total working days across issues', () => {
      const issue1 = createMockLinkedIssue({
        key: 'ISSUE-1',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const issue2 = createMockLinkedIssue({
        key: 'ISSUE-2',
        derivedTiming: {
          totalDaysOfWork: 3,
          completedDaysOfWork: 1,
        },
      });

      let acc = totalWorkingDaysReducer.initial(mockGroupContext);
      acc = totalWorkingDaysReducer.update(acc, issue1, mockGroupContext);
      acc = totalWorkingDaysReducer.update(acc, issue2, mockGroupContext);

      expect(acc).toBe(8); // 5 + 3
    });

    it('should handle issues without estimates', () => {
      const issueWithEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITH-EST',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const issueWithoutEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITHOUT-EST',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
      });

      let acc = totalWorkingDaysReducer.initial(mockGroupContext);
      acc = totalWorkingDaysReducer.update(acc, issueWithEstimate, mockGroupContext);
      acc = totalWorkingDaysReducer.update(acc, issueWithoutEstimate, mockGroupContext);

      expect(acc).toBe(5); // Only the estimate from the first issue
    });
  });

  describe('completedWorkingDaysReducer', () => {
    it('should sum completed working days across issues', () => {
      const issue1 = createMockLinkedIssue({
        key: 'ISSUE-1',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const issue2 = createMockLinkedIssue({
        key: 'ISSUE-2',
        derivedTiming: {
          totalDaysOfWork: 3,
          completedDaysOfWork: 1,
        },
      });

      let acc = completedWorkingDaysReducer.initial(mockGroupContext);
      acc = completedWorkingDaysReducer.update(acc, issue1, mockGroupContext);
      acc = completedWorkingDaysReducer.update(acc, issue2, mockGroupContext);

      expect(acc).toBe(3); // 2 + 1
    });
  });

  describe('workingDaysCompletionPercentageReducer', () => {
    it('should calculate completion percentage correctly', () => {
      const issue1 = createMockLinkedIssue({
        key: 'ISSUE-1',
        derivedTiming: {
          totalDaysOfWork: 10,
          completedDaysOfWork: 5,
        },
      });

      const issue2 = createMockLinkedIssue({
        key: 'ISSUE-2',
        derivedTiming: {
          totalDaysOfWork: 6,
          completedDaysOfWork: 3,
        },
      });

      let acc = workingDaysCompletionPercentageReducer.initial(mockGroupContext);
      acc = workingDaysCompletionPercentageReducer.update(acc, issue1, mockGroupContext);
      acc = workingDaysCompletionPercentageReducer.update(acc, issue2, mockGroupContext);

      // Total: 16 days, Completed: 8 days = 50%
      expect(acc.totalWorkingDays).toBe(16);
      expect(acc.completedWorkingDays).toBe(8);
    });

    it('should handle zero total working days', () => {
      const issueWithoutEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITHOUT-EST',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
      });

      let acc = workingDaysCompletionPercentageReducer.initial(mockGroupContext);
      acc = workingDaysCompletionPercentageReducer.update(acc, issueWithoutEstimate, mockGroupContext);

      expect(acc.totalWorkingDays).toBe(0);
      expect(acc.completedWorkingDays).toBe(0);
    });
  });

  describe('workingDaysBreakdownReducer', () => {
    it('should track issues with and without estimates', () => {
      const issueWithEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITH-EST',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const issueWithoutEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITHOUT-EST',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
      });

      let acc = workingDaysBreakdownReducer.initial(mockGroupContext);
      acc = workingDaysBreakdownReducer.update(acc, issueWithEstimate, mockGroupContext);
      acc = workingDaysBreakdownReducer.update(acc, issueWithoutEstimate, mockGroupContext);

      expect(acc.totalWorkingDays).toBe(5); // Only from issue with estimate
      expect(acc.completedWorkingDays).toBe(2);
      expect(acc.issueCount).toBe(2);
      expect(acc.issuesWithEstimates).toBe(1);
      expect(acc.issuesWithoutEstimates).toBe(1);
    });
  });

  describe('issuesWithoutAnyEstimatesReducer', () => {
    it('should collect only issues with source "empty"', () => {
      const issueWithEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITH-EST',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const issueWithoutEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITHOUT-EST',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
      });

      let acc = issuesWithoutAnyEstimatesReducer.initial(mockGroupContext);
      acc = issuesWithoutAnyEstimatesReducer.update(acc, issueWithEstimate, mockGroupContext);
      acc = issuesWithoutAnyEstimatesReducer.update(acc, issueWithoutEstimate, mockGroupContext);

      expect(acc).toHaveLength(1);
      expect(acc[0].key).toBe('ISSUE-WITHOUT-EST');
    });

    it('should return empty array when all issues have estimates', () => {
      const issueWithEstimate = createMockLinkedIssue({
        key: 'ISSUE-WITH-EST',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      let acc = issuesWithoutAnyEstimatesReducer.initial(mockGroupContext);
      acc = issuesWithoutAnyEstimatesReducer.update(acc, issueWithEstimate, mockGroupContext);

      expect(acc).toHaveLength(0);
    });
  });
});
