import type { Reports } from '../../../../jira/reports';

import { selectableReports } from './selectable-reports';

const report = (id: string, name: string, queryParams = 'jql=project%3DX&primaryReportType=start-due') => ({
  id,
  name,
  queryParams,
});

const asReports = (...list: ReturnType<typeof report>[]): Reports =>
  Object.fromEntries(list.map((entry) => [entry.id, entry]));

describe('selectableReports', () => {
  it('lists saved reports by name', () => {
    const reports = asReports(report('b', 'Beta'), report('a', 'Alpha'));

    expect(selectableReports(reports).map(({ name }) => name)).toEqual(['Alpha', 'Beta']);
  });

  it('excludes the report currently open, so a document cannot embed itself', () => {
    const reports = asReports(report('a', 'Alpha'), report('b', 'Beta'));

    expect(selectableReports(reports, 'a').map(({ id }) => id)).toEqual(['b']);
  });

  // No nesting a report-of-reports inside another in v1 — the schema supports it, the UI does not
  // offer it. See spec/016-report-of-reports.
  it('excludes other report-of-reports', () => {
    const reports = asReports(
      report('a', 'Alpha'),
      report('b', 'Composed', 'primaryReportType=report-of-reports&report=b'),
    );

    expect(selectableReports(reports).map(({ id }) => id)).toEqual(['a']);
  });

  it('tolerates missing and malformed records', () => {
    const reports: Reports = {
      ...asReports(report('a', 'Alpha')),
      b: undefined,
      c: { id: 'c', name: 'No params' } as Reports[string],
    };

    expect(selectableReports(reports).map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it('returns an empty list when there is nothing to add', () => {
    expect(selectableReports({})).toEqual([]);
  });
});
