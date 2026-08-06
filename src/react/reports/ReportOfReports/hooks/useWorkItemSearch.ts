import { useQuery } from '@tanstack/react-query';

import { useDebounce } from '../../../hooks/useDebounce';
import { useJira, jiraKeys } from '../../../services/jira';

export interface WorkItemSuggestion {
  key: string;
  summary: string;
}

export interface WorkItemSearchState {
  suggestions: WorkItemSuggestion[];
  isLoading: boolean;
}

/** Long enough that a typed key doesn't fire five requests, short enough not to feel laggy. */
const DEBOUNCE_MS = 300;

/**
 * Work-item suggestions for the Value Report typeahead.
 *
 * **Debounce + React Query rather than `AsyncSelect`'s `loadOptions`.** `loadOptions` hands back a bare
 * promise per keystroke, which means hand-rolling three things React Query already does correctly:
 * caching (backspacing to a query already asked shows instantly), request dedupe, and discarding a
 * stale response that lands after a newer one. The cost is that the select becomes controlled on
 * `inputValue`, which the form does anyway.
 *
 * **Never disabled, deliberately.** On an empty query the picker endpoint returns the caller's
 * recently-viewed items in its `hs` section, which is a better resting state than a blank box — so the
 * empty query is a real question worth asking, not a case to skip. `useDebounce` seeds from its initial
 * value, so that first ask happens on mount rather than 300ms later, which is what you want for a list
 * the user hasn't typed towards yet.
 *
 * `useQuery`, not `useSuspenseQuery`: a failed suggestion lookup must leave the modal usable. The
 * caller can still type nothing and pick a field; it just gets no help choosing the work item.
 *
 * See spec/016-report-of-reports/009-value-report-modal Phase 2.
 */
export const useWorkItemSearch = (query: string): WorkItemSearchState => {
  const jira = useJira();
  const debounced = useDebounce(query.trim(), DEBOUNCE_MS);

  const { data, isFetching } = useQuery({
    queryKey: jiraKeys.workItemSuggestions(debounced),
    queryFn: async () => {
      const response = await jira.fetchIssuePickerSuggestions(debounced);

      // Both sections, flattened: `cs` is what matched the query and `hs` is recently-viewed, and an
      // item can legitimately be in both. Dedupe by key so it is offered once, keeping whichever came
      // first — Jira orders the sections by usefulness.
      const seen = new Set<string>();
      const suggestions: WorkItemSuggestion[] = [];

      for (const section of response.sections ?? []) {
        for (const issue of section.issues ?? []) {
          if (!issue.key || seen.has(issue.key)) continue;

          seen.add(issue.key);
          // `summaryText` is the plain summary; `summary` carries Jira's `<b>`-marked match highlights,
          // which would render as literal markup in an option label.
          suggestions.push({ key: issue.key, summary: issue.summaryText ?? '' });
        }
      }

      return suggestions;
    },
  });

  return {
    suggestions: data ?? [],
    // `isFetching`, not `isPending`: a re-query for a new term should show the spinner even though
    // the previous term's results are still on screen.
    isLoading: isFetching || query.trim() !== debounced,
  };
};
