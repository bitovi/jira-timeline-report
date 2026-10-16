import type { ReadCurrentAccountId } from './identity';

import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';

import { userKeys } from './key-factory';
import { useUserServices } from './UserServicesProvider';

/**
 * Shared by the hook and by imperative readers (`queryClient.fetchQuery`, e.g. stamping `ownerId`
 * on a new report), so both hit the same cache entry.
 *
 * Only a found id is cached for good: a miss is re-asked next time, so one early `null` (e.g. read
 * before the web login finished) isn't cached for the whole session. A failing reader reads as
 * `null` rather than failing the page — knowing who you are is decoration here.
 */
export const currentAccountIdQuery = (readCurrentAccountId: ReadCurrentAccountId) =>
  queryOptions({
    queryKey: userKeys.currentAccountId,
    queryFn: async (): Promise<string | null> => {
      try {
        return await readCurrentAccountId();
      } catch (error) {
        console.error('Could not tell who the current user is', error);

        return null;
      }
    },
    staleTime: (query) => (query.state.data ? Infinity : 0),
  });

/** The signed-in user's Jira account id, or `null` when there isn't one (sample data, tests). */
export const useCurrentAccountId = (): string | null => {
  const { readCurrentAccountId } = useUserServices();

  return useSuspenseQuery(currentAccountIdQuery(readCurrentAccountId)).data;
};
