import { parseDate8601String } from "../../date-helpers";
import { getBusinessDatesCount } from "../../status-helpers";
/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getConfidence({ fields }) {
  return fields["Story points confidence"] || fields.Confidence;
}

/**
 * @param {string} teamKey
 * @returns {number}
 */
export function getDaysPerSprint(teamKey) {
  return 10;
}

/**
 * @param {JiraIssue} issue
 * @returns {string | null}
 */
export function getDueDate({ fields }) {
  return fields["Due date"];
}

/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getHierarchyLevel({ fields }) {
  return fields["Issue Type"].hierarchyLevel;
}

/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getIssueKey({ key }) {
  return key;
}

/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getParentKey({ fields }) {
  return fields["Parent Link"].data?.key;
}

/**
 * @param {JiraIssue} issue
 * @returns {string | null}
 */
export function getStartDate({ fields }) {
  return fields["Start date"];
}

/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getStoryPoints({ fields }) {
  return fields["Story points"];
}

/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getStoryPointsMedian({ fields }) {
  return fields["Story points median"];
}

/**
 * @param {JiraIssue} issue
 * @returns {string | void}
 */
export function getUrl({ key }) {
  return "javascript://"
}

/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getTeamKey({ fields }) {
  var matches = fields.Summary.match(/M\d: ([^:]+): /);
  if (matches) {
    return fields["Project key"] + ":" + matches[1];
  } else {
    return fields["Project key"];
  }
}

/**
 * @param {JiraIssue} issue
 * @returns {string}
 */
export function getType({ fields }) {
  return fields["Issue Type"].name;
}

/**
 * @param {string} teamKey
 * @returns {number}
 */
export function getVelocity(teamKey) {
  return 21;
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
 * Returns most common data used by most downstream tools
 * @param {JiraIssue}
 * @return {NormalizedIssue}
 */
export function normalizeIssue( issue, {
  getIssueKey: getIssueKey,
  getParentKey: getParentKey,
  getConfidence: getConfidence,
  getDueDate: getDueDate,
  getHierarchyLevel: getHierarchyLevel,
  getStartDate: getStartDate,
  getStoryPoints: getStoryPoints,
  getStoryPointsMedian: getStoryPointsMedian,
  getType: getType,
  getTeamKey: getTeamKey,
  getUrl: getUrl,
  getVelocity: getVelocity,
  getDaysPerSprint: getDaysPerSprint
}){
    const teamName = getTeamKey(issue);
    const data = {
      key: getIssueKey(issue),
      parentKey: getParentKey(issue),
      confidence: getConfidence(issue),
      dueDate: parseDate8601String( getDueDate(issue) ),
      hierarchyLevel: options.getHierarchyLevel(issue),
      startDate: parseDate8601String( getStartDate(issue) ),
      storyPoints: getStoryPoints(issue),
      storyPointsMedian: getStoryPointsMedian(issue),
      type: getType(issue),
      team: {
        name: teamName,
        velocity: getVelocity(issue.team),
        daysPerSprint: getDaysPerSprint(issue.team)
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
*  type: string,
*  team: {
*    name: string,
*    velocity: number,
*    pointsPerSprint: number
*  },
*  url: string
* }} NormalizedIssue
*/

/**
 * Adds derived data
 * @param {NormalizedIssue} normalizedIssue 
 * @return {DerivedIssue} 
 */

export function selfDerivedIssue(normalizedIssue, options){
  return {
    ...normalizedIssue,
    derived: {
      totalWorkingDays: getSelfTotalDays(normalizedIssue, options),
      completedDays: getSelfCompletedDays(normalizedIssue, options)
    }
  }
}
/**
 * @typedef {object} DerivedIssue
 * @extends {NormalizedIssue}
 * @property {{
 *   completedWorkingDays: number | null,
 *   totalWorkingDays: number | null
 * }} derived
 */


/**
 * 
 * @param {NormalizedIssue} issue 
 * @param {*} options 
 * @returns number | null
 */
function getSelfTotalDays(issue, options) {
  // These are cases where the child issue (Epic) has a valid estimation
  let durationDays,
    durationPoints;
  if (issue.startDate && issue.dueDate) {
    durationDays = getBusinessDatesCount( issue.startDate, issue.dueDate ) ;
  } else if (issue.confidence && issue.storyPointsMedian) {
    durationPoints = issue.storyPointsMedian + estimateExtraPoints(
        issue.storyPointsMedian,
        issue.confidence,
        options.uncertaintyWeight
      )
    ;
  } else if (issue.storyPoints) {
    durationPoints = issue.storyPoints;
  }
  if(durationPoints) {
    durationDays = durationPoints / issue.team.velocity * issue.team.pointsPerSprint ;
  }

  return durationDays;
}
/**
 * 
 * @param {NormalizedIssue} issue 
 * @param {*} options 
 * @returns number | null
 */
function getSelfCompletedDays(issue, options) {
  // These are cases where the child issue (Epic) has a valid estimation

  if(issue.startDate && issue.startDate < new Date() ) {
    if(!issue.dueDate || issue.dueDate > new Date() ) {
      return getBusinessDatesCount( issue.startDate, new Date() )
    } else {
      return getBusinessDatesCount( issue.startDate, issue.dueDate )
    }
  } else {
    return null;
  }
}