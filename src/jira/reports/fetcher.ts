import type { StoredNode } from '../../react/reports/ReportOfReports/model/sections';
import type { ReportsBackend } from './backend/types';

import routeData from '../../canjs/routing/route-data';
import { AppStorage } from '../storage/common';
import { migrateReports, type MigrationOutcome } from './migrations';

export type Report = {
  id: string;
  name: string;
  queryParams: string;
  /**
   * Report-of-reports document tree. Absent on every other report type, and absent on
   * report-of-reports saved before this field existed — readers must tolerate that.
   * Type-only import, so this adds no runtime dependency on the React layer.
   * See spec/016-report-of-reports.
   */
  sections?: StoredNode[];
};

export type Reports = Partial<Record<string, Report>>;

export const reportsKey = 'saved-reports';

/**
 * Mirrors the saved-reports map onto `routeData.reportsData`, the fallback every param-backed
 * setting reads when the URL doesn't carry the param itself (`makeParamAndReportDataReducer` in
 * canjs/routing/state-storage.js: URL param, then report param, then the default).
 *
 * Every writer of the `saved-reports` React Query cache has to call this. The two stores hold the
 * same data, and opening a saved report collapses the URL to `?report=<id>` — so a `reportsData`
 * that lags the cache means the settings for the open report resolve to their *defaults*, and an
 * empty `jql` renders as "Configure a JQL in the sidebar" over a report that has one.
 */
export const publishReportsToRouteData = (reports: Reports): void => {
  (routeData as unknown as { reportsData: Reports }).reportsData = reports;
};

export type ReadReportsOutcome = MigrationOutcome & {
  reports: Reports;
  /**
   * Only the reports a migration actually rewrote. The write-back layer needs the subset rather than
   * the map: a Reports Space stores one work item per report, so writing all of them back would be
   * *n* edits where one report changed. `migrateReports` returns unchanged reports by reference,
   * which is what makes this an identity comparison rather than a deep one.
   */
  migrated: Report[];
};

/**
 * Reads the saved reports and normalizes them through the migration table — the correctness layer
 * for every legacy param key. Pure apart from the backend read: it never writes, so a report that
 * cannot be persisted still renders correctly this session.
 *
 * Runs over whatever backend it is given, which is the point: reports loaded out of a Reports Space
 * go through exactly the same migrations, and `publishReportsToRouteData` still fires for them —
 * `routeData.reportsData` is what every param-backed setting falls back to.
 *
 * Returns the migration outcome alongside the reports because the write-back layer needs it: once
 * these reports are normalized, re-running `migrateReports` on them reports `changed: false`, so
 * `changed` has to come out of the call that actually read storage.
 *
 * See spec/018-card-report/saved-report-migrations/plan.md § Wiring.
 */
export const readAllReports = async (backend: ReportsBackend): Promise<ReadReportsOutcome> => {
  const stored = await backend.readAll();
  const { reports, changed, applied } = migrateReports(stored);

  publishReportsToRouteData(reports);

  const migrated = changed
    ? Object.entries(reports).flatMap(([id, report]) => (report && stored[id] !== report ? [report] : []))
    : [];

  return { reports, changed, applied, migrated };
};

export const getAllReports = async (backend: ReportsBackend): Promise<Reports> => {
  const { reports } = await readAllReports(backend);

  return reports;
};

export const updateReports = (storage: AppStorage, updates: Reports): Promise<void> => {
  return storage.update(reportsKey, updates);
};
