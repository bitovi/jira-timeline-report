import type { Jira } from '../../../jira-oidc-helpers';
import type { AppStorage } from '../../storage/common';
import type { ReportsStorageConfig } from '../../storage/reports-config';
import type { ReportsBackend } from './types';

import { legacyReportsStorageConfig, readReportsStorageConfig } from '../../storage/reports-config';
import { createLegacyReportsBackend } from './legacy';
import { createSpaceReportsBackend } from './space';

export type { ReportsBackend } from './types';
export { createLegacyReportsBackend } from './legacy';
export { createSpaceReportsBackend } from './space';

/**
 * The pointer, read once per session. Module state rather than a React context because it is read
 * by the CanJS boot path and the React tree alike, and because it is a property of the site, not of
 * any component — the same reason `routeData.storage` is where it is.
 */
let currentConfig: ReportsStorageConfig = legacyReportsStorageConfig;
let currentJira: Jira | null = null;

/**
 * Resolves once the boot-time pointer read has landed. Everything that touches reports awaits this,
 * which is what lets `initReportsStorage` be fire-and-forget at boot: no call site has to be ordered
 * after it, and nothing reads reports out of the wrong store while it is in flight.
 */
let ready: Promise<unknown> = Promise.resolve();

/** Memoized so the space backend's id→issue-key map survives between calls. */
let cached: { storage: AppStorage; config: ReportsStorageConfig; backend: ReportsBackend } | null = null;

export const getReportsStorageConfig = (): ReportsStorageConfig => currentConfig;

/**
 * Points the app at a different store. Called by the Storage settings panel once the new pointer is
 * safely written, so the next read goes to the new place without a page reload.
 */
export const setReportsStorageConfig = (config: ReportsStorageConfig): void => {
  currentConfig = config;
  cached = null;
};

/**
 * Reads the pointer for this site. Called once at boot, before anything reads a report.
 *
 * A failure here falls back to `legacy` rather than propagating: that is where the reports of anyone
 * who has never touched this setting already are, so the app still shows them.
 */
export const initReportsStorage = ({
  storage,
  jiraHelpers,
}: {
  storage: AppStorage;
  jiraHelpers: Jira;
}): Promise<ReportsStorageConfig> => {
  currentJira = jiraHelpers;

  ready = readReportsStorageConfig(storage)
    .catch((error) => {
      console.warn('[reports/storage] could not read the reports-storage pointer; using legacy storage', error);

      return legacyReportsStorageConfig;
    })
    .then((config) => {
      setReportsStorageConfig(config);

      return config;
    });

  return ready as Promise<ReportsStorageConfig>;
};

/** Test-only: module state has to be clearable between tests. */
export const resetReportsStorageForTests = (): void => {
  currentConfig = legacyReportsStorageConfig;
  currentJira = null;
  ready = Promise.resolve();
  cached = null;
};

const resolveBackend = (storage: AppStorage): ReportsBackend => {
  if (cached && cached.storage === storage && cached.config === currentConfig) {
    return cached.backend;
  }

  let backend: ReportsBackend;

  if (currentConfig.kind === 'space' && currentJira) {
    backend = createSpaceReportsBackend(currentJira, currentConfig);
  } else {
    if (currentConfig.kind === 'space') {
      console.warn('[reports/storage] a Reports Space is configured but Jira is not available; using legacy storage');
    }

    backend = createLegacyReportsBackend(storage);
  }

  cached = { storage, config: currentConfig, backend };

  return backend;
};

/**
 * The app's reports backend: a stable facade that resolves the real one per call.
 *
 * Per call rather than once, because the pointer is a *setting* — switching it from the Storage
 * panel has to take effect on the next read, and a backend captured in a hook's closure or a query
 * function would keep writing to the old store until a reload.
 */
export const getReportsBackend = (storage: AppStorage): ReportsBackend => {
  const current = async () => {
    await ready;

    return resolveBackend(storage);
  };

  return {
    readAll: async () => (await current()).readAll(),
    upsert: async (report, allReports) => (await current()).upsert(report, allReports),
    remove: async (report, allReports) => (await current()).remove(report, allReports),
    writeMigrated: async (migrated, allReports) => (await current()).writeMigrated(migrated, allReports),
    canWrite: async () => (await current()).canWrite(),
  };
};
