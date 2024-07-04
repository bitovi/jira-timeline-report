import { parseDate8601String } from "../../date-helpers.js";
import { getBusinessDatesCount } from "../../status-helpers.js";
import { estimateExtraPoints, sampleExtraPoints } from "../confidence.js";
import { DAY_IN_MS } from "../../date-helpers.js";
import { parseDateISOString } from "../../date-helpers.js";
import { getStartDateAndDueDataFromFieldsOrSprints, getStartDateAndDueDataFromSprints } from "./date-data.js";

/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getConfidenceDefault({ fields }) {
  return fields["Story points confidence"] || fields.Confidence;
}
/**
 * @param {NormalizedTeam} team
 * @returns {number}
 */
export function getDefaultConfidenceDefault(team) {
  return 50
}
/**
 * @param {string} teamKey
 * @returns {number}
 */
export function getDaysPerSprintDefault(teamKey) {
  return 10;
}

/**
 * @param {JiraIssue} issue
 * @returns {string | null}
 */
export function getDueDateDefault({ fields }) {
  return fields["Due date"];
}

/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getHierarchyLevelDefault({ fields }) {
  return fields["Issue Type"].hierarchyLevel;
}

/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getIssueKeyDefault({ key }) {
  return key;
}

/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getParentKeyDefault({ fields }) {
  return fields["Parent"]?.key || fields["Parent Link"].data?.key;
}

/**
 * @param {JiraIssue} issue
 * @returns {string | null}
 */
export function getStartDateDefault({ fields }) {
  return fields["Start date"];
}

/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getStoryPointsDefault({ fields }) {
  return fields["Story points"];
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
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getStoryPointsMedianDefault({ fields }) {
  return fields["Story points median"];
}

/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getUrlDefault({ key }) {
  return "javascript://"
}

/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getTeamKeyDefault({key}) {
  return key.replace(/-.*/, "")
}

/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getTypeDefault({ fields }) {
  return fields["Issue Type"].name;
}

/**
 * @param {string} teamKey
 * @returns {number}
 */
export function getVelocityDefault(teamKey) {
  return 21;
}

export function getParallelWorkLimitDefault(teamKey) {
  return 1;
}
export function getSprintsDefault({fields}){
  if(fields.Sprint) {
    return fields.Sprint.map((sprint)=>{
      return {
        name: sprint.name,
        startDate: parseDateISOString(sprint["startDate"]),
        endDate: parseDateISOString(sprint["endDate"])
      }
    })
  } else {
    return  null;
  }
}

/**
 * @typedef {{
 * fields: {
 *   Confidence: number,
 *   'Due date': string | null,
 *   'Issue Type': { hierarchyLevel: number, name: string },
 *   'Parent Link': { data: { key: string } },
 *   'Project Key': string,
 *   'Start date': string | null,
 *   Status: { name: string }
 *   'Story points': number | null | undefined,
 *   'Story points median': number | null | undefined,
 *   Summary: string
 * },
 * id: string,
 * key: string
 * }} JiraIssue
 */

/**
 * @typedef {{
*  name: string,
*  startDate: Date,
*  endDate: Date
* }} NormalizedSprint
*/

/**
 * Returns most common data used by most downstream tools
 * @param {JiraIssue}
 * @return {NormalizedIssue}
 */
export function normalizeIssue( issue, {
  getIssueKey = getIssueKeyDefault,
  getParentKey = getParentKeyDefault,
  getConfidence = getConfidenceDefault,
  getDueDate = getDueDateDefault,
  getHierarchyLevel = getHierarchyLevelDefault,
  getStartDate = getStartDateDefault,
  getStoryPoints = getStoryPointsDefault,
  getStoryPointsMedian = getStoryPointsMedianDefault,
  getType = getTypeDefault,
  getTeamKey = getTeamKeyDefault,
  getUrl = getUrlDefault,
  getVelocity = getVelocityDefault,
  getDaysPerSprint = getDaysPerSprintDefault,
  getParallelWorkLimit = getParallelWorkLimitDefault,
  getSprints = getSprintsDefault
} = {}){
    const teamName = getTeamKey(issue),
      velocity = getVelocity(teamName),
      daysPerSprint = getDaysPerSprint(teamName),
      parallelWorkLimit = getParallelWorkLimit(teamName),
      totalPointsPerDay = velocity / daysPerSprint,
      pointsPerDayPerTrack = totalPointsPerDay  / parallelWorkLimit;
    const data = {
      summary: issue.fields.Summary,
      key: getIssueKey(issue),
      parentKey: getParentKey(issue),
      confidence: getConfidence(issue),
      dueDate: parseDate8601String( getDueDate(issue) ),
      hierarchyLevel: getHierarchyLevel(issue),
      startDate: parseDate8601String( getStartDate(issue) ),
      storyPoints: getStoryPoints(issue),
      storyPointsMedian: getStoryPointsMedian(issue),
      type: getType(issue),
      sprints: getSprints(issue),
      team: {
        name: teamName,
        velocity,
        daysPerSprint,
        parallelWorkLimit,
        totalPointsPerDay,
        pointsPerDayPerTrack
      },
      url: getUrl(issue),
      issue
    };
    return data;
}
/**
 * @typedef {{
*  key: string,
*  parentKey: string | null,
*  confidence: number | null,
*  dueDate: Date,
*  hierarchyLevel: number,
*  startDate: Date, 
*  storyPoints: number | null,
*  storyPointsMedian: number | null,
*  type: string,
*  team: NormalizedTeam,
*  url: string,
*  sprints: null | Array<NormalizedSprint>
* }} NormalizedIssue
*/

/**
 * @typedef {{
 *   name: string,
 *    velocity: number,
 *    daysPerSprint: number,
 *    parallelWorkLimit: number,
 *    totalPointsPerDay: number,
 *    pointsPerDayPerTrack: number
 * }} NormalizedTeam
 */

/**
 * @typedef {{
 * isConfidenceValid: boolean,
* usedConfidence: number,
* isStoryPointsValid: boolean,
* defaultOrStoryPoints: number,
* storyPointsDaysOfWork: number,
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
* startData: import("./date-data.js").StartData,
* dueData: import("./date-data.js").DueData
* }} DerivedWork
 */


/**
 * @typedef {NormalizedIssue & {
 *   derivedWork: DerivedWork
 * }} DerivedWorkIssue
*/

/**
 * 
 * @param {Array<JiraIssue>} issues 
 * @returns {Array<DerivedWorkIssue>}
 */
export function normalizeAndDeriveIssues(issues) {
  return issues.map( issue => derivedWorkIssue( normalizeIssue(issue) ) )
}
/**
 * Adds derived data
 * @param {NormalizedIssue} normalizedIssue 
 * @return {DerivedWorkIssue} 
 */
export function derivedWorkIssue(normalizedIssue, {
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

  const completedDaysOfWork = getSelfCompletedDays(startData, dueData);

  return {
    ...normalizedIssue,
    derivedWork: {
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
      startData,
      dueData,

      totalDaysOfWork,
      defaultOrTotalDaysOfWork,
      completedDaysOfWork
    }
  }
}


export function isConfidenceValueValid(value){
  return value && value > 0 && value <=100;
}

export function isStoryPointsValueValid(value){
  return value && value >= 0;
}

/**
 * 
 * @param {import("./date-data.js").StartData} startData 
 * @param {import("./date-data.js").DueData} dueData
 * @returns number
 */
function getSelfCompletedDays(startData, dueData) {
  // These are cases where the child issue (Epic) has a valid estimation

  if(startData && startData.start < new Date() ) {
    if(!dueData || dueData.due > new Date() ) {
      return getBusinessDatesCount( startData.start, new Date() )
    } else {
      return getBusinessDatesCount( startData.start, dueData.due )
    }
  } else {
    return 0;
  }
}


export function rollupHierarchy(derivedWorkIssues, {
  createRollupDataForHierarchyLevel,
  createRollupDataForIssue,
  onIssue,
  onEndOfHierarchy,
  rollupKey
}) {
  const allIssueData = derivedWorkIssues.map( (issue)=> {
    return {...issue, [rollupKey]: createRollupDataForIssue(issue) }
  });
  
  const group = groupIssuesByHierarchyLevel(allIssueData);
  const issueKeyToChildren = Object.groupBy(allIssueData, issue => issue.parentKey);

  for( let hierarchyLevel = 0; hierarchyLevel < groupedIssueData.length; hierarchyLevel++) {
    let issues = groupedIssueData[hierarchyLevel];
    
    if(!issues) {
      continue;
    }

    // Track rollup data
    let issueTypeData = issueTypeDatas[hierarchyLevel] = createRollupDataForHierarchyLevel(hierarchyLevel, issues);

    // some data must be created, otherwise, skip
    if(!issueTypeData) {
      continue;
    }
    for(let issueData of allIssueData) { 
      onIssue(issueData, issueKeyToChildren[issueData.key], issueTypeData)
    }
    
    onEndOfHierarchy(issueTypeData);
  }
}






function groupIssuesByHierarchyLevel(issues, options) {
  const sorted = issues //.sort(sortByIssueHierarchy);
  const group = [];
  for(let issue of sorted) {
    if(!group[issue.hierarchyLevel]) {
      group[issue.hierarchyLevel] = [];
    }
    group[issue.hierarchyLevel].push(issue)
  }
  return group;
}

