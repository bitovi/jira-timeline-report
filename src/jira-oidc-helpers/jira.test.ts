import { describe, it, expect, vi } from 'vitest';

import {
  COMMENT_SCAN_SIZE,
  fetchJqlAutocompleteData,
  fetchJqlAutocompleteSuggestions,
  fetchLatestComment,
  fetchRecentComments,
} from './jira';
import { Config } from './types';

// Minimal config whose requestHelper just records the path it was called with.
function makeConfig() {
  const requestHelper = vi.fn(async () => ({}) as unknown);
  const config = {
    env: {} as Config['env'],
    requestHelper,
    fieldsRequest: async () => ({ list: {} as any, nameMap: {}, idMap: {} }),
    host: 'hosted',
  } as unknown as Config;

  return { config, requestHelper };
}

describe('JQL autocomplete fetchers', () => {
  it('fetchJqlAutocompleteData hits the app autocompletedata path, ignoring the atlaskit-built url', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchJqlAutocompleteData(config)('/rest/api/latest/jql/autocompletedata');

    expect(requestHelper).toHaveBeenCalledWith('/api/3/jql/autocompletedata');
  });

  it('fetchJqlAutocompleteSuggestions preserves the fieldName/fieldValue query string', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchJqlAutocompleteSuggestions(config)(
      '/rest/api/latest/jql/autocompletedata/suggestions?fieldName=status&fieldValue=in',
    );

    expect(requestHelper).toHaveBeenCalledWith(
      '/api/3/jql/autocompletedata/suggestions?fieldName=status&fieldValue=in',
    );
  });

  it('fetchJqlAutocompleteSuggestions handles a url with no query string', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchJqlAutocompleteSuggestions(config)('/rest/api/latest/jql/autocompletedata/suggestions');

    expect(requestHelper).toHaveBeenCalledWith('/api/3/jql/autocompletedata/suggestions');
  });
});

// See spec/016-report-of-reports/007-latest-comment-report Phase 2.
describe('fetchLatestComment', () => {
  // The ordering is the whole reason this endpoint is used instead of `fields: ['comment']` on a
  // search: Jira returns comments oldest-first, so without `-created` the one comment we ask for is
  // the *oldest*. This assertion is the guard on that.
  it('asks for one comment, newest first', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchLatestComment(config)('ABC-1');

    expect(requestHelper).toHaveBeenCalledWith('/api/3/issue/ABC-1/comment?orderBy=-created&maxResults=1');
  });

  it('escapes a key into the path', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchLatestComment(config)('SYSTEMS-918');

    expect(requestHelper).toHaveBeenCalledWith('/api/3/issue/SYSTEMS-918/comment?orderBy=-created&maxResults=1');
  });
});

// See spec/027-status-updates § Fetching.
describe('fetchRecentComments', () => {
  // Same URL shape as its sibling above and the same ordering, differing only in the page size — which
  // is the whole reason it is a second function rather than an argument on the first.
  it('asks for a page of comments, newest first', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchRecentComments(config)('ABC-1');

    expect(requestHelper).toHaveBeenCalledWith('/api/3/issue/ABC-1/comment?orderBy=-created&maxResults=100');
    expect(COMMENT_SCAN_SIZE).toBe(100);
  });

  it('takes a smaller page when a caller asks for one', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchRecentComments(config)('ABC-1', 5);

    expect(requestHelper).toHaveBeenCalledWith('/api/3/issue/ABC-1/comment?orderBy=-created&maxResults=5');
  });

  it('escapes a key into the path', async () => {
    const { config, requestHelper } = makeConfig();

    await fetchRecentComments(config)('a/b');

    expect(requestHelper).toHaveBeenCalledWith('/api/3/issue/a%2Fb/comment?orderBy=-created&maxResults=100');
  });
});
