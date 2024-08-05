import { parseDate8601String } from "../../date-helpers.js";
import { parseDateISOString } from "../../date-helpers.js";


/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getConfidenceDefault({ fields }) {
    return fields["Story points confidence"] || fields.Confidence;
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
    return fields["Issue Type"]?.hierarchyLevel;
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
    return fields["Parent"]?.key || ( 
        typeof fields["Parent Link"]?.data === "string" ?
        fields["Parent Link"]?.data : 
        fields["Parent Link"]?.data?.key); //this last part is probably a mistake ...
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
    return fields["Issue Type"]?.name;
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
  export function getStatusDefault({fields}) {
    return fields?.Status?.name;
  }
  export function getLabelsDefault({fields}) {
    return fields?.labels || []
  }
  export function getStatusCategoryDefault({fields}){
    return fields?.Status?.statusCategory?.name
  }
  /**
   * @typedef {{
   *   name: String,
   *   id: String,
   *   type: "releases",
   *   key: "string",
   *   summary: String,
   * }} NormalizedRelease
   */


  export function getReleasesDefault ({fields}) {
    let fixVersions = fields["Fix versions"];
    if(!fixVersions) {
      fixVersions = [];
    }
    if(!Array.isArray(fixVersions)) {
      fixVersions = [fixVersions]
    }
    return fixVersions.map( ({name, id})=> {
      return {name, id, type: "Release", key: "SPECIAL:release-"+name, summary: name}
    });
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
   *   Status: { name: string, statusCategory: {name: string} }
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
    getSprints = getSprintsDefault,
    getStatus = getStatusDefault,
    getStatusCategory = getStatusCategoryDefault,
    getLabels = getLabelsDefault,
    getReleases = getReleasesDefault
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
        status: getStatus(issue),
        statusCategory: getStatusCategory(issue),
        labels: getLabels(issue),
        releases: getReleases(issue),
        issue
      };
      return data;
  }


  /**
   * @typedef {{
  *  key: string,
  *  summary: string,
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
  *  sprints: null | Array<NormalizedSprint>,
  *  status: null | string,
  *  statusCategory: null | string,
  *  issue: JiraIssue,
  *  labels: Array<string>,
  *  releases: Array<NormalizedRelease>
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
 * Returns all status names
 * @param {Array<DerivedWorkIssue>} issues
 */

export function allStatusesSorted(issues) {
  const statuses = issues.map(issue => issue.status);
  return [...new Set(statuses)].sort();
}