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
