
import { getBusinessDatesCount } from "../../../status-helpers.js";
import { estimateExtraPoints, sampleExtraPoints } from "../../../shared/confidence.js";
import { getStartDateAndDueDataFromFieldsOrSprints, getStartDateAndDueDataFromSprints } from "../../../shared/issue-data/date-data.js";
import { normalizeIssue } from "../../normalized/normalize.js";
import { getWorkStatus } from "../work-status/work-status.js";

  /**
   * @param {NormalizedTeam} team
   * @returns {number}
   */
  export function getDefaultConfidenceDefault(team) {
    return 50
  }



/**
 * 
 * @param {NormalizedTeam} team 
 * @returns number
 */
export function getDefaultStoryPointsDefault(team) {
  return team.velocity / team.parallelWorkLimit;
}


/**
 * 
 * @param {import("../../normalized/normalize.js").NormalizedIssue} normalizedIssue 
 * @param {*} param1 
 * @returns {DerivedTiming}
 */
export function deriveWorkTiming(normalizedIssue, {
  getDefaultConfidence = getDefaultConfidenceDefault, 
  getDefaultStoryPoints = getDefaultStoryPointsDefault, 
  uncertaintyWeight = 80
} = {}){

  const isConfidenceValid = isConfidenceValueValid(normalizedIssue.confidence),
    usedConfidence = isConfidenceValid ? normalizedIssue.confidence : getDefaultConfidence(normalizedIssue.team),
    
    isStoryPointsValid = isStoryPointsValueValid(normalizedIssue.storyPoints),
    defaultOrStoryPoints = isStoryPointsValid ? normalizedIssue.storyPoints :  getDefaultStoryPoints(normalizedIssue.team),
    storyPointsDaysOfWork = (defaultOrStoryPoints) / normalizedIssue.team.pointsPerDayPerTrack,
    
    isStoryPointsMedianValid = isStoryPointsValueValid(normalizedIssue.storyPointsMedian),
    defaultOrStoryPointsMedian = isStoryPointsMedianValid ? normalizedIssue.storyPointsMedian :  getDefaultStoryPoints(normalizedIssue.team),
    storyPointsMedianDaysOfWork = (defaultOrStoryPointsMedian) / normalizedIssue.team.pointsPerDayPerTrack,
    
    deterministicExtraPoints = estimateExtraPoints(defaultOrStoryPointsMedian, usedConfidence, uncertaintyWeight),
    deterministicExtraDaysOfWork = deterministicExtraPoints / normalizedIssue.team.pointsPerDayPerTrack,
    deterministicTotalPoints = defaultOrStoryPointsMedian + deterministicExtraPoints,
    deterministicTotalDaysOfWork = deterministicTotalPoints/ normalizedIssue.team.pointsPerDayPerTrack,
    
    probablisticExtraPoints = sampleExtraPoints(defaultOrStoryPointsMedian, usedConfidence),
    probablisticExtraDaysOfWork = probablisticExtraPoints / normalizedIssue.team.pointsPerDayPerTrack,
    probablisticTotalPoints = defaultOrStoryPointsMedian + probablisticExtraPoints,
    probablisticTotalDaysOfWork = probablisticTotalPoints / normalizedIssue.team.pointsPerDayPerTrack,

    hasStartAndDueDate = normalizedIssue.dueDate &&  normalizedIssue.startDate,
    startAndDueDateDaysOfWork = hasStartAndDueDate ? getBusinessDatesCount(normalizedIssue.startDate, normalizedIssue.dueDate) : null;

  const {startData: sprintStartData, dueData: endSprintData} = getStartDateAndDueDataFromSprints(normalizedIssue);
  const hasSprintStartAndEndDate = !!(sprintStartData && endSprintData),
    sprintDaysOfWork = hasSprintStartAndEndDate ? getBusinessDatesCount(sprintStartData.start, endSprintData.due) : null

  const {startData, dueData} = getStartDateAndDueDataFromFieldsOrSprints(normalizedIssue);


  let totalDaysOfWork = null;
  if(startData && dueData) {
    totalDaysOfWork = getBusinessDatesCount(startData.start, dueData.due);
  } else if(isStoryPointsMedianValid) {
    totalDaysOfWork = deterministicTotalDaysOfWork;
  } else if(isStoryPointsMedianValid) {
    totalDaysOfWork = storyPointsDaysOfWork;
  }

  const defaultOrTotalDaysOfWork = totalDaysOfWork !== null ? totalDaysOfWork : deterministicTotalDaysOfWork;

  const completedDaysOfWork = getSelfCompletedDays(startData, dueData, totalDaysOfWork);

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
    completedDaysOfWork
  }
}


/**
 * @typedef {{
* isConfidenceValid: boolean,
* usedConfidence: number,
* isStoryPointsValid: boolean,
* defaultOrStoryPoints: number,
* storyPointsDaysOfWork: number,
* deterministicTotalPoints: number,
* isStoryPointsMedianValid: boolean,
* defaultOrStoryPointsMedian: number,
* storyPointsMedianDaysOfWork: number,
* deterministicExtraDaysOfWork: number,
* deterministicTotalDaysOfWork: number,
* probablisticExtraDaysOfWork: number,
* probablisticTotalDaysOfWork: number,
* hasStartAndDueDate: boolean,
* hasSprintStartAndEndDate: boolean,
* sprintDaysOfWork: number | null,
* startAndDueDateDaysOfWork: number | null,
* totalDaysOfWork: number | null,
* defaultOrTotalDaysOfWork: number | null,
* completedDaysOfWork: number,
* startData: ,
* dueData: ,
* } & import("../../../shared/issue-data/date-data.js").StartData & import("../../../shared/issue-data/date-data.js").DueData
* } DerivedTiming
*/


export function isConfidenceValueValid(value){
  return value && value > 0 && value <=100;
}

export function isStoryPointsValueValid(value){
  return value && value >= 0;
}

/**
 * 
 * @param {import("../../../shared/issue-data/date-data.js").StartData} startData 
 * @param {import("../../../shared/issue-data/date-data.js").DueData} dueData
 * @returns number
 */
function getSelfCompletedDays(startData, dueData, daysOfWork) {
  // These are cases where the child issue (Epic) has a valid estimation

  if(startData && startData.start < new Date() ) {
    if(!dueData || dueData.due > new Date() ) {
      return getBusinessDatesCount( startData.start, new Date() )
    } else {
      return getBusinessDatesCount( startData.start, dueData.due )
    }
  } 
  // if there's an end date in the past ... 
  else if(dueData && dueData.due < new Date()) {
    return daysOfWork || 0;
  } else {
    return 0;
  }
}

/**
 * 
 * @param {DerivedWorkIssue} derivedIssue
 */
export function derivedToCSVFormat(derivedIssue) {
  return  {
    ...derivedIssue.issue.fields,
    changelog: derivedIssue.issue.changelog,
    "Project key": derivedIssue.team.name,
    "Issue key": derivedIssue.key,
    url: derivedIssue.url,
    "Issue Type": derivedIssue.type,
    "Parent Link": derivedIssue.parentKey,
    "Status": derivedIssue.status,
    workType: derivedIssue.derivedStatus.workType,
    workingBusinessDays: derivedIssue.derivedTiming.totalDaysOfWork,
    weightedEstimate: derivedIssue.derivedTiming.deterministicTotalPoints
  }
}



