import { useSuspenseQuery } from '@tanstack/react-query';

import { useJira } from './JiraProvider';
import { jiraKeys } from './key-factory';
import { useCanObservable, type CanObservable } from '../../hooks/useCanObservable';
import routeData from '../../../canjs/routing/route-data';
import { bitoviTrainingFields } from '../../../examples/bitovi-training';

type IssueFields = Array<{
  name: string;
  key: string;
  schema: Record<string, string>;
  id: string;
  custom: boolean;
  clauseNames: string[];
  searchable: boolean;
  navigable: boolean;
  orderable: boolean;
}>;

export type UseJiraIssueFields = () => IssueFields;

// When `routeData.isLoggedInObservable` isn't wired yet (e.g. some tests), assume logged-in so we
// preserve the previous "always fetch from Jira" behavior rather than silently serving sample data.
const ASSUME_LOGGED_IN: CanObservable<boolean> = {
  value: true,
  get: () => true,
  getData: () => true,
  on: () => {},
  off: () => {},
  set: () => {},
};

/**
 * The Jira field catalog. Mirrors route-data's `jiraFieldsPromise`: when logged in it fetches from
 * Jira, and when logged OUT it serves the bundled `bitovi-training` sample fields — so the Table
 * report (and any other field-driven UI) works in the logged-out sample experience instead of
 * erroring on a network call. Login state is part of the query key so switching login refetches.
 */
export const useJiraIssueFields: UseJiraIssueFields = () => {
  const { fetchJiraFields } = useJira();
  const isLoggedIn = useCanObservable(
    (routeData.isLoggedInObservable as unknown as CanObservable<boolean> | null) ?? ASSUME_LOGGED_IN,
  );

  const { data } = useSuspenseQuery({
    queryKey: [...jiraKeys.allIssueFields(), isLoggedIn ? 'auth' : 'sample'],
    queryFn: async () => {
      // TODO fix types here
      if (!isLoggedIn) {
        return (await bitoviTrainingFields()) as unknown as IssueFields;
      }
      return fetchJiraFields() as unknown as IssueFields;
    },
  });

  return data.sort((lhs, rhs) => lhs.name.toLowerCase().localeCompare(rhs.name.toLowerCase()));
};
