export type StartDueReport = { key: 'start-due'; name: 'Gantt Chart' };
export type DueReport = { key: 'due'; name: 'Scatter Plot' };
export type TableReport = { key: 'table'; name: 'Estimation Table' };
export type Report = StartDueReport | DueReport | TableReport;

export const getReportTypeOptions = (reports: Report[], includeTable: boolean): Report[] => {
  return reports.filter((report) => includeTable || report.key !== 'table');
};
