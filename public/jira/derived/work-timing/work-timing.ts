import { getBusinessDatesCount } from "../../../status-helpers";
import {
  estimateExtraPoints,
  sampleExtraPoints,
} from "../../../shared/confidence";
import {
  DueData,
  getStartDateAndDueDataFromFieldsOrSprints,
  getStartDateAndDueDataFromSprints,
  StartData,
} from "../../../shared/issue-data/date-data";
import {
  DefaultsToConfig,
  NormalizedIssue,
  NormalizedTeam,
} from "../../shared/types";

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
  datesDaysOfWork: number | null;
} & Partial<StartData> &
  Partial<DueData>;

/**
 * @param {NormalizedTeam} team
 * @returns {number}
 */
export function getDefaultConfidenceDefault(team: NormalizedTeam): number {
  return 50;
}

/**
 *
 * @param {NormalizedTeam} team
 * @returns number
 */
export function getDefaultStoryPointsDefault(team: NormalizedTeam): number {
  return team.velocity / team.parallelWorkLimit;
}

const defaults = {
  getDefaultConfidenceDefault,
  getDefaultStoryPointsDefault,
};

export type WorkTimingConfig = DefaultsToConfig<typeof defaults>;

/**
 *
 * @param {import("../../shared/types.js").NormalizedIssue} normalizedIssue
 * @param {Partial<WorkTimingConfig> & { uncertaintyWeight?: number }} options
 * @returns {DerivedWorkTiming}
 */
export function deriveWorkTiming(
  normalizedIssue: NormalizedIssue,
  {
    getDefaultConfidence = getDefaultConfidenceDefault,
    getDefaultStoryPoints = getDefaultStoryPointsDefault,
    uncertaintyWeight = 80,
  }: Partial<WorkTimingConfig> & { uncertaintyWeight?: number } = {}
): DerivedWorkTiming {

  const isConfidenceValid = isConfidenceValueValid(normalizedIssue.confidence);
  
  const usedConfidence = isConfidenceValid
    ? normalizedIssue.confidence!
    : getDefaultConfidence(normalizedIssue.team);
  
  const isStoryPointsValid = isStoryPointsValueValid(
    normalizedIssue.storyPoints
  );
  const defaultOrStoryPoints = isStoryPointsValid
    ? normalizedIssue.storyPoints!
    : getDefaultStoryPoints(normalizedIssue.team);
  
  const storyPointsDaysOfWork =
    defaultOrStoryPoints / normalizedIssue.team.pointsPerDayPerTrack;
  
  const isStoryPointsMedianValid = isStoryPointsValueValid(
    normalizedIssue.storyPointsMedian
  );

  const defaultOrStoryPointsMedian = isStoryPointsMedianValid
    ? normalizedIssue.storyPointsMedian!
    : getDefaultStoryPoints(normalizedIssue.team);

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
    ? getBusinessDatesCount(sprintStartData?.start, endSprintData?.due)
    : null;

  const { startData, dueData } =
    getStartDateAndDueDataFromFieldsOrSprints(normalizedIssue);

  const datesDaysOfWork = startData && dueData ? getBusinessDatesCount(startData.start, dueData.due) : null;

  let totalDaysOfWork = null;
  if (datesDaysOfWork != null) {
    totalDaysOfWork = datesDaysOfWork;
  } else if (isStoryPointsMedianValid) {
    totalDaysOfWork = deterministicTotalDaysOfWork;
  } else if (isStoryPointsValid) {
    totalDaysOfWork = storyPointsDaysOfWork;
  }

  // defaultOrTotalDaysOfWork - will be 50% confidence of 1 sprint of work 
  // Used if there is no estimate.  I don't think we need or should use this value.
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

    datesDaysOfWork,
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
