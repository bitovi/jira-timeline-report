import { beforeEach, describe, expect, Mock, test, vi } from "vitest";
import { deriveWorkTiming, DerivedWorkTiming } from "./work-timing";
import { NormalizedIssue, NormalizedTeam } from "../../shared/types";
import { estimateExtraPoints, sampleExtraPoints } from "../../../utils/math/confidence";

vi.mock("../../../utils/math/confidence", () => ({
  estimateExtraPoints: vi.fn(),
  sampleExtraPoints: vi.fn(),
}));

describe("work-timing", () => {
  const mockEstimateExtraPoints = estimateExtraPoints as Mock;
  const mockSampleExtraPoints = sampleExtraPoints as Mock;

  const defaultTeam: NormalizedTeam = {
    name: "Team 1",
    daysPerSprint: 10,
    totalPointsPerDay: 50,
    velocity: 100,
    parallelWorkLimit: 5,
    pointsPerDayPerTrack: 10,
    spreadEffortAcrossDates: false,
  };

  const defaultOptions = {
    getDefaultConfidence: (team: NormalizedTeam) => 50,
    getDefaultStoryPoints: (team: NormalizedTeam) => team.velocity / team.parallelWorkLimit,
    uncertaintyWeight: 80,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should correctly derive work timing with valid confidence and story points", () => {
    const normalizedIssue = {
      confidence: 70,
      storyPoints: 40,
      storyPointsMedian: 35,
      team: defaultTeam,
      startDate: new Date("2023-01-01"),
      dueDate: new Date("2023-01-10"),
      sprints: [
        {
          name: "Sprint 1",
          startDate: new Date("2023-01-02"),
          endDate: new Date("2023-01-09"),
        },
      ],
    } as NormalizedIssue;

    mockEstimateExtraPoints.mockReturnValue(5);
    mockSampleExtraPoints.mockReturnValue(4);

    const result: DerivedWorkTiming = deriveWorkTiming(normalizedIssue, defaultOptions);
    expect(result.isConfidenceValid).toBe(true);
    expect(result.usedConfidence).toBe(70);
    expect(result.isStoryPointsValid).toBe(true);
    expect(result.defaultOrStoryPoints).toBe(40);
    expect(result.storyPointsDaysOfWork).toBe(4);
    expect(result.isStoryPointsMedianValid).toBe(true);
    expect(result.defaultOrStoryPointsMedian).toBe(35);
    expect(result.storyPointsMedianDaysOfWork).toBe(3.5);

    expect(result.deterministicExtraPoints).toBe(5);
    expect(result.deterministicExtraDaysOfWork).toBe(0.5);
    expect(result.deterministicTotalPoints).toBe(40);
    expect(result.deterministicTotalDaysOfWork).toBe(4);

    expect(result.probablisticExtraPoints).toBe(4);
    expect(result.probablisticExtraDaysOfWork).toBe(0.4);
    expect(result.probablisticTotalPoints).toBe(39);
    expect(result.probablisticTotalDaysOfWork).toBe(3.9);

    expect(result.hasStartAndDueDate).toBe(true);
    expect(result.startAndDueDateDaysOfWork).toBe(7);

    expect(result.hasSprintStartAndEndDate).toBe(true);
    expect(result.sprintDaysOfWork).toBe(6);

    expect(result.start).toEqual(new Date("2023-01-01"));
    expect(result.startFrom).toEqual({
      message: "start date",
      reference: normalizedIssue,
    });
    expect(result.due).toEqual(new Date("2023-01-10"));
    expect(result.dueTo).toEqual({
      message: "due date",
      reference: normalizedIssue,
    });
    expect(result.sprintStartData).toEqual({
      start: new Date("2023-01-02"),
      startFrom: { message: "Sprint 1", reference: normalizedIssue },
    });
    expect(result.endSprintData).toEqual({
      due: new Date("2023-01-09"),
      dueTo: { message: "Sprint 1", reference: normalizedIssue },
    });

    expect(result.totalDaysOfWork).toBe(7);
    expect(result.defaultOrTotalDaysOfWork).toBe(7);
    expect(result.completedDaysOfWork).toBe(7);
  });

  test("should use default confidence and story points when invalid", () => {
    const normalizedIssue = {
      confidence: null,
      storyPoints: null,
      storyPointsMedian: null,
      team: defaultTeam,
      startDate: new Date("2023-01-01"),
      dueDate: new Date("2023-01-10"),
      sprints: [
        {
          name: "Sprint 1",
          startDate: new Date("2023-01-02"),
          endDate: new Date("2023-01-09"),
        },
      ],
    } as NormalizedIssue;

    mockEstimateExtraPoints.mockReturnValue(0);
    mockSampleExtraPoints.mockReturnValue(0);

    const result: DerivedWorkTiming = deriveWorkTiming(normalizedIssue, defaultOptions);

    expect(result.isConfidenceValid).toBe(false);
    expect(result.usedConfidence).toBe(50);
    expect(result.isStoryPointsValid).toBe(false);
    expect(result.defaultOrStoryPoints).toBe(20);
    expect(result.storyPointsDaysOfWork).toBe(2);
    expect(result.isStoryPointsMedianValid).toBe(false);
    expect(result.defaultOrStoryPointsMedian).toBe(20);
    expect(result.storyPointsMedianDaysOfWork).toBe(2);

    expect(result.deterministicExtraPoints).toBe(0);
    expect(result.deterministicExtraDaysOfWork).toBe(0);
    expect(result.deterministicTotalPoints).toBe(20);
    expect(result.deterministicTotalDaysOfWork).toBe(2);

    expect(result.probablisticExtraPoints).toBe(0);
    expect(result.probablisticExtraDaysOfWork).toBe(0);
    expect(result.probablisticTotalPoints).toBe(20);
    expect(result.probablisticTotalDaysOfWork).toBe(2);

    expect(result.hasStartAndDueDate).toBe(true);
    expect(result.startAndDueDateDaysOfWork).toBe(7);

    expect(result.hasSprintStartAndEndDate).toBe(true);
    expect(result.sprintDaysOfWork).toBe(6);

    expect(result.start).toEqual(new Date("2023-01-01"));
    expect(result.startFrom).toEqual({
      message: "start date",
      reference: normalizedIssue,
    });
    expect(result.due).toEqual(new Date("2023-01-10"));
    expect(result.dueTo).toEqual({
      message: "due date",
      reference: normalizedIssue,
    });
    expect(result.sprintStartData).toEqual({
      start: new Date("2023-01-02"),
      startFrom: { message: "Sprint 1", reference: normalizedIssue },
    });
    expect(result.endSprintData).toEqual({
      due: new Date("2023-01-09"),
      dueTo: { message: "Sprint 1", reference: normalizedIssue },
    });

    expect(result.totalDaysOfWork).toBe(7);
    expect(result.defaultOrTotalDaysOfWork).toBe(7);
    expect(result.completedDaysOfWork).toBe(7);
  });

  test("should handle missing start and due dates by using defaults", () => {
    const normalizedIssue = {
      confidence: 90,
      storyPoints: 50,
      storyPointsMedian: 45,
      team: defaultTeam,
    } as NormalizedIssue;

    mockEstimateExtraPoints.mockReturnValue(0);
    mockSampleExtraPoints.mockReturnValue(0);

    const result = deriveWorkTiming(normalizedIssue, defaultOptions);

    expect(result.isConfidenceValid).toBe(true);
    expect(result.usedConfidence).toBe(90);
    expect(result.isStoryPointsValid).toBe(true);
    expect(result.defaultOrStoryPoints).toBe(50);
    expect(result.storyPointsDaysOfWork).toBe(5);
    expect(result.isStoryPointsMedianValid).toBe(true);
    expect(result.defaultOrStoryPointsMedian).toBe(45);
    expect(result.storyPointsMedianDaysOfWork).toBe(4.5);

    expect(result.deterministicExtraDaysOfWork).toBe(0);
    expect(result.deterministicTotalPoints).toBe(45);
    expect(result.deterministicTotalDaysOfWork).toBe(4.5);

    expect(result.probablisticExtraPoints).toBe(0);
    expect(result.probablisticExtraDaysOfWork).toBe(0);
    expect(result.probablisticTotalPoints).toBe(45);
    expect(result.probablisticTotalDaysOfWork).toBe(4.5);

    expect(result.startAndDueDateDaysOfWork).toBeNull();

    expect(result.hasSprintStartAndEndDate).toBe(false);
    expect(result.sprintDaysOfWork).toBeNull();

    expect(result.start).toBeUndefined();
    expect(result.startFrom).toBeUndefined();
    expect(result.due).toBeUndefined();
    expect(result.dueTo).toBeUndefined();
    expect(result.sprintStartData).toBeNull();
    expect(result.endSprintData).toBeNull();

    expect(result.totalDaysOfWork).toBe(4.5);
    expect(result.defaultOrTotalDaysOfWork).toBe(4.5);
    expect(result.completedDaysOfWork).toBe(0);
  });
});
