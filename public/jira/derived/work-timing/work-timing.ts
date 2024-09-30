import { getBusinessDatesCount } from "../../../status-helpers.js";
import {
  estimateExtraPoints,
  sampleExtraPoints,
} from "../../../shared/confidence.js";
import {
  DueData,
  getStartDateAndDueDataFromFieldsOrSprints,
  getStartDateAndDueDataFromSprints,
  StartData,
} from "../../../shared/issue-data/date-data.js";
import {
  DefaultsToConfig,
  NormalizedIssue,
  NormalizedTeam,
} from "../../shared/types.js";

export type DerivedWorkTiming = {
  isConfidenceValid: boolean;
  usedConfidence: number;
  isStoryPointsValid: boolean;
  defaultOrStoryPoints: number;
  storyPointsDaysOfWork: number;
  isStoryPointsMedianValid: boolean;
  defaultOrStoryPointsMedian: number;
  storyPointsMedianDaysOfWork: number;
  deterministicExtraPoints: number;
  deterministicExtraDaysOfWork: number;
  deterministicTotalPoints: number;
  deterministicTotalDaysOfWork: number;
  probablisticExtraPoints: number;
  probablisticExtraDaysOfWork: number;
  probablisticTotalPoints: number;
  probablisticTotalDaysOfWork: number;
  hasStartAndDueDate: boolean;
  startAndDueDateDaysOfWork: number | null;
  hasSprintStartAndEndDate: boolean;
  sprintDaysOfWork: number | null;
  sprintStartData: StartData;
  endSprintData: DueData;
  totalDaysOfWork: number | null;
  defaultOrTotalDaysOfWork: number | null;
  completedDaysOfWork: number;
} & StartData &
  DueData;

/**
 * @param {NormalizedTeam} team
 * @returns {number}
 */
export function getConfidenceDefault(team: NormalizedTeam) {
  return 50;
}

/**
 *
 * @param {NormalizedTeam} team
 * @returns number
 */
export function getStoryPointsDefault(team: NormalizedTeam) {
  return team.velocity / team.parallelWorkLimit;
}

const defaults = {
  getConfidenceDefault,
  getStoryPointsDefault,
};

export type WorkTimingConfig = DefaultsToConfig<typeof defaults>;

/**
 *
 * @param {import("../../shared/types.js").NormalizedIssue} normalizedIssue
 * @param {*} param1
 * @returns {DerivedWorkTiming}
 */
export function deriveWorkTiming(
  normalizedIssue: NormalizedIssue,
  {
    getConfidence = getConfidenceDefault,
    getStoryPoints = getStoryPointsDefault,
    uncertaintyWeight = 80,
  }: Partial<WorkTimingConfig> & { uncertaintyWeight?: number } = {}
) {
  const isConfidenceValid = isConfidenceValueValid(normalizedIssue.confidence);
  const usedConfidence = isConfidenceValid
    ? normalizedIssue.confidence!
    : getConfidence(normalizedIssue.team);
  const isStoryPointsValid = isStoryPointsValueValid(
    normalizedIssue.storyPoints
  );
  const defaultOrStoryPoints = isStoryPointsValid
    ? normalizedIssue.storyPoints!
    : getStoryPoints(normalizedIssue.team);
  const storyPointsDaysOfWork =
    defaultOrStoryPoints / normalizedIssue.team.pointsPerDayPerTrack;
  const isStoryPointsMedianValid = isStoryPointsValueValid(
    normalizedIssue.storyPointsMedian
  );
  const defaultOrStoryPointsMedian = isStoryPointsMedianValid
    ? normalizedIssue.storyPointsMedian!
    : getStoryPoints(normalizedIssue.team);
  const storyPointsMedianDaysOfWork =
    defaultOrStoryPointsMedian / normalizedIssue.team.pointsPerDayPerTrack;
  const deterministicExtraPoints = estimateExtraPoints(
    defaultOrStoryPointsMedian,
    usedConfidence,
    uncertaintyWeight
  );
  const deterministicExtraDaysOfWork =
    deterministicExtraPoints / normalizedIssue.team.pointsPerDayPerTrack;
  const deterministicTotalPoints =
    defaultOrStoryPointsMedian + deterministicExtraPoints;
  const deterministicTotalDaysOfWork =
    deterministicTotalPoints / normalizedIssue.team.pointsPerDayPerTrack;
  const probablisticExtraPoints = sampleExtraPoints(
    defaultOrStoryPointsMedian,
    usedConfidence
  );
  const probablisticExtraDaysOfWork =
    probablisticExtraPoints / normalizedIssue.team.pointsPerDayPerTrack;
  const probablisticTotalPoints =
    defaultOrStoryPointsMedian + probablisticExtraPoints;
  const probablisticTotalDaysOfWork =
    probablisticTotalPoints / normalizedIssue.team.pointsPerDayPerTrack;
  const hasStartAndDueDate = Boolean(
    normalizedIssue.dueDate && normalizedIssue.startDate
  );
  const startAndDueDateDaysOfWork = hasStartAndDueDate
    ? getBusinessDatesCount(normalizedIssue.startDate, normalizedIssue.dueDate)
    : null;

  const { startData: sprintStartData, dueData: endSprintData } =
    getStartDateAndDueDataFromSprints(normalizedIssue);
  const hasSprintStartAndEndDate = Boolean(sprintStartData && endSprintData);
  let sprintDaysOfWork = hasSprintStartAndEndDate
    ? getBusinessDatesCount(sprintStartData.start, endSprintData.due)
    : null;

  const { startData, dueData } =
    getStartDateAndDueDataFromFieldsOrSprints(normalizedIssue);

  let totalDaysOfWork = null;
  if (startData && dueData) {
    totalDaysOfWork = getBusinessDatesCount(startData.start, dueData.due);
  } else if (isStoryPointsMedianValid) {
    totalDaysOfWork = deterministicTotalDaysOfWork;
  } else if (isStoryPointsValid) {
    totalDaysOfWork = storyPointsDaysOfWork;
  }

  const defaultOrTotalDaysOfWork =
    totalDaysOfWork !== null ? totalDaysOfWork : deterministicTotalDaysOfWork;

  const completedDaysOfWork = getSelfCompletedDays(
    startData,
    dueData,
    totalDaysOfWork
  );

  return {
    isConfidenceValid,
    usedConfidence,

    isStoryPointsValid,
    defaultOrStoryPoints,
    storyPointsDaysOfWork,

    isStoryPointsMedianValid,
    defaultOrStoryPointsMedian,
    storyPointsMedianDaysOfWork,

    deterministicExtraPoints,
    deterministicExtraDaysOfWork,
    deterministicTotalPoints,
    deterministicTotalDaysOfWork,

    probablisticExtraPoints,
    probablisticExtraDaysOfWork,
    probablisticTotalPoints,
    probablisticTotalDaysOfWork,

    hasStartAndDueDate,
    startAndDueDateDaysOfWork,

    hasSprintStartAndEndDate,
    sprintDaysOfWork,

    sprintStartData,
    endSprintData,

    ...startData,
    ...dueData,

    totalDaysOfWork,
    defaultOrTotalDaysOfWork,
    completedDaysOfWork,
  };
}

export function isConfidenceValueValid(value: number | null): value is number {
  return value !== null && value > 0 && value <= 100;
}

export function isStoryPointsValueValid(value: number | null): value is number {
  return value !== null && value >= 0;
}

/**
 *
 * @param {import("../../../shared/issue-data/date-data.js").StartData} startData
 * @param {import("../../../shared/issue-data/date-data.js").DueData} dueData
 * @returns number
 */
function getSelfCompletedDays(
  startData: StartData,
  dueData: DueData,
  daysOfWork: number | null
): number {
  // These are cases where the child issue (Epic) has a valid estimation

  if (startData && startData.start < new Date()) {
    if (!dueData || dueData.due > new Date()) {
      return getBusinessDatesCount(startData.start, new Date());
    } else {
      return getBusinessDatesCount(startData.start, dueData.due);
    }
  }
  // if there's an end date in the past ...
  else if (dueData && dueData.due < new Date()) {
    return daysOfWork || 0;
  } else {
    return 0;
  }
}
