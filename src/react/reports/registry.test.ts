import { reports } from '../../configuration/reports';
import { embeddableReportComponents } from './registry';
import { reportComponents } from './shellRegistry';

describe('report component registry', () => {
  // The registry lives outside TimelineReport because looking a report type up now happens from
  // inside a report (ChildReport). See spec/016-report-of-reports Phase 2.
  it('has a component for every registered report type', () => {
    expect(Object.keys(reportComponents).sort()).toEqual(reports.map((report) => report.key).sort());
  });

  it('resolves a report type to a component', () => {
    expect(reportComponents['start-due']).toBeTypeOf('function');
    expect(reportComponents['unregistered']).toBeUndefined();
  });

  // A document can't nest inside another one, and including it would put registry.ts in a cycle
  // with ChildReport.
  it('offers every report except report-of-reports to embedded children', () => {
    expect(Object.keys(embeddableReportComponents).sort()).toEqual(
      reports
        .map((report) => report.key)
        .filter((key) => key !== 'report-of-reports')
        .sort(),
    );
  });
});
