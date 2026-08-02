import { unsupportedReportType } from './unsupportedReportType';

const knownReportTypes = ['start-due', 'due', 'table', 'report-of-reports'];
const url = (search: string) => new URLSearchParams(search);

describe('unsupportedReportType', () => {
  it('names a report type no build has an entry for', () => {
    expect(unsupportedReportType({ urlParams: url('primaryReportType=table2'), knownReportTypes })).toBe('table2');
  });

  it('returns undefined for a type this build renders', () => {
    expect(unsupportedReportType({ urlParams: url('primaryReportType=table'), knownReportTypes })).toBeUndefined();
  });

  // A flag-hidden report is still renderable by URL (SelectReportType resolves against the full
  // list), so it must not be reported as unsupported.
  it('treats every registered type as supported, flag or no flag', () => {
    for (const reportType of knownReportTypes) {
      expect(
        unsupportedReportType({ urlParams: url(`primaryReportType=${reportType}`), knownReportTypes }),
      ).toBeUndefined();
    }
  });

  it('returns undefined when no report type is configured at all (the default renders)', () => {
    expect(unsupportedReportType({ urlParams: url('jql=project%3DORDER'), knownReportTypes })).toBeUndefined();
    expect(unsupportedReportType({ knownReportTypes })).toBeUndefined();
  });

  it('ignores an empty value, which resolves to the default', () => {
    expect(unsupportedReportType({ urlParams: url('primaryReportType='), knownReportTypes })).toBeUndefined();
  });

  // This is the case the shell could not see before: the params never pass through the URL.
  it('reads the open saved report when the URL says nothing', () => {
    const savedReport = { queryParams: 'jql=project%3DORDER&primaryReportType=table2' };

    expect(unsupportedReportType({ urlParams: url('report=r1'), savedReport, knownReportTypes })).toBe('table2');
  });

  // Mirrors proposeValueFromState: a URL param overrides the saved report, so picking a real report
  // type from the dropdown clears the message even though the stored record is still legacy.
  it('lets the URL override the saved report', () => {
    const savedReport = { queryParams: 'primaryReportType=table2' };

    expect(
      unsupportedReportType({ urlParams: url('primaryReportType=start-due'), savedReport, knownReportTypes }),
    ).toBeUndefined();
  });

  it('tolerates a saved report with no queryParams', () => {
    expect(unsupportedReportType({ savedReport: { queryParams: '' }, knownReportTypes })).toBeUndefined();
    expect(unsupportedReportType({ savedReport: null, knownReportTypes })).toBeUndefined();
  });

  // Object key lookup would report `constructor` and friends as supported.
  it('is not fooled by Object prototype keys', () => {
    expect(unsupportedReportType({ urlParams: url('primaryReportType=constructor'), knownReportTypes })).toBe(
      'constructor',
    );
  });
});
