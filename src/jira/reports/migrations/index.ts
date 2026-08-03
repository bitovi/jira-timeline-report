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
 * The report-of-reports document tree, as a query param. Same name as the record's own field, and
 * the same value — see `documentParam.ts`'s `SECTIONS_PARAM`, which this deliberately does not
 * import: nothing under `src/jira` points at `src/react`, and a migration must not read a live
 * constant a later edit could change out from under it.
 */
const SECTIONS_KEY = 'sections';

/**
 * Normalizes one saved report. Rebuilds `queryParams` — and, when a migration produced a document,
 * moves it onto the record's own `sections` field. Every other field is spread through, including
 * ones this build has never heard of (a document saved by a newer client must survive a round trip;
 * `fetcher.test.ts` pins that). Returns the same object identity when nothing applied, so callers
 * can compare by reference.
 *
 * **Why the lift, rather than a `queryParams['sections']` fallback in the provider.**
 * `ReportLayoutProvider` reads the saved tree in four places (the lazy initializer, the URL-change
 * listener, the `savedKey` re-seed effect and `resetSections`), and `sectionsBaseline` in
 * `documentParam.ts` computes the baseline `updateUrlParam` compares against — five. Miss one and
 * the document silently blanks: the re-seed effect fires on mount, sees no URL param so doesn't
 * bail, computes the saved tree as empty, finds that differs from what's on screen, and adopts the
 * empty tree. Putting the document in the field the provider already reads deletes that whole class
 * of bug, and the save path already writes that field.
 *
 * A URL, by contrast, needs no lift at all: `sections` *is* a real URL param, and the provider reads
 * it first. See spec/018-card-report/alt-plan.md § Two destinations.
 */
export function migrateReport(
  report: Report,
  migrations: Migration[] = MIGRATIONS,
): MigrationOutcome & { report: Report } {
  const { params, changed, applied } = migrateQueryParams(report.queryParams ?? '', migrations);

  if (!changed) {
    return { report, changed, applied };
  }

  const document = params.get(SECTIONS_KEY);

  // Guarded on the record having no document already, so a lift can never clobber one. No entry in
  // the table today can hit that guard — `secondary-report-to-inline-document` declines to run on a
  // config that is already a document — but the guard is what makes the lift safe for the next one.
  if (document !== null && !report.sections?.length) {
    try {
      const sections = JSON.parse(document);

      params.delete(SECTIONS_KEY);

      return { report: { ...report, queryParams: params.toString(), sections }, changed, applied };
    } catch {
      // A hand-mangled record whose `sections` param isn't JSON. Leave it in `queryParams` rather
      // than dropping it: the provider's own reader is tolerant, and a migration must not lose data
      // it cannot understand.
    }
  }

  return { report: { ...report, queryParams: params.toString() }, changed, applied };
}

/**
 * Normalizes the whole saved-reports map — the read layer's entry point. Undefined slots (the map is
 * `Partial`) pass through untouched, and every report keeps every other field; only `queryParams` is
 * rewritten — plus `sections`, for a report a migration turned into a document and which had none.
 * Only the reports that needed it are touched. Returns the same map identity when nothing applied.
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
