import { expect, test, describe, it } from 'vitest';
import { getPercentCompleteForLinkedIssue, sumChildRollups } from './percent-complete';
import type { LinkedIssue } from '../linked-issue';
import type { DerivedWorkTiming } from '../../../../../../jira/derived/work-timing/work-timing';

// Helper function to create a complete DerivedWorkTiming object with defaults
function createDerivedWorkTiming(overrides: Partial<DerivedWorkTiming> = {}): DerivedWorkTiming {
  return {
    isConfidenceValid: false,
    usedConfidence: 50,
    isStoryPointsValid: false,
    defaultOrStoryPoints: 0,
    storyPointsDaysOfWork: 0,
    isStoryPointsMedianValid: false,
    defaultOrStoryPointsMedian: 0,
    storyPointsMedianDaysOfWork: 0,
    deterministicExtraPoints: 0,
    deterministicExtraDaysOfWork: 0,
    deterministicTotalPoints: 0,
    deterministicTotalDaysOfWork: 0,
    probablisticExtraPoints: 0,
    probablisticExtraDaysOfWork: 0,
    probablisticTotalPoints: 0,
    probablisticTotalDaysOfWork: 0,
    hasStartAndDueDate: false,
    startAndDueDateDaysOfWork: null,
    hasSprintStartAndEndDate: false,
    sprintDaysOfWork: null,
    sprintStartData: null,
    endSprintData: null,
    totalDaysOfWork: null,
    defaultOrTotalDaysOfWork: null,
    completedDaysOfWork: 0,
    datesCompletedDaysOfWork: 0,
    datesDaysOfWork: null,
    start: undefined,
    startFrom: undefined,
    due: undefined,
    dueTo: undefined,
    ...overrides,
  };
}

// Define a type for createMockLinkedIssue overrides to properly handle partial derivedTiming
type MockLinkedIssueOverrides = Partial<Omit<LinkedIssue, 'derivedTiming'>> & {
  derivedTiming?: Partial<DerivedWorkTiming>;
};

// Helper function to create mock LinkedIssue objects
export function createMockLinkedIssue(overrides: MockLinkedIssueOverrides = {}): LinkedIssue {
  const { derivedTiming: derivedTimingOverrides, ...otherOverrides } = overrides;

  return {
    key: 'TEST-123',
    summary: 'Test Issue',
    statusCategory: 'To Do',
    linkedChildren: [],
    linkedParent: null,
    linkedBlocks: [],
    linkedBlockedBy: [],
    ...otherOverrides,
    // Create derivedTiming with partial overrides
    derivedTiming: createDerivedWorkTiming(derivedTimingOverrides),
  } as LinkedIssue;
}

describe('getPercentCompleteForLinkedIssue', () => {
  describe('self estimates', () => {
    it('should use self estimates when available', () => {
      const issue = createMockLinkedIssue({
        key: 'ISSUE-1',
        derivedTiming: {
          totalDaysOfWork: 10,
          completedDaysOfWork: 3,
        },
      });

      const result = getPercentCompleteForLinkedIssue(issue);

      expect(result).toEqual({
        userSpecifiedValues: true,
        totalWorkingDays: 10,
        completedWorkingDays: 3,
        remainingWorkingDays: 7,
        source: 'self',
        childrenLinkedIssuesWithoutEstimates: [],
      });
    });

    it('should handle zero completed days', () => {
      const issue = createMockLinkedIssue({
        derivedTiming: {
          totalDaysOfWork: 8,
          completedDaysOfWork: 0,
        },
      });

      const result = getPercentCompleteForLinkedIssue(issue);

      expect(result).toEqual({
        userSpecifiedValues: true,
        totalWorkingDays: 8,
        completedWorkingDays: 0,
        remainingWorkingDays: 8,
        source: 'self',
        childrenLinkedIssuesWithoutEstimates: [],
      });
    });

    it('should handle missing completedDaysOfWork', () => {
      const issue = createMockLinkedIssue({
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: undefined,
        },
      });

      const result = getPercentCompleteForLinkedIssue(issue);

      expect(result).toEqual({
        userSpecifiedValues: true,
        totalWorkingDays: 5,
        completedWorkingDays: 0,
        remainingWorkingDays: 5,
        source: 'self',
        childrenLinkedIssuesWithoutEstimates: [],
      });
    });
  });

  describe('children estimates - all children have estimates', () => {
    it('should use children estimates when all children have user-specified values', () => {
      const child1 = createMockLinkedIssue({
        key: 'CHILD-1',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const child2 = createMockLinkedIssue({
        key: 'CHILD-2',
        derivedTiming: {
          totalDaysOfWork: 8,
          completedDaysOfWork: 4,
        },
      });

      const parent = createMockLinkedIssue({
        key: 'PARENT-1',
        derivedTiming: {
          totalDaysOfWork: null, // Parent has no estimate
          completedDaysOfWork: 0,
        },
        linkedChildren: [child1, child2],
      });

      const result = getPercentCompleteForLinkedIssue(parent);

      expect(result).toEqual({
        userSpecifiedValues: true,
        totalWorkingDays: 13, // 5 + 8
        completedWorkingDays: 6, // 2 + 4
        remainingWorkingDays: 7,
        source: 'children',
        childrenLinkedIssuesWithoutEstimates: [],
      });
    });

    it('should prefer children estimates over parent estimates', () => {
      const child1 = createMockLinkedIssue({
        key: 'CHILD-1',
        derivedTiming: {
          totalDaysOfWork: 3,
          completedDaysOfWork: 1,
        },
      });

      const child2 = createMockLinkedIssue({
        key: 'CHILD-2',
        derivedTiming: {
          totalDaysOfWork: 7,
          completedDaysOfWork: 3,
        },
      });

      const parent = createMockLinkedIssue({
        key: 'PARENT-1',
        derivedTiming: {
          totalDaysOfWork: 20, // Parent has estimate but should be ignored
          completedDaysOfWork: 5,
        },
        linkedChildren: [child1, child2],
      });

      const result = getPercentCompleteForLinkedIssue(parent);

      expect(result).toEqual({
        userSpecifiedValues: true,
        totalWorkingDays: 10, // Uses children: 3 + 7
        completedWorkingDays: 4, // Uses children: 1 + 3
        remainingWorkingDays: 6,
        source: 'children',
        childrenLinkedIssuesWithoutEstimates: [],
      });
    });
  });

  describe('partial children estimates', () => {
    it('should use partial children data and track children without estimates', () => {
      const childWithEstimate = createMockLinkedIssue({
        key: 'CHILD-WITH-EST',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const childWithoutEstimate = createMockLinkedIssue({
        key: 'CHILD-WITHOUT-EST',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
      });

      const parent = createMockLinkedIssue({
        key: 'PARENT-1',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
        linkedChildren: [childWithEstimate, childWithoutEstimate],
      });

      const result = getPercentCompleteForLinkedIssue(parent);

      expect(result).toEqual({
        userSpecifiedValues: false, // Not all children have estimates
        totalWorkingDays: 5, // Only from child with estimate
        completedWorkingDays: 2,
        remainingWorkingDays: 3,
        source: 'children',
        childrenLinkedIssuesWithoutEstimates: [childWithoutEstimate],
      });
    });

    it('should handle multiple children without estimates', () => {
      const childWithEstimate = createMockLinkedIssue({
        key: 'CHILD-WITH-EST',
        derivedTiming: {
          totalDaysOfWork: 8,
          completedDaysOfWork: 3,
        },
      });

      const childWithoutEstimate1 = createMockLinkedIssue({
        key: 'CHILD-WITHOUT-EST-1',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 1,
        },
      });

      const childWithoutEstimate2 = createMockLinkedIssue({
        key: 'CHILD-WITHOUT-EST-2',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
      });

      const parent = createMockLinkedIssue({
        key: 'PARENT-1',
        linkedChildren: [childWithEstimate, childWithoutEstimate1, childWithoutEstimate2],
      });

      const result = getPercentCompleteForLinkedIssue(parent);

      expect(result.childrenLinkedIssuesWithoutEstimates).toEqual([childWithoutEstimate1, childWithoutEstimate2]);
      expect(result.userSpecifiedValues).toBe(false);
      expect(result.source).toBe('children');
    });
  });

  describe('no estimates', () => {
    it('should return empty rollup for leaf node with no estimates', () => {
      const leafIssue = createMockLinkedIssue({
        key: 'LEAF-1',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 2,
        },
        linkedChildren: [], // No children
      });

      const result = getPercentCompleteForLinkedIssue(leafIssue);

      expect(result).toEqual({
        userSpecifiedValues: false,
        totalWorkingDays: 2, // Uses completedDaysOfWork
        completedWorkingDays: 2,
        remainingWorkingDays: 0,
        source: 'empty',
        childrenLinkedIssuesWithoutEstimates: [leafIssue], // Tracks itself
      });
    });

    it('should track all children when parent and all children lack estimates', () => {
      const child1 = createMockLinkedIssue({
        key: 'CHILD-1',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 1,
        },
      });

      const child2 = createMockLinkedIssue({
        key: 'CHILD-2',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
      });

      const parent = createMockLinkedIssue({
        key: 'PARENT-1',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 3,
        },
        linkedChildren: [child1, child2],
      });

      const result = getPercentCompleteForLinkedIssue(parent);

      expect(result).toEqual({
        userSpecifiedValues: false,
        totalWorkingDays: 3, // Uses parent's completedDaysOfWork
        completedWorkingDays: 3,
        remainingWorkingDays: 0,
        source: 'empty',
        childrenLinkedIssuesWithoutEstimates: [child1, child2], // All children tracked
      });
    });

    it('should handle zero completed days when no estimates', () => {
      const issue = createMockLinkedIssue({
        key: 'ZERO-ISSUE',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
        linkedChildren: [],
      });

      const result = getPercentCompleteForLinkedIssue(issue);

      expect(result).toEqual({
        userSpecifiedValues: false,
        totalWorkingDays: 0,
        completedWorkingDays: 0,
        remainingWorkingDays: 0,
        source: 'empty',
        childrenLinkedIssuesWithoutEstimates: [issue],
      });
    });
  });

  describe('nested hierarchies', () => {
    it('should handle deep nested hierarchies correctly', () => {
      // Create a 3-level hierarchy: grandparent -> parent -> child
      const grandchild = createMockLinkedIssue({
        key: 'GRANDCHILD-1',
        derivedTiming: {
          totalDaysOfWork: 4,
          completedDaysOfWork: 1,
        },
        linkedChildren: [],
      });

      const child = createMockLinkedIssue({
        key: 'CHILD-1',
        derivedTiming: {
          totalDaysOfWork: null, // No direct estimate
          completedDaysOfWork: 0,
        },
        linkedChildren: [grandchild],
      });

      const parent = createMockLinkedIssue({
        key: 'PARENT-1',
        derivedTiming: {
          totalDaysOfWork: null, // No direct estimate
          completedDaysOfWork: 0,
        },
        linkedChildren: [child],
      });

      const result = getPercentCompleteForLinkedIssue(parent);

      expect(result).toEqual({
        userSpecifiedValues: true, // Grandchild has estimates
        totalWorkingDays: 4, // From grandchild
        completedWorkingDays: 1, // From grandchild
        remainingWorkingDays: 3,
        source: 'children',
        childrenLinkedIssuesWithoutEstimates: [],
      });
    });

    it('should handle mixed estimates in nested hierarchy', () => {
      const grandchildWithEstimate = createMockLinkedIssue({
        key: 'GRANDCHILD-WITH-EST',
        derivedTiming: {
          totalDaysOfWork: 6,
          completedDaysOfWork: 2,
        },
      });

      const grandchildWithoutEstimate = createMockLinkedIssue({
        key: 'GRANDCHILD-WITHOUT-EST',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 1,
        },
      });

      const child = createMockLinkedIssue({
        key: 'CHILD-1',
        linkedChildren: [grandchildWithEstimate, grandchildWithoutEstimate],
      });

      const parent = createMockLinkedIssue({
        key: 'PARENT-1',
        linkedChildren: [child],
      });

      const result = getPercentCompleteForLinkedIssue(parent);

      expect(result.userSpecifiedValues).toBe(false); // Mixed estimates
      expect(result.totalWorkingDays).toBe(6); // Only from grandchild with estimate
      expect(result.completedWorkingDays).toBe(2);
      expect(result.source).toBe('children');
      expect(result.childrenLinkedIssuesWithoutEstimates).toContain(grandchildWithoutEstimate);
    });
  });

  describe('caching', () => {
    it('should cache results and return same object on subsequent calls', () => {
      const issue = createMockLinkedIssue({
        key: 'CACHED-ISSUE',
        derivedTiming: {
          totalDaysOfWork: 5,
          completedDaysOfWork: 2,
        },
      });

      const result1 = getPercentCompleteForLinkedIssue(issue);
      const result2 = getPercentCompleteForLinkedIssue(issue);

      expect(result1).toBe(result2); // Same object reference
    });

    it('should cache child calculations to avoid recalculation', () => {
      const child = createMockLinkedIssue({
        key: 'CHILD-FOR-CACHE',
        derivedTiming: {
          totalDaysOfWork: 3,
          completedDaysOfWork: 1,
        },
      });

      const parent1 = createMockLinkedIssue({
        key: 'PARENT-1',
        linkedChildren: [child],
      });

      const parent2 = createMockLinkedIssue({
        key: 'PARENT-2',
        linkedChildren: [child], // Same child
      });

      // Calculate for both parents
      const result1 = getPercentCompleteForLinkedIssue(parent1);
      const result2 = getPercentCompleteForLinkedIssue(parent2);

      // Both should have used the cached child result
      expect(result1.totalWorkingDays).toBe(3);
      expect(result2.totalWorkingDays).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined derivedTiming', () => {
      const issue = createMockLinkedIssue({
        key: 'NO-TIMING',
        derivedTiming: undefined,
      });

      const result = getPercentCompleteForLinkedIssue(issue);

      expect(result).toEqual({
        userSpecifiedValues: false,
        totalWorkingDays: 0,
        completedWorkingDays: 0,
        remainingWorkingDays: 0,
        source: 'empty',
        childrenLinkedIssuesWithoutEstimates: [issue],
      });
    });

    it('should handle empty children array', () => {
      const issue = createMockLinkedIssue({
        key: 'EMPTY-CHILDREN',
        derivedTiming: {
          totalDaysOfWork: null,
          completedDaysOfWork: 0,
        },
        linkedChildren: [],
      });

      const result = getPercentCompleteForLinkedIssue(issue);

      expect(result.source).toBe('empty');
      expect(result.childrenLinkedIssuesWithoutEstimates).toEqual([issue]);
    });
  });
});

describe('sumChildRollups', () => {
  it('should sum multiple rollups correctly', () => {
    const rollups = [
      {
        userSpecifiedValues: true,
        totalWorkingDays: 5,
        completedWorkingDays: 2,
        get remainingWorkingDays() {
          return this.totalWorkingDays - this.completedWorkingDays;
        },
        source: 'self' as const,
        childrenLinkedIssuesWithoutEstimates: [],
      },
      {
        userSpecifiedValues: true,
        totalWorkingDays: 8,
        completedWorkingDays: 3,
        get remainingWorkingDays() {
          return this.totalWorkingDays - this.completedWorkingDays;
        },
        source: 'self' as const,
        childrenLinkedIssuesWithoutEstimates: [],
      },
    ];

    const result = sumChildRollups(rollups);

    expect(result).toEqual({
      userSpecifiedValues: true,
      totalWorkingDays: 13,
      completedWorkingDays: 5,
      remainingWorkingDays: 8,
      source: 'children',
      childrenLinkedIssuesWithoutEstimates: [],
    });
  });

  it('should set userSpecifiedValues to false when not all children have specified values', () => {
    const mockIssue = createMockLinkedIssue({ key: 'MOCK' });

    const rollups = [
      {
        userSpecifiedValues: true,
        totalWorkingDays: 5,
        completedWorkingDays: 2,
        get remainingWorkingDays() {
          return this.totalWorkingDays - this.completedWorkingDays;
        },
        source: 'self' as const,
        childrenLinkedIssuesWithoutEstimates: [],
      },
      {
        userSpecifiedValues: false,
        totalWorkingDays: 0,
        completedWorkingDays: 0,
        get remainingWorkingDays() {
          return this.totalWorkingDays - this.completedWorkingDays;
        },
        source: 'empty' as const,
        childrenLinkedIssuesWithoutEstimates: [mockIssue],
      },
    ];

    const result = sumChildRollups(rollups);

    expect(result.userSpecifiedValues).toBe(false);
    expect(result.childrenLinkedIssuesWithoutEstimates).toEqual([mockIssue]);
  });

  it('should handle empty rollups array', () => {
    const result = sumChildRollups([]);

    expect(result).toEqual({
      userSpecifiedValues: true, // vacuous truth - all zero children have specified values
      totalWorkingDays: 0,
      completedWorkingDays: 0,
      remainingWorkingDays: 0,
      source: 'children',
      childrenLinkedIssuesWithoutEstimates: [],
    });
  });

  it('should flatten childrenLinkedIssuesWithoutEstimates from all rollups', () => {
    const issue1 = createMockLinkedIssue({ key: 'ISSUE-1' });
    const issue2 = createMockLinkedIssue({ key: 'ISSUE-2' });
    const issue3 = createMockLinkedIssue({ key: 'ISSUE-3' });

    const rollups = [
      {
        userSpecifiedValues: false,
        totalWorkingDays: 5,
        completedWorkingDays: 2,
        get remainingWorkingDays() {
          return this.totalWorkingDays - this.completedWorkingDays;
        },
        source: 'children' as const,
        childrenLinkedIssuesWithoutEstimates: [issue1, issue2],
      },
      {
        userSpecifiedValues: false,
        totalWorkingDays: 3,
        completedWorkingDays: 1,
        get remainingWorkingDays() {
          return this.totalWorkingDays - this.completedWorkingDays;
        },
        source: 'empty' as const,
        childrenLinkedIssuesWithoutEstimates: [issue3],
      },
    ];

    const result = sumChildRollups(rollups);

    expect(result.childrenLinkedIssuesWithoutEstimates).toEqual([issue1, issue2, issue3]);
  });
});
