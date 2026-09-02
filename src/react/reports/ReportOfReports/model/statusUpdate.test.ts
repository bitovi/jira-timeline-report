import type { JiraComment } from '../../../../jira-oidc-helpers/jira';

import { describe, it, expect } from 'vitest';

import { weekContaining } from './currentWeek';
import { isStatusUpdateComment, pickStatusUpdate } from './statusUpdate';

const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });
const text = (value: string) => [{ type: 'text', text: value }];
const para = (value: string) => ({ type: 'paragraph', content: text(value) });

const marked = (value: string, ...marks: unknown[]) => ({ type: 'text', text: value, marks });

// See spec/027-status-updates § The match rule.
describe('isStatusUpdateComment', () => {
  // The two spellings the feature has to match, and they are one rule — the paragraph break just ends
  // the first block early.
  it('matches the prefix followed by a paragraph break', () => {
    expect(isStatusUpdateComment(doc(para('Status Update'), para('shipped the auth refactor')))).toBe(true);
  });

  it('matches the prefix inline before a colon', () => {
    expect(isStatusUpdateComment(doc(para('Status Update: shipped the auth refactor')))).toBe(true);
  });

  // Shift+Enter rather than a new paragraph — the same comment as far as a reader is concerned.
  it('matches the prefix followed by a hard break', () => {
    expect(
      isStatusUpdateComment(
        doc({
          type: 'paragraph',
          content: [{ type: 'text', text: 'Status Update' }, { type: 'hardBreak' }, { type: 'text', text: 'shipped' }],
        }),
      ),
    ).toBe(true);
  });

  // Marks and heading levels are gone by the time text comes out of the walker, which is what makes
  // these match for free rather than as special cases.
  it('matches a bolded prefix', () => {
    expect(
      isStatusUpdateComment(doc({ type: 'paragraph', content: [marked('Status Update:', { type: 'strong' })] })),
    ).toBe(true);
  });

  it('matches a prefix written as a heading', () => {
    expect(
      isStatusUpdateComment(
        doc({ type: 'heading', attrs: { level: 3 }, content: text('Status Update') }, para('all good')),
      ),
    ).toBe(true);
  });

  it('matches regardless of case', () => {
    expect(isStatusUpdateComment(doc(para('status update: fine')))).toBe(true);
    expect(isStatusUpdateComment(doc(para('STATUS UPDATE: fine')))).toBe(true);
    expect(isStatusUpdateComment(doc(para('Status update — fine')))).toBe(true);
  });

  it('ignores leading whitespace', () => {
    expect(isStatusUpdateComment(doc(para('   Status Update: fine')))).toBe(true);
  });

  // The prefix must *lead*. This is the case that separates a `startsWith` from an `includes`, and the
  // reason an unrelated comment mentioning a status update doesn't hijack the node.
  it('does not match a prefix that is not first', () => {
    expect(isStatusUpdateComment(doc(para('Weekly Status Update: shipped')))).toBe(false);
    expect(isStatusUpdateComment(doc(para('Hi all — Status Update: shipped')))).toBe(false);
    expect(isStatusUpdateComment(doc(para('can you rebase this?')))).toBe(false);
  });

  // The prefix has to lead the *comment*, not just some paragraph in it.
  it('does not match a prefix in a later paragraph', () => {
    expect(isStatusUpdateComment(doc(para('quick note'), para('Status Update: shipped')))).toBe(false);
  });

  // A consequence of a literal `startsWith`, called out in the plan as the rule working rather than a
  // bug.
  it('matches the looser spellings the rule admits', () => {
    expect(isStatusUpdateComment(doc(para('Status Updates: two things')))).toBe(true);
    expect(isStatusUpdateComment(doc(para('Status Updated the thing')))).toBe(true);
  });

  // A list is a block with no leading text of its own, so a comment that opens with one leads with
  // nothing — the prefix inside the first bullet is not the prefix leading the comment.
  it('does not match a comment that leads with a list', () => {
    expect(
      isStatusUpdateComment(
        doc({ type: 'bulletList', content: [{ type: 'listItem', content: [para('Status Update: shipped')] }] }),
      ),
    ).toBe(false);
  });

  // An image is different from a list, and deliberately so: the walker produces no block for one at
  // all, so the paragraph after it is the comment's leading text. Someone who pastes a screenshot above
  // their update still wrote a status update.
  it('looks past a leading image, which is not a block of text', () => {
    expect(isStatusUpdateComment(doc({ type: 'mediaSingle', content: [] }, para('Status Update: shipped')))).toBe(true);
  });

  it('matches a code block that opens with the prefix, since that is still leading text', () => {
    expect(isStatusUpdateComment(doc({ type: 'codeBlock', content: text('Status Update: deployed') }))).toBe(true);
  });

  it('is false for a body that is missing, empty, or not a document', () => {
    expect(isStatusUpdateComment(undefined)).toBe(false);
    expect(isStatusUpdateComment(null)).toBe(false);
    expect(isStatusUpdateComment(doc())).toBe(false);
    expect(isStatusUpdateComment(42)).toBe(false);
  });

  // Jira can hand back a plain string for a comment body; `adfToBlocks` already handles that shape.
  it('matches a plain-string body', () => {
    expect(isStatusUpdateComment('Status Update: shipped')).toBe(true);
    expect(isStatusUpdateComment('nothing to report')).toBe(false);
  });
});

// The week containing Thursday 2026-08-20 — Monday 2026-08-17 00:00 UTC to Monday 2026-08-24 00:00 UTC.
const week = weekContaining(Date.parse('2026-08-20T12:00:00.000Z'));

const comment = (
  id: string,
  body: unknown,
  { created = '2026-08-20T09:00:00.000Z', updated = created }: { created?: string; updated?: string } = {},
): JiraComment => ({ id, body, author: { displayName: 'Dana Ruiz' }, created, updated });

const update = (id: string, times?: { created?: string; updated?: string }) =>
  comment(id, doc(para(`Status Update: ${id}`)), times);

// See spec/027-status-updates § The hook.
describe('pickStatusUpdate', () => {
  it('finds this week’s status update', () => {
    expect(pickStatusUpdate([comment('other', doc(para('can you rebase?'))), update('mine')], week)?.id).toBe('mine');
  });

  it('finds nothing in an empty page', () => {
    expect(pickStatusUpdate([], week)).toBeUndefined();
  });

  // The behaviour the feature exists for: an unrelated comment posted after the update doesn't displace
  // it, which is exactly what Latest Comment can't promise.
  it('is not displaced by a newer unrelated comment', () => {
    const comments = [
      comment('rebase', doc(para('can you rebase this?')), { created: '2026-08-21T10:00:00.000Z' }),
      update('mine', { created: '2026-08-19T10:00:00.000Z' }),
    ];

    expect(pickStatusUpdate(comments, week)?.id).toBe('mine');
  });

  it('ignores a matching comment from last week', () => {
    expect(pickStatusUpdate([update('old', { created: '2026-08-14T10:00:00.000Z' })], week)).toBeUndefined();
  });

  it('ignores comments from this week that do not match', () => {
    expect(
      pickStatusUpdate([comment('a', doc(para('looks good'))), comment('b', doc(para('merged')))], week),
    ).toBeUndefined();
  });

  // Ordered by `updated`, not by position in the page — the response is `-created` ordered, so this is
  // the sort earning its keep.
  it('prefers the newest updated of two matches in one week', () => {
    const comments = [
      update('newer-created', { created: '2026-08-20T10:00:00.000Z' }),
      update('edited-later', { created: '2026-08-18T10:00:00.000Z', updated: '2026-08-21T10:00:00.000Z' }),
    ];

    expect(pickStatusUpdate(comments, week)?.id).toBe('edited-later');
  });

  // Membership is `created`, so editing a comment doesn't move it into this week. A September edit of an
  // update posted in June is not this week's news.
  it('ignores a comment created long ago, however recently it was edited', () => {
    const comments = [update('stale', { created: '2026-06-01T10:00:00.000Z', updated: '2026-08-19T10:00:00.000Z' })];

    expect(pickStatusUpdate(comments, week)).toBeUndefined();
  });

  // The mirror, and the reason membership can't be `updated`: this update was posted in the week, so it
  // is the week's update, and a later correction to it doesn't take it away.
  it('keeps a comment created in the week but edited after it', () => {
    const comments = [
      update('corrected', { created: '2026-08-19T10:00:00.000Z', updated: '2026-08-25T10:00:00.000Z' }),
    ];

    expect(pickStatusUpdate(comments, week)?.id).toBe('corrected');
  });

  it('orders on created when Jira sends no updated', () => {
    const comments = [comment('mine', doc(para('Status Update: shipped')), { created: '2026-08-19T10:00:00.000Z' })];

    delete comments[0].updated;

    expect(pickStatusUpdate(comments, week)?.id).toBe('mine');
  });

  // Nothing says when either of these was posted, and "this week's" is a claim about when it was posted.
  it('excludes a comment with no usable created date, without throwing', () => {
    const nothing: JiraComment = { id: 'nothing', body: doc(para('Status Update: shipped')) };
    const unparseable = update('unparseable', { created: 'yesterday-ish' });
    const editedOnly: JiraComment = {
      id: 'edited-only',
      body: doc(para('Status Update: shipped')),
      updated: '2026-08-19T10:00:00.000Z',
    };

    expect(pickStatusUpdate([nothing, unparseable, editedOnly], week)).toBeUndefined();
  });

  // Both boundaries on `created`, which is what membership is decided by.
  it('places the week boundaries either side of Sunday midnight UTC', () => {
    expect(pickStatusUpdate([update('in', { created: '2026-08-23T23:59:59.999Z' })], week)?.id).toBe('in');
    expect(pickStatusUpdate([update('out', { created: '2026-08-24T00:00:00.000Z' })], week)).toBeUndefined();
  });

  it('does not mutate the page it was given', () => {
    const comments = [
      update('a', { created: '2026-08-18T10:00:00.000Z' }),
      update('b', { created: '2026-08-20T10:00:00.000Z' }),
    ];

    pickStatusUpdate(comments, week);

    expect(comments.map((entry) => entry.id)).toEqual(['a', 'b']);
  });
});
