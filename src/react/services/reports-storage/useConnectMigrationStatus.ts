import type { ConnectMigrationProbe, PeekConnectProperty } from './connect-migration';

import { useQuery } from '@tanstack/react-query';

import { useJira } from '../jira';
import { useStorage } from '../storage';
import { probeConnectData, readConnectMigration } from './connect-migration';
import { reportsStorageKeys } from './key-factory';
import { createPeekConnectProperty } from './useMigrateConnectData';

/**
 * Whether to offer the Connect→KVS migration, and what there is to offer.
 *
 * Order matters — host, then flag, then probe:
 * 1. Forge only. Not about Connect (gone by the time this ships) — it keeps the web build, where
 *    there is nothing to migrate and `@forge/bridge` does not exist, from ever asking.
 * 2. The flag. A migrated install pays exactly one KVS read and never probes.
 * 3. The probe, which never writes (decision 1 of the plan).
 *
 * `null` means "nothing to offer". Not a suspense query: the banner is an aside, and must never hold
 * up the app it sits on top of.
 */
export const useConnectMigrationStatus = ({ peek: injectedPeek }: { peek?: PeekConnectProperty } = {}) => {
  const storage = useStorage();
  const jira = useJira();
  const peek = injectedPeek ?? createPeekConnectProperty(jira.appKey);

  const { data } = useQuery({
    queryKey: reportsStorageKeys.connectMigration(),
    enabled: jira.host === 'forge',
    queryFn: async (): Promise<ConnectMigrationProbe | null> => {
      if (await readConnectMigration(storage)) {
        return null;
      }

      try {
        const probe = await probeConnectData(peek);

        return probe.available.length ? probe : null;
      } catch (error) {
        // The banner renders nothing on error, so without this a failed probe is invisible.
        console.error('[connect-migration] could not read the Connect app properties', error);

        throw error;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  return data ?? null;
};
