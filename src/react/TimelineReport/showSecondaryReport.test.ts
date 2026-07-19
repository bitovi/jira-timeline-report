import { describe, it, expect } from 'vitest';

import { showSecondaryReport, PRIMARY_REPORT_TYPES_SUPPORTING_SECONDARY } from './showSecondaryReport';

describe('showSecondaryReport', () => {
  it.each(PRIMARY_REPORT_TYPES_SUPPORTING_SECONDARY)(
    "renders the secondary report for a supported primary ('%s') with a Work Breakdown secondaryReportType",
    (primary) => {
      expect(showSecondaryReport(primary, 'status')).toBe(true);
      expect(showSecondaryReport(primary, 'breakdown')).toBe(true);
    },
  );

  it('does NOT render the secondary report for an unsupported primary, even with a stale secondaryReportType', () => {
    // The bug: `?primaryReportType=estimate-analysis&secondaryReportType=status` used to render the
    // Work Breakdown below the Estimate Analysis report.
    expect(showSecondaryReport('estimate-analysis', 'status')).toBe(false);
    expect(showSecondaryReport('estimate-analysis', 'breakdown')).toBe(false);
    expect(showSecondaryReport('table', 'status')).toBe(false);
    expect(showSecondaryReport('flow-metrics', 'breakdown')).toBe(false);
  });

  it('does NOT render for a supported primary when secondaryReportType is none/empty/unknown', () => {
    expect(showSecondaryReport('start-due', 'none')).toBe(false);
    expect(showSecondaryReport('start-due', '')).toBe(false);
    expect(showSecondaryReport('due', undefined)).toBe(false);
    expect(showSecondaryReport('due', 'something-else')).toBe(false);
  });

  it('does NOT render when primaryReportType is undefined', () => {
    expect(showSecondaryReport(undefined, 'status')).toBe(false);
  });
});
