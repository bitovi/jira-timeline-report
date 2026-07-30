import type { Report, Reports } from '../../../../jira/reports';

const REPORT_OF_REPORTS = 'report-of-reports';

const isReportOfReports = (report: Report): boolean =>
  new URLSearchParams(report.queryParams ?? '').get('primaryReportType') === REPORT_OF_REPORTS;

/**
 * The saved reports the "Add Report" picker offers, ordered by name.
 *
 * Excludes the report currently open (a document can't embed itself) and any other
 * report-of-reports (no nesting in v1 — the schema supports it, the UI doesn't offer it).
 * See spec/016-report-of-reports.
 */
export const selectableReports = (reports: Reports, currentReportId?: string | null): Report[] =>
  Object.values(reports)
    .filter((report): report is Report => !!report)
    .filter((report) => report.id !== currentReportId && !isReportOfReports(report))
    .sort((a, b) => a.name.localeCompare(b.name));
