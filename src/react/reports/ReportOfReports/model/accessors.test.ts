import { describe, it, expect } from 'vitest';

import {
  derivedAccessor,
  issueKeyOf,
  latestCommentExpression,
  looksLikeKey,
  LATEST_COMMENT_ACCESSOR,
} from './accessors';

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

  it('returns "" for the right shape with no key yet, so a new node still gets a key field', () => {
    expect(issueKeyOf('issue =')).toBe('');
    expect(issueKeyOf('issue = ')).toBe('');
  });

  it('returns null for anything a key field could not represent', () => {
    expect(issueKeyOf('project = ABC')).toBeNull();
    expect(issueKeyOf('issue = ABC-1 AND status = Done')).toBeNull();
    expect(issueKeyOf('issue in (ABC-1, ABC-2)')).toBeNull();
    expect(issueKeyOf('assignee = currentUser()')).toBeNull();
    expect(issueKeyOf('')).toBeNull();
  });

  // The reverse of what this used to assert, and the fix for a reported bug. Requiring `ABC-1` shape made
  // a typo unrecoverable: `issue = ASDF` fell to `null`, the node flipped to editing its whole
  // expression, and typing a real key into that field un-made the node. "Can a key field hold this?" is
  // the question — not "does this name a work item", which is Jira's to answer.
  it('keeps a mistyped key in the key field rather than giving up on it', () => {
    expect(issueKeyOf('issue = ASDF')).toBe('ASDF');
    expect(issueKeyOf('issue = 123')).toBe('123');
    expect(issueKeyOf('issue = SUNNYSUSHI')).toBe('SUNNYSUSHI');
    expect(issueKeyOf('issue = ABC-')).toBe('ABC-');
  });
});

describe('looksLikeKey', () => {
  it('accepts a bare term, whether or not it names anything', () => {
    expect(looksLikeKey('SUNNYSUSHI-54')).toBe(true);
    expect(looksLikeKey('ASDF')).toBe(true);
    expect(looksLikeKey('  ABC-1  ')).toBe(true);
  });

  // Clearing the field blanks the key; it must not turn a comment node into an empty inline value.
  it('accepts empty', () => {
    expect(looksLikeKey('')).toBe(true);
    expect(looksLikeKey('   ')).toBe(true);
  });

  it('rejects anything that is an expression or a query', () => {
    expect(looksLikeKey('(issue = ABC-1).latestComment')).toBe(false);
    expect(looksLikeKey('project = ABC')).toBe(false);
    expect(looksLikeKey('ABC-1 AND ABC-2')).toBe(false);
    expect(looksLikeKey('assignee = currentUser()')).toBe(false);
  });
});
