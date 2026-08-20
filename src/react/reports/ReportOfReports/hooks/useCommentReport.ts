import { useQuery } from '@tanstack/react-query';

import { useJira, jiraKeys } from '../../../services/jira';

/**
 * What either comment preset — Latest Comment or Status Update — hands its view.
 *
 * One type for both because the view is one component: a comment renders the same way whichever rule
 * chose it, and the states it can be in are the same four. `empty` covers "there is nothing to show"
 * and the view supplies the sentence that says which nothing it is.
 * See spec/027-status-updates § The hook.
 */
export type CommentReportState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ok'; body: unknown; author: string; updated: string };

/** The shape `fetchJiraIssuesWithJQLWithNamedFields` returns; only `key` is read here. */
interface NamedFieldIssue {
  key?: string;
  fields?: Record<string, unknown>;
}

/**
 * Step 1 of both comment presets: the one work item a JQL names.
 *
 * **Two requests, deliberately.** The accessor half of `(jql).latestComment` or `(jql).statusUpdate` is
 * not a Jira field, so the comments cannot come out of the search — and Jira's comment endpoint takes a
 * key, not a query. So step 1 is the same search `useInlineExpression` makes, for the key and the
 * cardinality, and step 2 asks the comment endpoint by that key. The cost is one extra request; what it
 * buys is that a hand-written query works and that "no work item matched" / "more than one matched"
 * behave identically to an ordinary inline value.
 *
 * Returns the resolved key, or a `state` the caller must return as-is — which is every outcome where
 * there is no single work item to ask about. A pending search is neither: no state and a blank key, and
 * the caller's own `loading` branch covers it.
 *
 * `useQuery`, deliberately not `useSuspenseQuery`, for the reason `useInlineExpression` gives: a bad key
 * has to fail in place with a message beside it, not suspend and blank the document.
 *
 * See spec/016-report-of-reports/007-latest-comment-report Phase 2, from which this was lifted verbatim
 * when Status Update needed the same step.
 */
export const useResolvedIssueKey = (jql: string): { issueKey: string; state?: CommentReportState } => {
  const jira = useJira();

  const trimmedJql = jql.trim();

  // `summary` is asked for because the endpoint wants *a* projection; the value is never read. What
  // matters is the `key` on the row and how many rows come back.
  const search = useQuery({
    // `inlineExpression`, not a key of its own: this is byte-for-byte the request an Add Value node
    // reading `(same jql).summary` makes, so sharing the key makes the two dedupe instead of racing.
    queryKey: jiraKeys.inlineExpression(trimmedJql, 'summary'),
    queryFn: () =>
      jira.fetchJiraIssuesWithJQLWithNamedFields({
        jql: trimmedJql,
        fields: ['summary'],
        // Two rows is all it takes to tell "exactly one" from "more than one".
        maxResults: 2,
      }) as Promise<NamedFieldIssue[]>,
    enabled: trimmedJql.length > 0,
  });

  if (search.error) {
    return { issueKey: '', state: { status: 'error', message: `Jira rejected this query: ${search.error.message}` } };
  }

  // Deliberately the same copy as `useInlineExpression`, so every preset of an inline value fails the
  // same way. The `/search/jql` endpoint reports no total and `maxResults: 2` caps what we asked for,
  // so "more than one" is the honest wording — not a count we don't have.
  if (search.data && search.data.length === 0) {
    return { issueKey: '', state: { status: 'error', message: 'No work item matched.' } };
  }

  if (search.data && search.data.length > 1) {
    return {
      issueKey: '',
      state: { status: 'error', message: 'More than one work item matched — narrow the query.' },
    };
  }

  return { issueKey: search.data?.length === 1 ? (search.data[0].key ?? '') : '' };
};
