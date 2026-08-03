import type { Report } from '../../../jira/reports';
import type { ReportTypeTone } from './report-type-meta';

import { reports } from '../../../configuration/reports';
import { reportTypeMeta } from './report-type-meta';

/**
 * What a saved report renders as when it has no `primaryReportType` at all — mirrors
 * route-data.js's `saveJSONToUrlButAlsoLookAtReport_DataWrapper('primaryReportType', REPORTS[0].key, …)`,
 * which clamps a missing or unrecognized type to the first entry in `configuration/reports.ts`.
 * Only an *absent* param is defaulted this way; an explicit-but-unrecognized type (e.g. an old,
 * removed report key) is left alone and falls through to `reportTypeMeta`'s neutral fallback.
 */
const DEFAULT_PRIMARY_REPORT_TYPE = reports[0].key;

export interface DescribedReport {
  report: Report;
  /** `primaryReportType`, defaulted to `start-due` (Gantt Chart) if absent — see route-data.js's clamp. */
  typeKey: string;
  /** `reportTypeMeta(typeKey).name`. */
  typeName: string;
  tone: ReportTypeTone;
  /** '' if absent. */
  jql: string;
}

/**
 * Derives the view-model a report row needs from the stored `Report`. Parses `queryParams` the
 * same way `selectable-reports.ts` already does. Pure — no fetch, no storage.
 */
export const describeReport = (report: Report): DescribedReport => {
  const params = new URLSearchParams(report.queryParams ?? '');
  const typeKey = params.get('primaryReportType') ?? DEFAULT_PRIMARY_REPORT_TYPE;
  const meta = reportTypeMeta(typeKey);

  return {
    report,
    typeKey,
    typeName: meta.name,
    tone: meta.tone,
    jql: params.get('jql') ?? '',
  };
};
