import { describe, it, expect } from 'vitest';

import {
  derivedAccessor,
  derivedKindOf,
  issueKeyOf,
  LATEST_COMMENT_ACCESSOR,
  STATUS_UPDATE_ACCESSOR,
} from './accessors';

describe('derivedAccessor', () => {
  it('matches latestComment', () => {
    expect(derivedAccessor('latestComment')).toEqual({ kind: 'latest-comment', label: 'Latest comment' });
  });

  // See spec/027-status-updates § The accessor and the dropdown.
  it('matches statusUpdate', () => {
    expect(derivedAccessor('statusUpdate')).toEqual({ kind: 'status-update', label: 'Status update' });
  });

  it('matches case-insensitively and ignores surrounding space, as resolveField does for names', () => {
    expect(derivedAccessor('latestcomment')?.kind).toBe('latest-comment');
    expect(derivedAccessor('LatestComment')?.kind).toBe('latest-comment');
    expect(derivedAccessor('  latestComment  ')?.kind).toBe('latest-comment');
    // Lower-cased keying gives the second accessor the same tolerance for free.
    expect(derivedAccessor('statusupdate')?.kind).toBe('status-update');
    expect(derivedAccessor('STATUSUPDATE')?.kind).toBe('status-update');
    expect(derivedAccessor('  statusUpdate  ')?.kind).toBe('status-update');
  });

  it('leaves real Jira fields alone, so they still resolve through resolveField', () => {
    expect(derivedAccessor('summary')).toBeUndefined();
    // `.comment` is a real field. It resolves, then dead-ends in the formatter — which is where the
    // signpost to `.latestComment` lives, not here.
    expect(derivedAccessor('comment')).toBeUndefined();
    expect(derivedAccessor('comments')).toBeUndefined();
    expect(derivedAccessor('Story points')).toBeUndefined();
    // Near-misses of the second accessor, which is a literal key like any other.
    expect(derivedAccessor('status')).toBeUndefined();
    expect(derivedAccessor('statusUpdates')).toBeUndefined();
    expect(derivedAccessor('status update')).toBeUndefined();
  });

  it('does not match an empty accessor', () => {
    expect(derivedAccessor('')).toBeUndefined();
  });
});

/**
 * The kind, not a boolean: there are three outcomes now, and the dispatcher has to tell the two presets
 * apart as well as from an ordinary field. See spec/027-status-updates § The accessor and the dropdown.
 */
describe('derivedKindOf', () => {
  it('names the canonical accessors', () => {
    expect(LATEST_COMMENT_ACCESSOR).toBe('latestComment');
    expect(STATUS_UPDATE_ACCESSOR).toBe('statusUpdate');
  });

  it('reads each preset out of an expression', () => {
    expect(derivedKindOf('(issue = ABC-1).latestComment')).toBe('latest-comment');
    expect(derivedKindOf('(issue = ABC-1).statusUpdate')).toBe('status-update');
  });

  it('is undefined for an ordinary field, so the node renders as a value', () => {
    expect(derivedKindOf('(issue = ABC-1).summary')).toBeUndefined();
    expect(derivedKindOf('(issue = ABC-1).comment')).toBeUndefined();
    expect(derivedKindOf('(issue = ABC-1).customfield_10014')).toBeUndefined();
  });

  it('is undefined for an expression that does not parse, rather than throwing', () => {
    expect(derivedKindOf('')).toBeUndefined();
    expect(derivedKindOf('issue = ABC-1')).toBeUndefined();
    expect(derivedKindOf('(issue = ABC-1)')).toBeUndefined();
  });

  it('reads a hand-written query and a case-varied accessor', () => {
    expect(derivedKindOf('(project = A AND status = Done).STATUSUPDATE')).toBe('status-update');
    expect(derivedKindOf('  (issue = ABC-1).statusupdate  ')).toBe('status-update');
  });

  it('round-trips the expression the Add button writes', () => {
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
