import type { AppStorage } from '../../storage/common';
import type { Reports } from '../fetcher';
import type { MigrationOutcome } from './index';

import { updateReports } from '../fetcher';

export type PersistMigrationsResult =
  | 'nothing-to-migrate'
  | 'already-attempted'
  | 'not-logged-in'
  | 'storage-not-initialized'
  | 'failed'
  | 'written';

/**
 * One attempt per page load. `useAllReports` refetches on every invalidation — and
 * `useSaveReports` invalidates after every save — but this is a convergence step, not a per-fetch
 * one. Module scope rather than a storage key on purpose: nothing about "did we already try" is
 * worth persisting, and a failed attempt should simply be retried on the next load.
 */
let attempted = false;

/** Test-only: the once-per-session latch is module state, so tests have to be able to clear it. */
export const resetPersistMigrationsForTests = (): void => {
  attempted = false;
};

/**
 * Writes read-time-migrated reports back to storage, so stored data converges and migrations can
 * eventually be deleted. Correctness never depends on this — the read layer already normalized this
 * session — so every failure mode here is a no-op that gets retried on the next load.
 *
 * Takes the outcome of the read that produced `reports` rather than re-deriving it: once the read
 * layer has normalized, a second `migrateReports` pass would report `changed: false` and this would
 * never write anything.
 *
 * The storage blob is shared by the whole Jira site (app properties are per-installation) and
 * `updateReports` overwrites it wholesale, so this must stay a rare event — hence the `changed`
 * guard, which caps it at one write per install per migration.
 *
 * See spec/018-card-report/saved-report-migrations/plan.md § Wiring.
 */
export const persistMigrations = async (
  storage: AppStorage,
  { reports, changed, applied }: MigrationOutcome & { reports: Reports },
  { isLoggedIn }: { isLoggedIn: boolean },
): Promise<PersistMigrationsResult> => {
  // Cheapest and by far the most common outcome: storage is already up to date. Checked before the
  // latch so a later fetch in this session can still write if it finds something to migrate.
  if (!changed) {
    return 'nothing-to-migrate';
  }

  if (!isLoggedIn) {
    return 'not-logged-in';
  }

  if (attempted) {
    return 'already-attempted';
  }

  attempted = true;

  try {
    // The web backend's `update` throws without a configuration issue, and its `get` returns null
    // in that state (so `changed` would be false anyway) — this is the documented precondition.
    if (!(await storage.storageInitialized())) {
      return 'storage-not-initialized';
    }

    await updateReports(storage, reports);
    console.log(`[reports/migrations] persisted migrated saved reports: ${applied.join(', ')}`);

    return 'written';
  } catch (error) {
    console.warn('[reports/migrations] could not persist migrated saved reports; will retry next load', error);

    return 'failed';
  }
};
