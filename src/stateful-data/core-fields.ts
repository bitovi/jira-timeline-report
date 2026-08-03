/**
 * The fields `getRawIssues` always loads, whatever a report asks for.
 *
 * In its own module rather than in `jira-data-requests.js` so that the cache-key helpers can fold it
 * into a key without importing the module that imports *them* — `jira-data-requests.js` re-exports it,
 * so every existing importer is unaffected.
 */
export const CORE_FIELDS = [
  'summary',
  'Rank',
  'Issue Type',
  'Fix versions',
  'Labels',
  'Status',
  'Sprint',
  'Created',
  'Parent',
  'Team',
  'Linked Issues',
];
