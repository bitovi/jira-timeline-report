import { JiraIssue } from "../shared/issue-data/issue-data.js";

/**
 * @param { JiraIssue[] } issues
 * @param { PercentCompleteOptions } options
 */
export function percentComplete(issues, options) {
  console.log(`percentComplete: issues=`, issues);

  const map = buildMap(issues, options);

  console.log("percentComplete: map=", map);
}

/**
 * @param {JiraIssue[]} issues
 * @param {PercentCompleteOptions} options
 * @returns {Record<string, CompletionIssue>>}
 */
function buildMap(issues, options) {
  return issues.reduce((acc, issue) => {
    const key = options.getIssueKey(issue);
    const parentKey = options.getParentKey(issue);

    acc[key] = {
      children: acc[key]?.children ?? [],
      hierarchyLevel: issue.fields["Issue Type"].hierarchyLevel,
      parentKey,
      type: options.getType(issue),
    };

    if (parentKey) {
      if (acc[parentKey]) {
        acc[parentKey].children.push(key);
      } else {
        acc[parentKey] = { children: [key] };
      }
    }

    return acc;
  }, {});
}

/**
 * @typedef CompletionIssue
 * @property {CompletionIssue[]} children
 * @property {number} hierarchyLevel
 * @property {string} type
 */

/**
 * @typedef PercentCompleteOptions
 * @property {(issue: JiraIssue) => number} getConfidence
 * @property {(teamKey: string) => number} getDaysPerSprint
 * @property {(issue: JiraIssue) => string} getDueDate
 * @property {(issue: JiraIssue) => number} getEstimate
 * @property {(issue: JiraIssue) => string} getIssueKey
 * @property {(issue: JiraIssue) => string | undefined} getParentKey
 * @property {(issue: JiraIssue) => string} getStartDate
 * @property {(issue: JiraIssue) => string} getTeamKey
 * @property {(issue: JiraIssue) => string} getType
 * @property {(teamKey: string) => number} getVelocity
 * @property {string[]} includeTypes
 * @property {number} uncertaintyWeight
 */
