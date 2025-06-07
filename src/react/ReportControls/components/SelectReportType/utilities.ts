import type { Report } from '../../../../configuration/reports';

export const getReportTypeOptions = (reports: Report[], features: Record<string, boolean>): Report[] => {
  return reports.filter((report) => {
    return report.onByDefault || (features[report.featureFlag] ?? false);
  });
};
