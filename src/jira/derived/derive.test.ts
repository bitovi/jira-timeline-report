import { beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import { deriveIssue, DerivedIssue } from './derive';
import { NormalizedIssue } from '../shared/types';
import { deriveWorkTiming, DerivedWorkTiming } from './work-timing/work-timing';
import { getWorkStatus, DerivedWorkStatus } from './work-status/work-status';

vi.mock('./work-timing/work-timing', () => ({
  deriveWorkTiming: vi.fn(),
}));

vi.mock('./work-status/work-status', () => ({
  getWorkStatus: vi.fn(),
}));

const sampleNormalizedIssue = {
  confidence: 80,
  storyPoints: 40,
  storyPointsMedian: 35,
  startDate: new Date('2023-01-01'),
  dueDate: new Date('2023-01-10'),
} as NormalizedIssue;

const sampleDerivedWorkTiming = {
  isConfidenceValid: true,
  usedConfidence: 80,
  isStoryPointsValid: true,
  defaultOrStoryPoints: 40,
  storyPointsDaysOfWork: 4,
  isStoryPointsMedianValid: true,
  defaultOrStoryPointsMedian: 35,
  storyPointsMedianDaysOfWork: 3.5,
  deterministicExtraPoints: 5,
  deterministicExtraDaysOfWork: 0.5,
  deterministicTotalPoints: 40,
  deterministicTotalDaysOfWork: 4,
  probablisticExtraPoints: 4,
  probablisticExtraDaysOfWork: 0.4,
  probablisticTotalPoints: 39,
  probablisticTotalDaysOfWork: 3.9,
  hasStartAndDueDate: true,
  startAndDueDateDaysOfWork: 9,
  hasSprintStartAndEndDate: true,
  sprintDaysOfWork: 7,
  sprintStartData: {
    start: new Date('2023-01-02'),
    startFrom: { message: 'Sprint 1', reference: sampleNormalizedIssue },
  },
  endSprintData: {
    due: new Date('2023-01-09'),
    dueTo: { message: 'Sprint 1', reference: sampleNormalizedIssue },
  },
  start: new Date('2023-01-01'),
  startFrom: { message: 'start from', reference: sampleNormalizedIssue },
  due: new Date('2023-01-10'),
  dueTo: { message: 'due to', reference: sampleNormalizedIssue },
  totalDaysOfWork: 9,
  defaultOrTotalDaysOfWork: 9,
  completedDaysOfWork: 9,
} as DerivedWorkTiming;

const sampleDerivedWorkStatus: DerivedWorkStatus = {
  statusType: 'qa',
  workType: 'qa',
};

describe('derive', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should correctly derive issue with valid data', () => {
    (deriveWorkTiming as Mock).mockReturnValue(sampleDerivedWorkTiming);

    (getWorkStatus as Mock).mockReturnValue(sampleDerivedWorkStatus);

    const result: DerivedIssue = deriveIssue(sampleNormalizedIssue, {
      uncertaintyWeight: 80,
    });

    expect(result).toEqual({
      ...sampleNormalizedIssue,
      derivedTiming: sampleDerivedWorkTiming,
      derivedStatus: sampleDerivedWorkStatus,
    });
  });
});
