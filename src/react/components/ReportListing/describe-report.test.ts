import { describeReport } from './describe-report';

const report = (queryParams: string) => ({ id: 'a', name: 'Alpha', queryParams });

describe('describeReport', () => {
  it('pulls type and jql out of queryParams', () => {
    const d = describeReport(report('primaryReportType=due&jql=project%3DECOM'));
    expect(d.typeKey).toBe('due');
    expect(d.typeName).toBe('Scatter Plot');
    expect(d.jql).toBe('project=ECOM');
  });

  it('tolerates missing jql', () => {
    const d = describeReport(report('primaryReportType=due'));
    expect(d.jql).toBe('');
  });

  it("defaults an absent primaryReportType to Gantt Chart, matching route-data.js's clamp to REPORTS[0]", () => {
    const d = describeReport(report(''));
    expect(d.typeKey).toBe('start-due');
    expect(d.typeName).toBe('Gantt Chart');
    expect(d.tone).toBe('gantt');
  });

  it('leaves an explicit-but-unrecognized primaryReportType alone (neutral fallback, not Gantt)', () => {
    const d = describeReport(report('primaryReportType=grouper'));
    expect(d.typeKey).toBe('grouper');
    expect(d.typeName).toBe('grouper');
    expect(d.tone).toBe('neutral');
  });
});
