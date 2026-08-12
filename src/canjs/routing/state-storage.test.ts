// @ts-expect-error — state-storage is untyped legacy JS on its way out with route-data.js (spec/011).
import { deleteUrlParam, openReportParam, pushStateObservable, pushUrlSearch } from './state-storage';

/**
 * The once-armed keys `deleteUrlParam` borrows to amend a history entry instead of pushing one.
 * Read straight off the observable because leaving a key armed is the failure this file exists to
 * catch: the next change to it would become a `replaceState` too, costing the report-of-reports
 * document its back/forward history.
 */
const armedKeys = () => (pushStateObservable as unknown as { replaceStateOnceKeys: string[] }).replaceStateOnceKeys;

/** The always-on counterpart, which `pushUrlSearch` suspends and must put back. */
const replaceKeys = () => (pushStateObservable as unknown as { replaceStateKeys: string[] }).replaceStateKeys;

const search = () => window.location.search;

const setSearch = (value: string) => {
  window.history.replaceState({}, '', value || window.location.pathname);
};

describe('deleteUrlParam', () => {
  beforeEach(() => {
    setSearch('');
    armedKeys().length = 0;
  });

  it('removes the param and leaves the rest of the query alone', () => {
    setSearch('?report=doc&sections=%5B%5D&primaryReportType=start-due');

    deleteUrlParam('sections');

    expect(new URLSearchParams(search()).get('sections')).toBeNull();
    expect(new URLSearchParams(search()).get('report')).toBe('doc');
    expect(new URLSearchParams(search()).get('primaryReportType')).toBe('start-due');
  });

  it('removes the last param, leaving no stray "?"', () => {
    setSearch('?sections=%5B%5D');

    deleteUrlParam('sections');

    expect(search()).toBe('');
  });

  it('spends the replaceState arming it took out', () => {
    setSearch('?sections=%5B%5D');

    deleteUrlParam('sections');

    expect(armedKeys()).toEqual([]);
  });

  it('does nothing at all when the param is already gone', () => {
    setSearch('?report=doc');

    deleteUrlParam('sections');

    expect(search()).toBe('?report=doc');
    expect(armedKeys()).toEqual([]);
  });
});

describe('pushUrlSearch', () => {
  beforeEach(() => {
    setSearch('?report=doc');
  });

  it('writes the whole query string', () => {
    pushUrlSearch('?jql=project%3DORDER&compareTo=1296000');

    expect(new URLSearchParams(search()).get('jql')).toBe('project=ORDER');
    expect(new URLSearchParams(search()).get('report')).toBeNull();
  });

  // The reason this function exists. `compareTo` is on `replaceStateKeys` for the compare slider,
  // and one changed key on that list downgrades the *entire* write to a replaceState — so a detach,
  // which inlines a saved report's `compareTo` along with everything else, would leave no history
  // entry and Back would skip straight past the report the user just left.
  it('pushes a history entry even when a replaceState key changes', () => {
    const before = window.history.length;

    pushUrlSearch('?jql=project%3DORDER&compareTo=1296000');

    expect(window.history.length).toBe(before + 1);
  });

  it('puts the suspended keys back, so slider drags still replace', () => {
    const before = [...replaceKeys()];

    pushUrlSearch('?compareTo=1296000');

    expect(replaceKeys()).toEqual(before);
  });
});

describe('openReportParam', () => {
  const reports = {
    saved: { id: 'saved', name: 'Saved', queryParams: 'report=saved&selectedIssueType=Epic' },
    noType: { id: 'noType', name: 'No type', queryParams: 'report=noType' },
  };

  beforeEach(() => {
    setSearch('');
  });

  it('reads the param off the report the URL points at', () => {
    setSearch('?report=saved');

    expect(openReportParam(reports, 'selectedIssueType')).toEqual({ pending: false, value: 'Epic' });
  });

  it('reports no value when no report is open', () => {
    setSearch('?selectedIssueType=Epic');

    expect(openReportParam(reports, 'selectedIssueType')).toEqual({ pending: false, value: null });
  });

  it('reports no value when the open report does not carry the param', () => {
    setSearch('?report=noType');

    expect(openReportParam(reports, 'selectedIssueType')).toEqual({ pending: false, value: null });
  });

  // The window that made a just-saved report lose its `selectedIssueType`: the URL already names
  // the report, so treating "no value" as "unset" here would default and persist over it.
  it('is pending while the reports map is still loading', () => {
    setSearch('?report=saved');

    expect(openReportParam(undefined, 'selectedIssueType')).toEqual({ pending: true, value: null });
  });

  // A deleted (or otherwise unknown) id must not wait forever — callers fall through to defaults.
  it('is not pending for an id the loaded map has no record for', () => {
    setSearch('?report=gone');

    expect(openReportParam(reports, 'selectedIssueType')).toEqual({ pending: false, value: null });
  });
});
