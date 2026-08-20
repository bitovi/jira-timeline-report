/**
 * The match rule for a Status Update comment, and the pick among a week's worth of them.
 *
 * Pure and Jira-free — it takes the comments a fetch already returned — so every spelling of the prefix
 * and every edge of the week boundary is settled in a unit test.
 * See spec/027-status-updates § The match rule.
 */

import type { JiraComment } from '../../../../jira-oidc-helpers/jira';
import type { WeekWindow } from './currentWeek';

import { adfToBlocks, inlineToText } from '../../../components/AdfBlocks';
import { isWithinWeek } from './currentWeek';

const PREFIX = 'status update';

/**
 * The plain text of the comment's first block — a paragraph break ends it, which is the point.
 *
 * `adfToBlocks` already flattens a document into blocks and left-trims the first run, so the two
 * spellings the feature has to match are the same rule with no special case between them:
 *
 *     Status Update                    Status Update: shipped the auth refactor
 *     shipped the auth refactor
 *
 * Reusing the AdfBlocks walker rather than writing a second one is also what makes a **bolded** or
 * heading-styled prefix match for free: marks and heading levels are stripped by the time text comes
 * out.
 *
 * A comment that opens with a **list** leads with no text and so can't match — the prefix inside the
 * first bullet is not the prefix leading the comment. An **image** is different: the walker produces no
 * block for one, so the paragraph after it is the leading text, and someone who pastes a screenshot
 * above their update still wrote a status update.
 */
const leadingText = (body: unknown): string => {
  const [first] = adfToBlocks(body);

  if (!first) return '';
  if (first.type === 'codeBlock') return first.text;
  if (first.type === 'orderedList' || first.type === 'bulletList') return '';

  return inlineToText(first.content);
};

/**
 * Whether a comment body opens with `Status Update`.
 *
 * A literal `startsWith`, case-insensitive, and nothing more — which is the requirement. Two
 * consequences of the rule, neither a bug: `Status Updates:` matches, and a prefix behind a greeting
 * ("Hi all — Status Update: …") does not.
 */
export const isStatusUpdateComment = (body: unknown): boolean =>
  leadingText(body).trimStart().toLowerCase().startsWith(PREFIX);

/** The timestamp the feature filters and orders by: `updated`, Jira's last-edited, else `created`. */
const stamp = (comment: JiraComment): number => {
  const time = Date.parse(comment.updated ?? comment.created ?? '');

  return Number.isNaN(time) ? 0 : time;
};

/**
 * This week's status update, if there is one.
 *
 * `updated` rather than `created` because an edit is a correction, and a corrected update is the
 * current one. The explicit sort is **not** redundant with the fetch's `orderBy=-created`: the response
 * is ordered by *created* and the winner is chosen by *updated*, so an edited older comment has to be
 * able to overtake a newer one.
 */
export const pickStatusUpdate = (comments: JiraComment[], week: WeekWindow): JiraComment | undefined =>
  comments
    .filter((comment) => isWithinWeek(comment.updated ?? comment.created, week) && isStatusUpdateComment(comment.body))
    .sort((left, right) => stamp(right) - stamp(left))[0];
