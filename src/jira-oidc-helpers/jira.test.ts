import { describe, it, expect, vi } from 'vitest';

import { fetchJqlAutocompleteData, fetchJqlAutocompleteSuggestions } from './jira';
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
