import type { Report } from '../../../jira/reports';

import { describeReport } from './describe-report';
import { filterReports, highlightSegments, matchesQuery } from './report-search';

const described = (name: string, queryParams = '') => describeReport({ id: name, name, queryParams } as Report);

describe('matchesQuery', () => {
  it('matches the report name, case-insensitively', () => {
    expect(matchesQuery(described('All Outcomes'), 'outcome')).toBe(true);
    expect(matchesQuery(described('All Outcomes'), 'ALL')).toBe(true);
    expect(matchesQuery(described('All Outcomes'), 'zzz')).toBe(false);
  });

  it('matches extra text the caller supplies', () => {
    const withJql = described('Beta', 'jql=project%3DECOM');
    const extra = (d: ReturnType<typeof described>) => [d.jql, undefined, 'Ada Lovelace'];

    expect(matchesQuery(withJql, 'ecom', extra)).toBe(true);
    expect(matchesQuery(withJql, 'lovelace', extra)).toBe(true);
    expect(matchesQuery(withJql, 'ecom')).toBe(false);
  });

  it('matches the report type label', () => {
    expect(matchesQuery(described('Beta', 'primaryReportType=table'), 'table')).toBe(true);
    expect(matchesQuery(described('Beta', 'primaryReportType=due'), 'scatter')).toBe(true);
  });
});

describe('filterReports', () => {
  const rows = [described('Alpha', 'primaryReportType=due'), described('Beta', 'primaryReportType=table')];

  it('filters nothing when the query is empty', () => {
    expect(filterReports(rows, '')).toHaveLength(2);
  });

  it('keeps only the matching rows', () => {
    expect(filterReports(rows, 'alph').map((d) => d.report.name)).toEqual(['Alpha']);
  });
});

describe('highlightSegments', () => {
  it('returns one unmatched segment for an empty query', () => {
    expect(highlightSegments('Alpha', '')).toEqual([{ text: 'Alpha', matched: false }]);
  });

  it('splits around every occurrence, preserving original casing', () => {
    expect(highlightSegments('Alpha alpaca', 'al')).toEqual([
      { text: 'Al', matched: true },
      { text: 'pha ', matched: false },
      { text: 'al', matched: true },
      { text: 'paca', matched: false },
    ]);
  });

  it('handles a query that matches the whole string', () => {
    expect(highlightSegments('Alpha', 'alpha')).toEqual([{ text: 'Alpha', matched: true }]);
  });

  it('leaves a non-matching string whole', () => {
    expect(highlightSegments('Alpha', 'zzz')).toEqual([{ text: 'Alpha', matched: false }]);
  });
});
