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
