/**
 * @param {JiraIssue} issue
 * @returns {number}
 */
export function getConfidence({ fields }) {
  return fields.Confidence;
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
 * @returns {string}
 */
export function getTeamKeyDefault({ fields }) {
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
