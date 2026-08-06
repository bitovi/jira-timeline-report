import { describe, it, expect } from 'vitest';

import { derivedAccessor, issueKeyOf, latestCommentExpression, LATEST_COMMENT_ACCESSOR } from './accessors';

describe('derivedAccessor', () => {
  it('matches latestComment', () => {
    expect(derivedAccessor('latestComment')).toEqual({ kind: 'latest-comment', label: 'Latest comment' });
  });

  it('matches case-insensitively and ignores surrounding space, as resolveField does for names', () => {
    expect(derivedAccessor('latestcomment')?.kind).toBe('latest-comment');
    expect(derivedAccessor('LatestComment')?.kind).toBe('latest-comment');
    expect(derivedAccessor('  latestComment  ')?.kind).toBe('latest-comment');
  });

  it('leaves real Jira fields alone, so they still resolve through resolveField', () => {
    expect(derivedAccessor('summary')).toBeUndefined();
    // `.comment` is a real field. It resolves, then dead-ends in the formatter — which is where the
    // signpost to `.latestComment` lives, not here.
    expect(derivedAccessor('comment')).toBeUndefined();
    expect(derivedAccessor('comments')).toBeUndefined();
    expect(derivedAccessor('Story points')).toBeUndefined();
  });

  it('does not match an empty accessor', () => {
    expect(derivedAccessor('')).toBeUndefined();
  });
});

describe('latestCommentExpression', () => {
  it('writes the canonical accessor', () => {
    expect(latestCommentExpression('ABC-1')).toBe('(issue = ABC-1).latestComment');
    expect(LATEST_COMMENT_ACCESSOR).toBe('latestComment');
  });

  it('accepts a blank key — the shape the Add button seeds', () => {
    expect(latestCommentExpression('')).toBe('(issue = ).latestComment');
  });

  it('round-trips through issueKeyOf', () => {
    expect(issueKeyOf('issue = ABC-1')).toBe('ABC-1');
  });
});

describe('issueKeyOf', () => {
  it('reads the key out of a single equality', () => {
    expect(issueKeyOf('issue = ABC-1')).toBe('ABC-1');
    expect(issueKeyOf('issue=ABC-1')).toBe('ABC-1');
    expect(issueKeyOf('  issue   =   ABC-1  ')).toBe('ABC-1');
  });

  it('accepts the clause names Jira accepts for a key', () => {
    expect(issueKeyOf('key = ABC-1')).toBe('ABC-1');
    expect(issueKeyOf('issuekey = ABC-1')).toBe('ABC-1');
    expect(issueKeyOf('id = ABC-1')).toBe('ABC-1');
    expect(issueKeyOf('ISSUE = ABC-1')).toBe('ABC-1');
  });

  it('tolerates a quoted key', () => {
    expect(issueKeyOf('issue = "ABC-1"')).toBe('ABC-1');
  });

  it('returns "" for the right shape with no key yet, so the row shows its placeholder', () => {
    expect(issueKeyOf('issue =')).toBe('');
    expect(issueKeyOf('issue = ')).toBe('');
  });

  it('returns null for anything that names no single work item, so the row is titled with the JQL', () => {
    expect(issueKeyOf('project = ABC')).toBeNull();
    expect(issueKeyOf('issue = ABC-1 AND status = Done')).toBeNull();
    expect(issueKeyOf('issue in (ABC-1, ABC-2)')).toBeNull();
    expect(issueKeyOf('assignee = currentUser()')).toBeNull();
    expect(issueKeyOf('')).toBeNull();
  });

  // Not "is this a well-formed key" — whether `ASDF` names anything is Jira's to answer, and it answers
  // "No work item matched." under a row still titled `ASDF`. Titling that row `issue = ASDF` instead
  // would show the reader the query rather than the thing they got wrong.
  it('titles the row with a mistyped key rather than giving up on it', () => {
    expect(issueKeyOf('issue = ASDF')).toBe('ASDF');
    expect(issueKeyOf('issue = 123')).toBe('123');
    expect(issueKeyOf('issue = SUNNYSUSHI')).toBe('SUNNYSUSHI');
    expect(issueKeyOf('issue = ABC-')).toBe('ABC-');
  });
});
