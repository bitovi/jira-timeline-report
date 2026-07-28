import { reports } from './reports';
import { features, featureMap } from './features';

// `reports.ts` is the single source of truth: the "Report type" dropdown, the Settings → Features
// toggle (derived in features.ts from `onByDefault: false`), and `primaryReportType` URL validation
// in route-data.js all read from it. See spec/016-report-of-reports Phase 0.
describe('report registry', () => {
  it('has unique keys and feature flags', () => {
    expect(new Set(reports.map((report) => report.key)).size).toBe(reports.length);
    expect(new Set(reports.map((report) => report.featureFlag)).size).toBe(reports.length);
  });

  describe('report-of-reports', () => {
    const reportOfReports = reports.find((report) => report.key === 'report-of-reports');

    it('is registered and off by default', () => {
      expect(reportOfReports).toBeDefined();
      expect(reportOfReports?.name).toBe('Report of Reports');
      expect(reportOfReports?.featureFlag).toBe('reportOfReports');
      expect(reportOfReports?.onByDefault).toBe(false);
    });

    it('derives a Settings → Features toggle', () => {
      expect(features.map((feature) => feature.featureFlag)).toContain('reportOfReports');
      expect(featureMap.reportOfReports?.name).toBe('Report of Reports');
    });
  });
});
