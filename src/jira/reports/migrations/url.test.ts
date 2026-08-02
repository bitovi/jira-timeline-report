import { migrateUrlParams } from './url';

// The URL consumer of the shared table. `directlyReplaceUrlSearch` writes with the underlying
// `history.replaceState` (deliberately without notifying `pushStateObservable`), so jsdom's URL is
// the whole observable surface here.
const setSearch = (search: string) => window.history.replaceState({}, '', search ? `/?${search}` : '/');
const search = () => new URLSearchParams(window.location.search);

describe('migrateUrlParams', () => {
  beforeEach(() => {
    setSearch('');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rewrites a legacy breakdown link', () => {
    setSearch('primaryReportType=breakdown&jql=project%3DORDER');

    expect(migrateUrlParams()).toEqual(['breakdown-primary-report-type']);
    expect(search().get('primaryReportType')).toBe('start-due');
    expect(search().get('primaryReportBreakdown')).toBe('true');
    expect(search().get('jql')).toBe('project=ORDER');
  });

  // A migration can remove a key, which the diff has to apply too — an earlier version of this
  // layer only wrote the keys present in the output and left the legacy one behind.
  it('removes a key a migration deleted', () => {
    setSearch('primaryIssueType=Initiative');

    expect(migrateUrlParams()).toEqual(['primary-issue-type-to-selected']);
    expect(search().has('primaryIssueType')).toBe(false);
    expect(search().get('selectedIssueType')).toBe('Initiative');
  });

  it('touches nothing when there is nothing to migrate', () => {
    setSearch('jql=project%3DORDER&primaryReportType=table');

    expect(migrateUrlParams()).toEqual([]);
    expect(window.location.search).toBe('?jql=project%3DORDER&primaryReportType=table');
  });

  it('handles an empty URL', () => {
    expect(migrateUrlParams()).toEqual([]);
    expect(window.location.search).toBe('');
  });

  it('is idempotent — a second run finds nothing to do', () => {
    setSearch('primaryReportType=table2&primaryIssueType=Epic');
    migrateUrlParams();

    const afterFirst = window.location.search;

    expect(migrateUrlParams()).toEqual([]);
    expect(window.location.search).toBe(afterFirst);
    expect(search().get('primaryReportType')).toBe('table');
    expect(search().get('selectedIssueType')).toBe('Epic');
  });
});
