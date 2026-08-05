import type { StoredNode } from '../../react/reports/ReportOfReports/model/sections';

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

const reportsKey = 'saved-reports';

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

/**
 * Reads the saved reports and normalizes them through the migration table — the correctness layer
 * for every legacy param key. Pure apart from the existing `storage.get`: it never writes, so a
 * report that cannot be persisted still renders correctly this session.
 *
 * Returns the migration outcome alongside the reports because the write-back layer needs it: once
 * these reports are normalized, re-running `migrateReports` on them reports `changed: false`, so
 * `changed` has to come out of the call that actually read storage.
 *
 * See spec/018-card-report/saved-report-migrations/plan.md § Wiring.
 */
export const readAllReports = async (storage: AppStorage): Promise<MigrationOutcome & { reports: Reports }> => {
  const stored = await storage.get<Reports>(reportsKey).then((reports) => reports || {});
  const { reports, changed, applied } = migrateReports(stored);

  publishReportsToRouteData(reports);

  return { reports, changed, applied };
};

export const getAllReports = async (storage: AppStorage): Promise<Reports> => {
  const { reports } = await readAllReports(storage);

  return reports;
};

export const updateReports = (storage: AppStorage, updates: Reports): Promise<void> => {
  return storage.update(reportsKey, updates);
};
