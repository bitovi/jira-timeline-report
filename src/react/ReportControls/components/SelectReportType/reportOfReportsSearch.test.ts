import { describe, it, expect } from 'vitest';

import { reportOfReportsSearch } from './reportOfReportsSearch';

const settings = (search: string) => Object.fromEntries(new URLSearchParams(search));

describe('reportOfReportsSearch', () => {
  // A report-of-reports reads none of the old report's settings, so none of them come along.
  it('detaches and keeps only the report type', () => {
    const search = reportOfReportsSearch(
      '?report=r1&primaryReportType=due&jql=project%3DORDER&childJQL=type%3DStory&selectedIssueType=Epic' +
        '&compareTo=1296000&timingCalculations=%5Bobject+Object%5D',
    );

    expect(settings(search)).toEqual({ primaryReportType: 'report-of-reports' });
  });

  it('keeps the params that describe the page', () => {
    const search = reportOfReportsSearch('?report=r1&jql=project%3DORDER&settings=SOURCES&fullscreen=true');

    expect(settings(search)).toEqual({
      primaryReportType: 'report-of-reports',
      settings: 'SOURCES',
      fullscreen: 'true',
    });
  });
});
