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
  /**
   * One work item's recent comments, which a Status Update is picked out of. Keyed by the resolved key
   * for the same reason {@link latestComment} is.
   *
   * **The week is deliberately not in the key.** A week-dependent key would miss the cache on every
   * Monday rollover for no benefit — the page fetched is the same page either way, and which comment in
   * it counts as this week's is decided in the hook.
   * See spec/027-status-updates § Fetching.
   */
  recentComments: (issueKey: string) => [...jiraKeys.all, 'recent-comments', issueKey],
  /**
   * One page of work-item typeahead suggestions. Keyed by the debounced query, so re-typing a query
   * already asked replays from cache rather than asking Jira again — which is most of why the picker
   * goes through React Query rather than `AsyncSelect`'s `loadOptions`.
   * See spec/016-report-of-reports/009-value-report-modal.
   */
  workItemSuggestions: (query: string) => [...jiraKeys.all, 'work-item-suggestions', query],
};
