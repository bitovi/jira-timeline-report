import type { Migration } from './types';
import type { Report, Reports } from '../fetcher';

import { MIGRATIONS } from './migrations';

export type { Migration } from './types';
export { MIGRATIONS, EOL_MONTHS } from './migrations';

export interface MigrationOutcome {
  /** Migration ids that ran, in table order. Empty when nothing applied. */
  applied: string[];
  /** True iff at least one migration ran. The guard the whole write layer rests on. */
  changed: boolean;
}

/**
 * Runs the table over a copy of `raw`. Pure: the caller's params are never mutated, and nothing
 * here touches the URL, storage or `routeData`.
 *
 * `migrations` is injectable so the runner can be tested without the real table (and so a caller
 * could run a subset), but every production consumer takes the default.
 */
export function migrateQueryParams(
  raw: string | URLSearchParams,
  migrations: Migration[] = MIGRATIONS,
): MigrationOutcome & { params: URLSearchParams } {
  const params = new URLSearchParams(raw);
  const applied: string[] = [];

  for (const migration of migrations) {
    if (!migration.applies(params)) {
      continue;
    }

    migration.migrate(params);
    applied.push(migration.id);
  }

  // `applies` must be false once `migrate` has run, or the write layer would rewrite the shared
  // storage blob on every single load. Cheap to verify (a handful of entries) and only runs when
  // something actually applied, so the common path pays nothing.
  if (applied.length) {
    const notIdempotent = migrations.filter((migration) => applied.includes(migration.id) && migration.applies(params));

    if (notIdempotent.length) {
      console.warn(
        [
          '[reports/migrations] these migrations still report `applies` after running, which would',
          'rewrite storage on every load. Fix their `applies`:',
          notIdempotent.map((migration) => migration.id).join(', '),
        ].join(' '),
      );
    }
  }

  return { params, changed: applied.length > 0, applied };
}

/**
 * Normalizes one saved report. Rebuilds `queryParams` only — every other field is spread through,
 * including ones this build has never heard of (a document saved by a newer client must survive a
 * round trip; `fetcher.test.ts` pins that). Returns the same object identity when nothing applied,
 * so callers can compare by reference.
 */
export function migrateReport(
  report: Report,
  migrations: Migration[] = MIGRATIONS,
): MigrationOutcome & { report: Report } {
  const { params, changed, applied } = migrateQueryParams(report.queryParams ?? '', migrations);

  if (!changed) {
    return { report, changed, applied };
  }

  return { report: { ...report, queryParams: params.toString() }, changed, applied };
}

/**
 * Normalizes the whole saved-reports map — the read layer's entry point. `sections` and any
 * undefined slots (the map is `Partial`) pass through untouched; only `queryParams` is rewritten,
 * and only for the reports that needed it. Returns the same map identity when nothing applied.
 */
export function migrateReports(
  reports: Reports,
  migrations: Migration[] = MIGRATIONS,
): MigrationOutcome & { reports: Reports } {
  const applied = new Set<string>();
  const migrated: Reports = {};

  for (const [id, report] of Object.entries(reports)) {
    if (!report) {
      migrated[id] = report;
      continue;
    }

    const result = migrateReport(report, migrations);

    migrated[id] = result.report;
    result.applied.forEach((migrationId) => applied.add(migrationId));
  }

  const changed = applied.size > 0;

  return { reports: changed ? migrated : reports, changed, applied: [...applied] };
}
