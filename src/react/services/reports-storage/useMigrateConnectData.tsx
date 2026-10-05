import type { ConnectMigrationGroupId, PeekConnectProperty } from './connect-migration';
import type { MigrationProgress } from './useMigrateReports';

import { useState } from 'react';

import { useJira } from '../jira';
import { useStorage } from '../storage';
import { connectMigrationGroups, writeConnectMigration } from './connect-migration';

export type ConnectMigrationOutcome = {
  copied: number;
  total: number;
  /** Group labels that could not be copied. */
  failures: string[];
};

const idle: MigrationProgress = { isMigrating: false, copied: 0, total: 0, failures: [] };

/**
 * The real Connect reader, imported lazily so `@forge/bridge` never enters the web build's eager
 * graph. Only reachable on the Forge host, which already bundles that module statically.
 */
export const createPeekConnectProperty =
  (appKey: string): PeekConnectProperty =>
  async <TData,>(key: string) => {
    const { peekConnectProperty } = await import('../../../jira/storage/index.forge');

    return peekConnectProperty<TData>(appKey, key);
  };

/**
 * Copies the chosen groups out of Connect app properties into this host's storage (Forge KVS).
 *
 * **Idempotent by overwrite.** Whatever the destination holds is replaced, so re-running after a
 * partial copy repairs it with no bookkeeping — there is no destination read and no "already there".
 * That is only safe because the flag in `connect-migration` makes this a first-run operation.
 *
 * **The Connect store is never touched.** Read with a non-seeding peek, never written.
 *
 * The flag is written only after a run with no failures.
 *
 * See spec/021-forge/resolver-storage/migration-option.plan.md.
 */
export const useMigrateConnectData = ({ peek: injectedPeek }: { peek?: PeekConnectProperty } = {}) => {
  const storage = useStorage();
  const jira = useJira();
  const [progress, setProgress] = useState<MigrationProgress>(idle);

  const peek = injectedPeek ?? createPeekConnectProperty(jira.appKey);

  const migrate = async (groupIds: ConnectMigrationGroupId[]): Promise<ConnectMigrationOutcome> => {
    const groups = connectMigrationGroups.filter((group) => groupIds.includes(group.id));

    setProgress({ isMigrating: true, copied: 0, total: groups.length, failures: [] });

    const failures: string[] = [];
    let copied = 0;

    for (const group of groups) {
      try {
        // Read the whole group before writing any of it, so a failed read leaves nothing half-done.
        const values = await Promise.all(group.keys.map((key) => peek<unknown>(key)));

        // Sequential, in `keys` order — for reports that puts the pointer before the blob.
        for (const [index, key] of group.keys.entries()) {
          // Never written in Connect: nothing to copy, and writing `undefined` would be worse.
          if (values[index] === undefined) {
            continue;
          }

          await storage.update(key, values[index]);
        }

        copied += 1;
      } catch (error) {
        console.warn(`[connect-migration] could not copy ${group.label}`, error);
        failures.push(group.label);
      }

      setProgress({ isMigrating: true, copied, total: groups.length, failures: [...failures] });
    }

    if (!failures.length) {
      try {
        await writeConnectMigration(storage, groupIds);
      } catch (error) {
        // Everything landed, but without the flag the banner will offer this again. Re-running is
        // harmless (overwrite), so this is reported rather than hidden.
        console.warn('[connect-migration] could not record the migration', error);
        failures.push('Migration record');
      }
    }

    setProgress({ isMigrating: false, copied, total: groups.length, failures });

    return { copied, total: groups.length, failures };
  };

  return { migrate, progress, resetProgress: () => setProgress(idle) };
};
