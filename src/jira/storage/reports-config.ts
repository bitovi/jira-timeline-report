import type { AppStorage } from './common';

/**
 * Where this site's saved reports live — the pointer, not the reports.
 *
 * `legacy` is what every install has today: one record holding the whole collection (a Connect app
 * property in the Jira-embedded build, an entry in the configuration issue's code block on the web
 * build). `space` puts each saved report in its own Jira work item inside `spaceName`, which removes
 * the 32KB ceiling on the collection and — because a space is readable by both builds — is the one
 * option where the two hosts can see the same saved reports.
 *
 * The pointer itself is tiny and stays in the per-host `AppStorage`, so each host answers "where do
 * my reports live" without needing the other's store.
 *
 * See spec/026-storage-saved-reports/plan.md § The pointer.
 */
export type ReportsStorageConfig = { kind: 'legacy' } | { kind: 'space'; spaceName: string; spaceType: string };

export const reportsStorageConfigKey = 'reports-storage-config';

export const legacyReportsStorageConfig: ReportsStorageConfig = { kind: 'legacy' };

/**
 * Reads a stored pointer as tolerantly as the report-of-reports schema reads an `UnknownNode`: a
 * `kind` written by a newer client, or a `space` pointer missing the fields it needs, degrades to
 * `legacy` with a warning instead of throwing.
 *
 * That direction matters. `legacy` is where the reports of anyone who has never touched this setting
 * already are, so falling back shows an older client the reports it can actually read; throwing
 * would take the whole app down over a setting.
 */
export const parseReportsStorageConfig = (raw: unknown): ReportsStorageConfig => {
  if (!raw || typeof raw !== 'object') {
    return legacyReportsStorageConfig;
  }

  const { kind, spaceName, spaceType } = raw as Record<string, unknown>;

  // Nothing has ever been written (the plugin store seeds `{}` on first read), which is `legacy`.
  if (kind === undefined) {
    return legacyReportsStorageConfig;
  }

  if (kind === 'legacy') {
    return legacyReportsStorageConfig;
  }

  if (kind === 'space') {
    if (typeof spaceName === 'string' && spaceName && typeof spaceType === 'string' && spaceType) {
      return { kind: 'space', spaceName, spaceType };
    }

    console.warn(
      '[reports/storage] a "space" reports-storage pointer is missing spaceName or spaceType; using legacy storage',
      raw,
    );

    return legacyReportsStorageConfig;
  }

  console.warn(`[reports/storage] unrecognised reports-storage pointer "${String(kind)}"; using legacy storage`);

  return legacyReportsStorageConfig;
};

export const readReportsStorageConfig = (storage: AppStorage): Promise<ReportsStorageConfig> => {
  return storage
    .get<ReportsStorageConfig>(reportsStorageConfigKey, legacyReportsStorageConfig)
    .then(parseReportsStorageConfig);
};

export const writeReportsStorageConfig = (storage: AppStorage, config: ReportsStorageConfig): Promise<void> => {
  return storage.update(reportsStorageConfigKey, config);
};
