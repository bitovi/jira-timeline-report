import { storedQueryParams } from './storedQueryParams';

describe('storedQueryParams', () => {
  it('stores everything routeData serializes for a normal report', () => {
    const serialized = { jql: 'project = ORDER', primaryReportType: 'start-due', roundTo: 'day' };

    expect(storedQueryParams(serialized)).toEqual(serialized);
  });

  // routeData.serialize() emits all ~51 params including defaults (~1.2KB). A report-of-reports has
  // no JQL, issue type, or table columns, so every one of them is the default — and an absent param
  // resolves to exactly that default. Storing them would waste the shared storage blob.
  // See spec/016-report-of-reports Phase 3.
  it('stores only the report type for a report-of-reports', () => {
    const serialized = {
      jql: '',
      primaryReportType: 'report-of-reports',
      roundTo: 'day',
      tableColumns: '[{"sourceId":"identity:treeSummary"}]',
    };

    expect(storedQueryParams(serialized)).toEqual({ primaryReportType: 'report-of-reports' });
  });

  it('is dramatically smaller for a report-of-reports', () => {
    const bloated = Object.fromEntries([
      ['primaryReportType', 'report-of-reports'],
      ...Array.from({ length: 50 }, (_value, index) => [`param${index}`, 'some-default-value']),
    ]);

    const stored = new URLSearchParams(storedQueryParams(bloated)).toString();

    expect(stored).toBe('primaryReportType=report-of-reports');
  });
});
