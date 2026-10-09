import type { AppStorage } from '../../../jira/storage/common';
import type { ReportsStorageConfig } from '../../../jira/storage/reports-config';

import { reportsKey } from '../../../jira/reports/fetcher';
import { parseReportsStorageConfig, reportsStorageConfigKey } from '../../../jira/storage/reports-config';
import { featuresKey } from '../features/key-factory';
import { fontKey, themeKey } from '../theme/key-factory';
import { allTeamDataKey } from '../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/key-factory';

/**
 * The one-time copy of an existing customer's data out of Connect app properties and into Forge's
 * KVS. See spec/021-forge/resolver-storage/migration-option.plan.md.
 *
 * Time-boxed: reading app properties only works while manifest.yml declares `app.connect.key`, so
 * this whole module expires with it.
 */

/** Reads one Connect app property without writing it — `undefined` when it was never written. */
export type PeekConnectProperty = <TData>(key: string) => Promise<TData | undefined>;

/**
 * The "already migrated" flag. Lives in KVS rather than app properties because it describes the KVS
 * store: clear KVS and the flag goes with it, so re-migrating is correct rather than blocked.
 */
export const connectMigrationKey = 'connect-migration';

export type ConnectMigrationRecord = { migratedAt: string; groups: ConnectMigrationGroupId[] };

export type ConnectMigrationGroupId = 'reports' | 'teams' | 'appearance' | 'features';

export type ConnectMigrationGroup = {
  id: ConnectMigrationGroupId;
  label: string;
  /**
   * Written in this order. For reports that is load-bearing: the pointer lands before the blob, so a
   * failed blob write leaves Forge on the space (correct) rather than on `legacy` showing stale
   * reports until the retry.
   */
  keys: string[];
};

/** Four checkboxes, six keys. */
export const connectMigrationGroups: ConnectMigrationGroup[] = [
  { id: 'reports', label: 'Saved reports', keys: [reportsStorageConfigKey, reportsKey] },
  { id: 'teams', label: 'Team settings', keys: [allTeamDataKey] },
  // Users think "my appearance", not "two app properties" — one checkbox, failing as a unit.
  { id: 'appearance', label: 'Appearance', keys: [themeKey, fontKey] },
  { id: 'features', label: 'Feature toggles', keys: [featuresKey] },
];

export const readConnectMigration = async (storage: AppStorage): Promise<ConnectMigrationRecord | null> => {
  const record = await storage.get<ConnectMigrationRecord>(connectMigrationKey, null);

  return record && typeof record === 'object' && 'migratedAt' in record ? record : null;
};

export const writeConnectMigration = (storage: AppStorage, groups: ConnectMigrationGroupId[]): Promise<void> => {
  const record: ConnectMigrationRecord = { migratedAt: new Date().toISOString(), groups };

  return storage.update(connectMigrationKey, record);
};

/**
 * What the Connect store holds that is worth offering to copy.
 *
 * Connect's own `get()` seeds `{}` on a first read, so almost every Connect install has *some*
 * value under most keys. An empty object is what a seeded-but-never-saved key looks like, and is
 * not worth a banner.
 */
export type ConnectMigrationProbe = {
  available: ConnectMigrationGroupId[];
  /** The Connect pointer, so the banner and modal can say "your reports are in {space}". */
  reportsConfig: ReportsStorageConfig;
  /** Reports in the Connect `saved-reports` blob. */
  reportCount: number;
};

const hasContent = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
};

export const probeConnectData = async (peek: PeekConnectProperty): Promise<ConnectMigrationProbe> => {
  const keys = connectMigrationGroups.flatMap((group) => group.keys);
  const values = await Promise.all(keys.map((key) => peek<unknown>(key)));
  const byKey = Object.fromEntries(keys.map((key, index) => [key, values[index]]));

  const reportsConfig = parseReportsStorageConfig(byKey[reportsStorageConfigKey]);
  const reports = byKey[reportsKey];
  const reportCount =
    reports && typeof reports === 'object'
      ? Object.values(reports as Record<string, unknown>).filter(Boolean).length
      : 0;

  const available = connectMigrationGroups
    .filter((group) => {
      // A `legacy` pointer on its own is the default, not data. A `space` pointer is — it is what
      // keeps Forge on the space once copied.
      if (group.id === 'reports') {
        return reportsConfig.kind === 'space' || reportCount > 0;
      }

      return group.keys.some((key) => hasContent(byKey[key]));
    })
    .map((group) => group.id);

  return { available, reportsConfig, reportCount };
};
