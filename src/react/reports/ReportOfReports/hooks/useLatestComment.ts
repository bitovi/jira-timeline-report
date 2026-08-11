import { useQuery } from '@tanstack/react-query';

import { useJira, jiraKeys } from '../../../services/jira';

export type LatestCommentState =
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
 * The newest comment on the one work item a JQL matches.
 *
 * **Two requests, deliberately.** The accessor half of `(jql).latestComment` is not a Jira field, so
 * the comment cannot come out of the search — and Jira's comment endpoint takes a key, not a query. So
 * step 1 is the same search `useInlineExpression` makes, for the key and the cardinality, and step 2
 * asks the comment endpoint for the newest comment by that key. The cost is one extra request; what it
 * buys is that a hand-written query works and that "no work item matched" / "more than one matched"
 * behave identically to an ordinary inline value.
 *
 * Sibling of `useInlineExpression` rather than a mode inside it: the two fetches share no endpoint,
 * response shape, or correctness constraint, and that file is what Add Value depends on.
 *
 * `useQuery`, deliberately not `useSuspenseQuery`, for the reason `useInlineExpression` gives: a bad
 * key has to fail in place with a message beside it, not suspend and blank the document.
 *
 * See spec/016-report-of-reports/007-latest-comment-report Phase 2.
 */
export const useLatestComment = (jql: string): LatestCommentState => {
  const jira = useJira();

  const trimmedJql = jql.trim();

  // Step 1 — which work item? `summary` is asked for because the endpoint wants *a* projection; the
  // value is never read. What matters is the `key` on the row and how many rows come back.
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

  const issueKey = search.data?.length === 1 ? (search.data[0].key ?? '') : '';

  // Step 2 — the comment itself. Keyed by the resolved key, so two nodes on one work item share it.
  const comment = useQuery({
    queryKey: jiraKeys.latestComment(issueKey),
    queryFn: () => jira.fetchLatestComment(issueKey),
    enabled: issueKey.length > 0,
  });

  if (search.error) {
    return { status: 'error', message: `Jira rejected this query: ${search.error.message}` };
  }

  // Deliberately the same copy as `useInlineExpression`, so both presets of an inline value fail the
  // same way. The `/search/jql` endpoint reports no total and `maxResults: 2` caps what we asked for,
  // so "more than one" is the honest wording — not a count we don't have.
  if (search.data && search.data.length === 0) {
    return { status: 'error', message: 'No work item matched.' };
  }

  if (search.data && search.data.length > 1) {
    return { status: 'error', message: 'More than one work item matched — narrow the query.' };
  }

  if (comment.error) {
    return { status: 'error', message: `Jira couldn't return comments for ${issueKey}.` };
  }

  if (!issueKey || comment.isPending || !comment.data) {
    return { status: 'loading' };
  }

  const newest = comment.data.comments?.[0];

  if (!newest) {
    return { status: 'empty' };
  }

  // `updated` rather than `created`, because the view labels this line "Last updated" — and Jira sets
  // `updated` equal to `created` on a comment nobody has edited, so it is the honest field for that
  // label either way. It stays Jira's raw ISO string: formatting here would put locale knowledge in the
  // hook, where the view is the only thing that should have it.
  return {
    status: 'ok',
    body: newest.body,
    author: newest.author?.displayName ?? 'Unknown',
    updated: newest.updated ?? newest.created ?? '',
  };
};
