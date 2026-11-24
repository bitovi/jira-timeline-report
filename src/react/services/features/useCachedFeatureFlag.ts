import { useSyncExternalStore } from 'react';

import { queryClient } from '../query/queryClient';
import { featuresKeyFactory } from './key-factory';
import type { FeatureFlags } from '../../../jira/features';

function read(flag: string): boolean {
  const features = queryClient.getQueryData<FeatureFlags>(featuresKeyFactory.features());
  return Boolean(features?.[flag]);
}

/**
 * A feature flag read from the shared query cache, for components rendered outside the storage and
 * query providers (reports mounted from the registry, their modals). Reads `false` until something
 * that does have the providers (the settings sidebar) has loaded the flags, then updates.
 */
export function useCachedFeatureFlag(flag: string): boolean {
  return useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => read(flag),
    () => false,
  );
}
