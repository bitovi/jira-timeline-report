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
  /** Something is typed, but not yet enough to search on. */
  isTooShort: boolean;
}

/** Long enough that a typed key doesn't fire five requests, short enough not to feel laggy. */
const DEBOUNCE_MS = 300;

/**
 * Below this, the picker asks nothing and shows nothing.
 *
 * It used to ask on the empty query too, for the `hs` recently-viewed section, on the theory that a
 * populated resting list beats a blank box. In use that read as a mystery: the list is neither
 * everything nor what you typed, so a work item you had opened in another tab appeared while one you
 * hadn't did not, with nothing on screen explaining the difference. A picker that stays empty until you
 * type is less clever and much easier to trust.
 */
const MIN_QUERY_LENGTH = 2;

/** A work item key as two comparable parts: the project prefix, and the number after the last dash. */
const KEY_PARTS = /^(.*)-(\d+)$/;

/**
 * Work item keys in the order a person reading a list of them expects: project alphabetically, then
 * number **numerically** — so `ABC-2` precedes `ABC-10`, which a plain string sort gets backwards.
 *
 * Anything not shaped like `PREFIX-123` falls back to a plain comparison, which is only about staying
 * deterministic; Jira has no other key shape.
 */
const compareKeys = (left: string, right: string): number => {
  const a = KEY_PARTS.exec(left);
  const b = KEY_PARTS.exec(right);

  if (!a || !b) return left.localeCompare(right);

  return a[1] === b[1] ? Number(a[2]) - Number(b[2]) : a[1].localeCompare(b[1]);
};

/**
 * Work-item suggestions for the Value Report typeahead.
 *
 * **Debounce + React Query rather than `AsyncSelect`'s `loadOptions`.** `loadOptions` hands back a bare
 * promise per keystroke, which means hand-rolling three things React Query already does correctly:
 * caching (backspacing to a query already asked shows instantly), request dedupe, and discarding a
 * stale response that lands after a newer one. The cost is that the select becomes controlled on
 * `inputValue`, which the form does anyway.
 *
 * **Nothing until {@link MIN_QUERY_LENGTH} characters**, so the list is only ever what the user asked
 * for.
 *
 * `useQuery`, not `useSuspenseQuery`: a failed suggestion lookup must leave the modal usable. The
 * caller can still type nothing and pick a field; it just gets no help choosing the work item.
 *
 * See spec/016-report-of-reports/009-value-report-modal Phase 2.
 */
export const useWorkItemSearch = (query: string): WorkItemSearchState => {
  const jira = useJira();
  const trimmed = query.trim();
  const debounced = useDebounce(trimmed, DEBOUNCE_MS);

  const isSearchable = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: jiraKeys.workItemSuggestions(debounced),
    enabled: isSearchable,
    queryFn: async () => {
      const response = await jira.fetchIssuePickerSuggestions(debounced);

      // Both sections, flattened: `cs` is what matched the query and `hs` is recently-viewed, and an
      // item can legitimately be in both. Dedupe by key so it is offered once.
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

      // **Sorted by key, replacing Jira's order.** What came back was two sections concatenated, each in
      // an order the endpoint doesn't document — so the list read as arbitrary, and the same query could
      // reorder itself as the recently-viewed half changed underneath it. Sorting is the whole fix: it
      // makes the list scannable, and it puts `ABC-1` above `ABC-10` when you're part-way through typing
      // a key, which is the case this picker exists for.
      //
      // Jira still chooses *which* items come back — the scope's `order by lastViewed DESC` decides that
      // when there are more matches than it will return. This only decides the order they're shown in.
      return suggestions.sort((left, right) => compareKeys(left.key, right.key));
    },
  });

  return {
    suggestions: isSearchable ? (data ?? []) : [],
    // `isFetching`, not `isPending`: a re-query for a new term should show the spinner even though the
    // previous term's results are still on screen. The second clause covers the debounce window, so a
    // keystroke doesn't leave the field looking settled on the results of the term before it.
    isLoading: isSearchable && (isFetching || trimmed !== debounced),
    /** So the caller can say "keep typing" rather than "no results" for a one-character query. */
    isTooShort: trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH,
  };
};
