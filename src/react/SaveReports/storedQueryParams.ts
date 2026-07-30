const REPORT_OF_REPORTS = 'report-of-reports';

/**
 * The params to persist on a saved report, given whatever `routeData.serialize()` produced.
 *
 * For every existing report type this is the serialized bag unchanged. A report-of-reports keeps
 * only its report type: it has no JQL, issue type, or table columns of its own, so all ~50 other
 * serialized values are defaults, and an absent param already resolves to its default (see
 * `makeParamAndReportDataReducer` in state-storage.js). Dropping them keeps ~1.2KB of dead weight
 * per document out of the storage blob that all app data shares.
 *
 * See spec/016-report-of-reports Phase 3.
 */
export const storedQueryParams = (serialized: Record<string, unknown>): Record<string, unknown> =>
  serialized.primaryReportType === REPORT_OF_REPORTS ? { primaryReportType: REPORT_OF_REPORTS } : serialized;
