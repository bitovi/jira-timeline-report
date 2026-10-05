import { describe, test, expect } from 'vitest';
import { buildExploreUrl } from './buildExploreUrl';

describe('buildExploreUrl', () => {
  test('scopes jql to the issue and enables loading children', () => {
    const url = buildExploreUrl('https://example.com/report?foo=bar', 'OUT-88');
    const result = new URL(url);

    expect(result.searchParams.get('jql')).toBe('issue = OUT-88');
    expect(result.searchParams.get('loadChildren')).toBe('true');
    expect(result.searchParams.get('childJQL')).toBe('');
    expect(result.searchParams.get('foo')).toBe('bar');
  });

  // The explore view is built from the CURRENT url, so a page loaded with blockers on would drag its
  // whole upstream graph into a view that is meant to be one issue's children.
  test('resets the blocker expansion it would otherwise inherit', () => {
    const url = buildExploreUrl('https://example.com/report?loadBlockers=true&blockerJQL=type%20%3D%20Bug', 'OUT-88');
    const result = new URL(url);

    expect(result.searchParams.get('loadBlockers')).toBe('false');
    expect(result.searchParams.get('blockerJQL')).toBe('');
  });

  test('clears filters that would hide the explored children', () => {
    const url = buildExploreUrl(
      'https://example.com/report?statusesToShow=a&statusesToRemove=b&releasesToShow=c&groupBy=team',
      'OUT-88',
    );
    const result = new URL(url);

    expect(result.searchParams.has('statusesToShow')).toBe(false);
    expect(result.searchParams.has('statusesToRemove')).toBe(false);
    expect(result.searchParams.has('releasesToShow')).toBe(false);
    expect(result.searchParams.has('groupBy')).toBe(false);
  });
});
