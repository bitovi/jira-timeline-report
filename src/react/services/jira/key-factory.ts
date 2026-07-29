export const jiraKeys = {
  all: ['jira'],
  allIssueFields: () => [...jiraKeys.all, 'issue-fields'],
  /**
   * One inline-value expression's search. Keyed by the JQL and the resolved field id, so two nodes
   * asking the same question share one request. See spec/016-report-of-reports/003-self-reports.
   */
  inlineExpression: (jql: string, fieldId: string) => [...jiraKeys.all, 'inline-expression', jql, fieldId],
};
