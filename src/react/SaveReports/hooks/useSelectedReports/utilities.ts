import type { Reports, Report } from '../../../../jira/reports';

export const paramsEqual = (lhs: URLSearchParams, rhs: URLSearchParams): boolean => {
  const lhsEntries = [...lhs.entries()];
  const rhsEntries = [...rhs.entries()];

  if (lhsEntries.length !== rhsEntries.length) {
    return false;
  }

  return lhsEntries.reduce((isEqual, [lhsName, lhsValue]) => {
    return isEqual && rhsEntries.some(([rhsName, rhsValue]) => lhsName === rhsName && lhsValue === rhsValue);
  }, true);
};

export const getReportFromParams = (reports: Reports): Report | undefined => {
  const params = new URLSearchParams(window.location.search);
  const selectedReport = params.get('report');

  if (!selectedReport) {
    return;
  }

  return Object.values(reports)
    .filter((report) => !!report)
    .find(({ id }) => id === selectedReport);
};

export const paramsMatchReport = (
  params: URLSearchParams,
  reports: Reports,
  paramsToOmit: string[] = ['settings', 'report'],
) => {
  const report = getReportFromParams(reports);

  if (!report) {
    return false;
  }

  const reportParams = new URLSearchParams(report.queryParams);

  for (const param of paramsToOmit) {
    reportParams.delete(param);
    params.delete(param);
  }

  return [...params.entries()].length === 0;
  // return paramsEqual(reportParams, params);
};

/**
 * Whether leaving the current URL would drop work the user hasn't saved. Same rule as
 * `paramsMatchReport`: a saved report collapses the URL to `?report=<id>`, so any other param on it
 * is an unsaved change. With no saved report open, anything beyond the report type counts — a JQL,
 * a view setting, a report-of-reports tree. `settings` (which sidebar panel is open) never does.
 */
export const hasUnsavedReport = (search: string | URLSearchParams): boolean => {
  const params = new URLSearchParams(search);

  params.delete('settings');

  if (params.has('report')) {
    params.delete('report');
  } else {
    params.delete('primaryReportType');
  }

  return [...params.keys()].length > 0;
};
