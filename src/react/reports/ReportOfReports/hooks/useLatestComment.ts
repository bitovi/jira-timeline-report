import { useQuery } from '@tanstack/react-query';

import { useJira, jiraKeys } from '../../../services/jira';
import { useResolvedIssueKey, type CommentReportState } from './useCommentReport';

/**
 * The newest comment on the one work item a JQL matches.
 *
 * Step 2 only: `useResolvedIssueKey` is step 1, shared with `useStatusUpdate` — see it for why this
 * takes two requests at all. What's left here is one endpoint call and the four states it can be in.
 *
 * Sibling of `useInlineExpression` rather than a mode inside it: the two fetches share no endpoint,
 * response shape, or correctness constraint, and that file is what Add Value depends on.
 *
 * See spec/016-report-of-reports/007-latest-comment-report Phase 2.
 */
export const useLatestComment = (jql: string): CommentReportState => {
  const jira = useJira();
  const { issueKey, state } = useResolvedIssueKey(jql);

  // Keyed by the resolved key, so two nodes on one work item share one request.
  const comment = useQuery({
    queryKey: jiraKeys.latestComment(issueKey),
    queryFn: () => jira.fetchLatestComment(issueKey),
    enabled: issueKey.length > 0,
  });

  if (state) {
    return state;
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
