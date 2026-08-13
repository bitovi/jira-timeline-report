import type { AppStorage } from '../../storage/common';
import type { Reports } from '../fetcher';
import type { ReportsBackend } from './types';

import { reportsKey, updateReports } from '../fetcher';

/**
 * Saved reports as one record in the per-host `AppStorage` — a Connect app property in the
 * Jira-embedded build, an entry in the configuration issue's ```json block on the web build.
 *
 * This is what every install has today and what every install keeps until someone opts into a
 * Reports Space, so it is deliberately a pass-through: `readAll` is the same `get`, and all three
 * write paths are the same whole-collection `update`, with the same key and the same payload. If a
 * change here ever alters the bytes written, it has changed behaviour for 100% of users.
 */
export const createLegacyReportsBackend = (storage: AppStorage): ReportsBackend => {
  return {
    readAll: () => storage.get<Reports>(reportsKey).then((reports) => reports || {}),
    // `report` unused on purpose — see the note on `ReportsBackend`. The collection is the record.
    upsert: (_report, allReports) => updateReports(storage, allReports),
    remove: (_report, allReports) => updateReports(storage, allReports),
    writeMigrated: (_migrated, allReports) => updateReports(storage, allReports),
    canWrite: () => storage.storageInitialized(),
  };
};
