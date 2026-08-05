/** Which field catalog a query holds: the real Jira one, or the bundled sample one. */
export type IssueFieldsMode = 'auth' | 'sample';

export const jiraKeys = {
  all: ['jira'],
  /**
   * The PREFIX every field-catalog query shares — not a complete key.
   *
   * Use it with the filter-based APIs (`invalidateQueries`, `getQueriesData`), which match by
   * prefix. `getQueryData`/`setQueryData` match EXACTLY, so they need {@link issueFields} instead:
   * reading the catalog with this prefix silently returns `undefined`, which is how a team-config
   * save came to wipe `fieldsToRequest` and wedge the report on a never-settling promise
   * (spec/015-field-selection).
   */
  allIssueFields: () => [...jiraKeys.all, 'issue-fields'],
  /** The exact key for one field catalog. Login state is part of it so switching login refetches. */
  issueFields: (mode: IssueFieldsMode) => [...jiraKeys.allIssueFields(), mode],
  /**
   * One inline-value expression's search. Keyed by the JQL and the resolved field id, so two nodes
   * asking the same question share one request. See spec/016-report-of-reports/003-self-reports.
   */
  inlineExpression: (jql: string, fieldId: string) => [...jiraKeys.all, 'inline-expression', jql, fieldId],
  /**
   * One work item's newest comment. Keyed by the *resolved* key rather than the JQL that found it, so
   * two nodes pointing at the same work item by different queries share one request.
   * See spec/016-report-of-reports/007-latest-comment-report.
   */
  latestComment: (issueKey: string) => [...jiraKeys.all, 'latest-comment', issueKey],
};
