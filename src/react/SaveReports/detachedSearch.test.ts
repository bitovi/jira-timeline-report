import type { Report } from '../../jira/reports';

import { describe, it, expect } from 'vitest';

import { detachedSearch } from './detachedSearch';
import { parseSections } from '../reports/ReportOfReports/model/sections';

const report = (queryParams: string, sections?: Report['sections']): Report => ({
  id: 'r1',
  name: 'Q3 Roadmap',
  queryParams,
  ...(sections ? { sections } : {}),
});

/** The search as a plain object, so assertions read as "these settings" rather than as encoding. */
const settings = (search: string) => Object.fromEntries(new URLSearchParams(search));

describe('detachedSearch', () => {
  // The whole point of the feature: while `?report=<id>` is present, most settings are *not* in the
  // URL — they resolve from the record (`makeParamAndReportDataReducer`). Dropping the id without
  // inlining them would silently reset the report to defaults.
  it('inlines the settings the saved report was supplying', () => {
    const search = detachedSearch({
      currentSearch: '?report=r1',
      savedReport: report('report=r1&jql=project%3DORDER&primaryReportType=start-due&selectedIssueType=Epic'),
    });

    expect(settings(search)).toEqual({
      jql: 'project=ORDER',
      primaryReportType: 'start-due',
      selectedIssueType: 'Epic',
    });
  });

  it('removes the report id', () => {
    const search = detachedSearch({
      currentSearch: '?report=r1',
      savedReport: report('jql=project%3DORDER'),
    });

    expect(new URLSearchParams(search).has('report')).toBe(false);
  });

  // Same precedence the live app gives them: a param in the URL is an edit the user made on top of
  // the saved report, so detaching has to keep the edit, not revert to what was saved.
  it('keeps an edited param over the saved one', () => {
    const search = detachedSearch({
      currentSearch: '?report=r1&selectedIssueType=Story',
      savedReport: report('jql=project%3DORDER&selectedIssueType=Epic'),
    });

    expect(settings(search)).toEqual({ jql: 'project=ORDER', selectedIssueType: 'Story' });
  });

  describe('page-only params', () => {
    // Records were saved from `routeData.serialize()`, so one saved with the Sources sidebar open
    // carries `showSettings=SOURCES` forever. Detaching must not pop that sidebar open.
    it('ignores the ones baked into the record', () => {
      const search = detachedSearch({
        currentSearch: '?report=r1',
        savedReport: report('jql=project%3DORDER&showSettings=SOURCES&fullscreen=true&openAutoSchedulerModal=true'),
      });

      expect(settings(search)).toEqual({ jql: 'project=ORDER' });
    });

    it('leaves the ones describing the page right now alone', () => {
      const search = detachedSearch({
        currentSearch: '?report=r1&settings=SOURCES&fullscreen=true',
        savedReport: report('jql=project%3DORDER'),
      });

      expect(settings(search)).toEqual({ settings: 'SOURCES', fullscreen: 'true', jql: 'project=ORDER' });
    });
  });

  // `URLSearchParams` writes an empty value as a bare `key=`, which every reader parses back to the
  // default anyway — so it is pure URL weight.
  it('drops params saved with an empty value', () => {
    const search = detachedSearch({
      currentSearch: '?report=r1',
      savedReport: report('jql=project%3DORDER&statusesToShow=&groupBy='),
    });

    expect(settings(search)).toEqual({ jql: 'project=ORDER' });
  });

  it('is an empty string when nothing is left', () => {
    expect(detachedSearch({ currentSearch: '?report=r1', savedReport: report('') })).toBe('');
  });

  // A report-of-reports keeps its document in the record's `sections` field, not in `queryParams`
  // (`storedQueryParams.ts` strips everything but the report type). Nothing else would carry it
  // across the detach, and `ReportLayoutProvider` reads "no param, no open report" as an empty
  // document — so the tree would vanish.
  describe('a report-of-reports document', () => {
    const tree = parseSections([{ type: 'saved-report', params: { reportId: 'child-a' } }]);

    it('writes the live tree to the sections param', () => {
      const search = detachedSearch({
        currentSearch: '?report=r1',
        savedReport: report('primaryReportType=report-of-reports'),
        sections: tree,
      });

      const params = new URLSearchParams(search);

      expect(params.get('primaryReportType')).toBe('report-of-reports');
      expect(JSON.parse(params.get('sections') ?? '')).toEqual([
        { type: 'saved-report', params: { reportId: 'child-a' } },
      ]);
    });

    // An edited document already has the param, and it outranks the saved tree — the same rule
    // every other edited setting follows above.
    it('keeps an edited tree already in the URL', () => {
      const search = detachedSearch({
        currentSearch: `?report=r1&sections=${encodeURIComponent('[]')}`,
        savedReport: report('primaryReportType=report-of-reports'),
        sections: tree,
      });

      expect(new URLSearchParams(search).get('sections')).toBe('[]');
    });

    it('writes no param for a report with no document', () => {
      const search = detachedSearch({
        currentSearch: '?report=r1',
        savedReport: report('jql=project%3DORDER'),
        sections: [],
      });

      expect(new URLSearchParams(search).has('sections')).toBe(false);
    });
  });
});
