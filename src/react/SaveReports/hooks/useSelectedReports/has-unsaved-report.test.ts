import { describe, expect, it } from 'vitest';

import { hasUnsavedReport } from './utilities';

describe('hasUnsavedReport', () => {
  it.each([
    ['', false],
    ['?settings=SOURCES', false],
    ['?primaryReportType=table', false],
    ['?report=abc', false],
    ['?report=abc&settings=REPORTS', false],
    ['?report=abc&jql=project%3DECOM', true],
    ['?report=abc&primaryReportType=table', true],
    ['?jql=project%3DECOM', true],
    ['?primaryReportType=table&loadChildren=true', true],
  ])('%s → %s', (search, expected) => {
    expect(hasUnsavedReport(search)).toBe(expected);
  });
});
