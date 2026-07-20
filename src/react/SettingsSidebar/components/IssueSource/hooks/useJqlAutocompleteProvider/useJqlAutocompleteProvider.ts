import type {
  GetAutocompleteInitialData,
  GetAutocompleteSuggestions,
  JQLAutocompleteResponse,
  JQLAutocompleteSuggestionsResponse,
} from '@atlaskit/jql-editor-autocomplete-rest';

import { useCallback } from 'react';
import { useAutocompleteProvider } from '@atlaskit/jql-editor-autocomplete-rest';

import { useJira } from '../../../../../services/jira';

const ANALYTICS_SOURCE = 'jira-timeline-report';

/**
 * Bridges the app's authenticated Jira client to `@atlaskit/jql-editor`'s autocomplete hook.
 *
 * The atlaskit hook expects `getInitialData` to resolve `{ jqlFields, jqlFunctions }`, but Jira's
 * `/jql/autocompletedata` endpoint returns `{ visibleFieldNames, visibleFunctionNames }` — so we
 * remap here. Suggestions already match (`{ results }`) and pass through.
 */
export const useJqlAutocompleteProvider = () => {
  const jira = useJira();

  const getInitialData = useCallback<GetAutocompleteInitialData>(
    async (url) => {
      const res = (await jira.fetchJqlAutocompleteData(url)) as unknown as JQLAutocompleteResponse;

      return {
        jqlFields: res.visibleFieldNames ?? [],
        jqlFunctions: res.visibleFunctionNames ?? [],
      };
    },
    [jira],
  );

  const getSuggestions = useCallback<GetAutocompleteSuggestions>(
    async (url) => {
      const res = (await jira.fetchJqlAutocompleteSuggestions(url)) as unknown as JQLAutocompleteSuggestionsResponse;

      return { results: res.results ?? [] };
    },
    [jira],
  );

  return useAutocompleteProvider(ANALYTICS_SOURCE, getInitialData, getSuggestions);
};
