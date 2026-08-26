import { useQuery } from '@tanstack/react-query';

import { useJira, jiraKeys } from '../../../services/jira';
import { previousWeekContaining } from '../model/currentWeek';
import { pickStatusUpdate } from '../model/statusUpdate';
import { useResolvedIssueKey, type CommentReportState } from './useCommentReport';

/**
 * Last week's status update on the one work item a JQL matches, if anyone posted one.
 *
 * Step 1 is `useResolvedIssueKey`, shared verbatim with `useLatestComment`. Step 2 differs in both
 * halves: it asks for a *page* of comments rather than one, and the answer is chosen by a rule rather
 * than by Jira's ordering — which is the whole difference between the two presets. The rule reads both
 * of a comment's timestamps, and for different things: see `pickStatusUpdate`.
 *
 * The clock is read here rather than in `pickStatusUpdate` so the rule and the week stay pure and
 * testable with explicit numbers; only this hook's test needs `vi.setSystemTime`.
 *
 * See spec/027-status-updates § The hook.
 */
export const useStatusUpdate = (jql: string): CommentReportState => {
  const jira = useJira();
  const { issueKey, state } = useResolvedIssueKey(jql);

  const comments = useQuery({
    queryKey: jiraKeys.recentComments(issueKey),
    queryFn: () => jira.fetchRecentComments(issueKey),
    enabled: issueKey.length > 0,
  });

  if (state) {
    return state;
  }

  if (comments.error) {
    return { status: 'error', message: `Jira couldn't return comments for ${issueKey}.` };
  }

  if (!issueKey || comments.isPending || !comments.data) {
    return { status: 'loading' };
  }

  const match = pickStatusUpdate(comments.data.comments ?? [], previousWeekContaining(Date.now()));

  // One `empty` for both "no comments last week" and "comments, but none of them an update" — the
  // reader is told the same true thing either way, and the view has one note to render.
  if (!match) {
    return { status: 'empty' };
  }

  return {
    status: 'ok',
    body: match.body,
    author: match.author?.displayName ?? 'Unknown',
    // `updated`, not the `created` the week was decided by: it is the field that chose this comment over
    // the week's other updates, and the footer labels it "Last updated".
    updated: match.updated ?? match.created ?? '',
  };
};
