import { reportTypeMeta } from './report-type-meta';

describe('reportTypeMeta', () => {
  it('maps a known key to its config name and a tone', () => {
    expect(reportTypeMeta('start-due')).toEqual({ key: 'start-due', name: 'Gantt Chart', tone: 'gantt' });
    expect(reportTypeMeta('due').tone).toBe('scatter');
    expect(reportTypeMeta('report-of-reports')).toEqual({
      key: 'report-of-reports',
      name: 'Report of Reports',
      tone: 'ror',
    });
  });

  it('falls back neutrally for an unknown or missing key', () => {
    expect(reportTypeMeta('mystery')).toEqual({ key: 'mystery', name: 'mystery', tone: 'neutral' });
    expect(reportTypeMeta(undefined).tone).toBe('neutral');
    expect(reportTypeMeta(null).tone).toBe('neutral');
  });
});
