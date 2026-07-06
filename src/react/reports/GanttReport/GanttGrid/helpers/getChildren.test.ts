import { describe, expect, it } from 'vitest';
import { makeGetChildren } from './getChildren';
import { makeIssue } from '../fixtures';

describe('makeGetChildren', () => {
  it('resolves child keys to issues from the full list', () => {
    const parent = makeIssue({ key: 'P-1', childKeys: ['C-1', 'C-2'] });
    const childA = makeIssue({ key: 'C-1' });
    const childB = makeIssue({ key: 'C-2' });
    const getChildren = makeGetChildren([parent, childA, childB]);
    expect(getChildren(parent)).toEqual([childA, childB]);
  });

  it('returns an empty array when there are no children', () => {
    const issue = makeIssue({ key: 'A' });
    const getChildren = makeGetChildren([issue]);
    expect(getChildren(issue)).toEqual([]);
  });

  it('skips child keys that are not found in the full list', () => {
    const parent = makeIssue({ key: 'P-1', childKeys: ['missing'] });
    const getChildren = makeGetChildren([parent]);
    expect(getChildren(parent)).toEqual([]);
  });
});
