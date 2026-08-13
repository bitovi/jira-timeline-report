import type { ReportsStorageConfig } from '../../../jira/storage/reports-config';

import { useSuspenseQuery } from '@tanstack/react-query';

import { readReportsStorageConfig } from '../../../jira/storage/reports-config';
import { useStorage } from '../storage';
import { reportsStorageKeys } from './key-factory';

/**
 * The saved pointer for **this** host. The Storage panel's other card documents how the other host
 * works but shows no state: a Connect app property is a Connect-only REST resource the web build
 * cannot read, so there is no live value to show in that direction.
 */
export const useReportsStorageConfig = (): ReportsStorageConfig => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: reportsStorageKeys.config(),
    queryFn: () => readReportsStorageConfig(storage),
  });

  return data;
};
