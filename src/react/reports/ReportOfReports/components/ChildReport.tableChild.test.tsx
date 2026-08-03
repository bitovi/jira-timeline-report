/**
 * A Table (beta) report embedded in a report-of-reports, driven end to end: the real
 * `ChildReportConfig`, the real view model, the real `TableReport`, and a fake Jira whose two
 * requests the test settles by hand.
 *
 * It exists for one ordering. A child's issue fetch and the Table report's field-catalog fetch race,
 * and the table is the only report that *suspends* while it waits (`useJiraIssueFields` is a
 * `useSuspenseQuery`, called after the report reads its issue observables). React throws a suspended
 * render away and skips its effects, so for as long as the catalog is outstanding nothing is
 * subscribed to the issues that are on their way.
 *
 * When the issues won that race the table rendered its headers over an empty body and stayed that
 * way, because a bound CanJS observable does not re-announce a value it already holds — see the
 * re-read in `useCanObservable`. Adding a report hit it; reloading did not, since one `/field` call
 * resolves long before a JQL fetch with changelogs. Hence a case per order.
 *
 * The real `TableReport` is deliberately not stubbed: a stand-in that merely throws a promise does
 * NOT reproduce this, so a lighter test would pass with the bug present.
 */
import React, { Suspense } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ObservableObject, value } from '../../../../can';
import { ChildReport } from './ChildReport';
import { JiraProvider } from '../../../services/jira';
import { StorageProvider } from '../../../services/storage';
import { ReportLayoutProvider } from '../../../services/report-layout';
import { ReportOfReports } from '../ReportOfReports';
import { SECTIONS_PARAM } from '../model/documentParam';
import { TableReport } from '../../TableReport/TableReport';

// can.js has loose (.js) types — ObservableObject's declaration exposes no static props hook.
const ObservableObjectClass = ObservableObject as any;
const valueAny = value as any;

const deferred = <T,>() => {
  let settle: (resolved: T) => void = () => {};
  const promise = new Promise<T>((resolve) => (settle = resolve));

  return { promise, settle: (resolved: T) => settle(resolved) };
};

/** The child's own JQL fetch. */
let issues = deferred<unknown[]>();
/** The Table report's field catalog (`useJiraIssueFields`). */
let fields = deferred<unknown[]>();

/** A raw Jira issue in the named-fields shape the normalize / derive / rollup pipeline expects. */
const rawIssue = (key: string, summary: string) => ({
  id: key,
  key,
  fields: {
    Summary: summary,
    'Issue Type': { hierarchyLevel: 1, name: 'Epic' },
    Created: '2023-02-03T10:58:38.994-0600',
    Team: null,
    Parent: null,
    Sprint: null,
    'Epic Link': null,
    // The rollup/rollback pass walks releases, so this has to be a list rather than absent.
    'Fix versions': [],
    Labels: [],
    'Start date': '20220715',
    'Due date': '20220716',
    Rank: '0|hzzzzn:',
    Status: { id: '1', name: 'Done', statusCategory: { name: 'Done' } },
    'Project key': 'ORDER',
    'Issue key': key,
  },
  changelog: [],
});

const ISSUES = [rawIssue('ORDER-1', 'language packs'), rawIssue('ORDER-2', 'auth rewrite')];

const FIELD_CATALOG = [
  {
    id: 'summary',
    key: 'summary',
    name: 'Summary',
    custom: false,
    schema: { type: 'string' },
    clauseNames: ['summary'],
    searchable: true,
    navigable: true,
    orderable: true,
  },
];

class FakeParent extends ObservableObjectClass {
  static props = {
    jiraHelpers: { default: null },
    isLoggedInObservable: { default: null },
    licensingPromise: { default: null },
    normalizeOptions: { default: null },
    simplifiedIssueHierarchy: {
      get default() {
        // The child picks its top level out of the hierarchy: an empty one leaves it with no
        // top-level issues to hand a report however well the fetch went.
        return [{ name: 'Epic', hierarchyLevel: 1 }];
      },
    },
    fieldsToRequest: {
      get default() {
        return [];
      },
    },
    fieldMaps: { default: undefined },
  };
}

/** How many times a child has started its issue fetch. A sort must not add to this. */
let fetches = 0;

const makeParent = () => {
  const parent = new FakeParent() as any;
  const fetch = () => {
    fetches += 1;

    return issues.promise;
  };

  parent.isLoggedInObservable = valueAny.with(true);
  parent.licensingPromise = Promise.resolve({ active: true });
  parent.normalizeOptions = { getUrl: ({ key }: any) => `/browse/${key}` };
  parent.jiraHelpers = {
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: fetch,
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: fetch,
  };

  return parent;
};

/** A saved Table report as one is stored: the report type plus its persisted view state. */
const TABLE_PARAMS = new URLSearchParams({
  jql: 'project = ORDER',
  primaryReportType: 'table',
  tableColumns: JSON.stringify([{ sourceId: 'identity:treeSummary' }]),
  tableSortColumn: 'identity:treeSummary',
  tableSortDir: 'tree',
}).toString();

const renderTableChild = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <JiraProvider jira={{ fetchJiraFields: () => fields.promise } as any}>
        <Suspense fallback="loading">
          <ChildReport
            report={{ id: 'r', name: 'Order Table', queryParams: TABLE_PARAMS }}
            parent={makeParent()}
            components={{ table: TableReport }}
          />
        </Suspense>
      </JiraProvider>
    </QueryClientProvider>,
  );

const rows = () => screen.findByText('language packs');

describe('an embedded Table (beta) report', () => {
  beforeEach(() => {
    issues = deferred<unknown[]>();
    fields = deferred<unknown[]>();
    fetches = 0;
  });

  // Reloading a saved document: the catalog resolves first, so the table is mounted and subscribed
  // before its issues arrive. This order always worked.
  it('renders its rows when the field catalog resolves before the issues', async () => {
    renderTableChild();

    fields.settle(FIELD_CATALOG);
    await waitFor(() => expect(screen.queryByText('Loading table…')).not.toBeInTheDocument());

    issues.settle(ISSUES);

    expect(await rows()).toBeInTheDocument();
  });

  // Adding a report to an open document: the issues land while the table is still suspended on its
  // catalog, with nothing subscribed to receive them. This is the order that broke.
  it('renders its rows when the issues land while it is still suspended', async () => {
    renderTableChild();

    issues.settle(ISSUES);
    await new Promise((resolve) => setTimeout(resolve, 50));

    fields.settle(FIELD_CATALOG);

    expect(await rows()).toBeInTheDocument();
  });

  /**
   * The end-to-end case for spec/016-report-of-reports/006-url-state: sort a Table child, and the
   * click is in the page URL before the render finishes — so a refresh brings the sort back.
   *
   * Driven through the whole real stack (document → node → ChildReport → ChildReportConfig →
   * TableReport) because every layer of it is load-bearing: the report's `sortDirObs.value =`
   * write, the config's `lastSet` announcement, the child's compare-against-saved, and the
   * provider's URL write.
   */
  describe('sorted inside a document', () => {
    const SAVED_REPORTS = {
      table: { id: 'table', name: 'Order Table', queryParams: TABLE_PARAMS },
      other: { id: 'other', name: 'Other', queryParams: 'jql=project%3DX&primaryReportType=start-due' },
    };

    const storage = {
      get: async () => SAVED_REPORTS,
      update: async () => {},
      storageInitialized: async () => true,
    } as any;

    const SAVED_SECTIONS = [
      { type: 'saved-report' as const, params: { reportId: 'table' } },
      { type: 'saved-report' as const, params: { reportId: 'other' } },
    ];

    const renderDocument = () =>
      render(
        <StorageProvider storage={storage}>
          <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <JiraProvider jira={{ fetchJiraFields: () => fields.promise } as any}>
              <Suspense fallback="loading">
                <ReportLayoutProvider savedReport={{ id: 'doc', sections: SAVED_SECTIONS }}>
                  <ReportOfReports
                    currentReportId="doc"
                    childReportProps={{
                      parent: makeParent(),
                      components: { table: TableReport, 'start-due': () => <span /> },
                      useLoadingState: () => ({ status: 'resolved' }) as any,
                    }}
                  />
                </ReportLayoutProvider>
              </Suspense>
            </JiraProvider>
          </QueryClientProvider>
        </StorageProvider>,
      );

    // The one shown column, `identity:treeSummary`, whose header reads "Icon & Summary".
    const summaryHeader = () =>
      screen.getAllByTestId('table-header-sort').find((button) => button.textContent?.includes('Summary'))!;

    beforeEach(() => {
      window.history.replaceState({}, '', '/?report=doc');
    });

    it("records the sort as an override on that child's node, and touches no other node", async () => {
      renderDocument();

      fields.settle(FIELD_CATALOG);
      issues.settle(ISSUES);

      await screen.findByText('language packs');

      // Saved as `tree`; one click cycles a tree-capable column to A→Z.
      await act(async () => void fireEvent.click(summaryHeader()));

      const written = new URLSearchParams(window.location.search).get(SECTIONS_PARAM);

      expect(JSON.parse(written!)).toEqual([
        { type: 'saved-report', params: { reportId: 'table', overrides: 'tableSortDir=asc' } },
        { type: 'saved-report', params: { reportId: 'other' } },
      ]);
    });

    /**
     * Recording an override rewrites the document, which rewrites the child's effective
     * `queryParams`. No extra traffic may reach Jira as a result.
     *
     * This is the end-to-end statement, not the mechanism: `getRawIssues` would collapse a repeat
     * request anyway (spec/016-report-of-reports/005-optimize), so it passes even if the config is
     * needlessly rebuilt. The guard against *that* — where the design actually lives — is in
     * `ChildReport.test.tsx`, which watches the config's own identity.
     */
    it('sends nothing further to Jira when a sort is recorded', async () => {
      renderDocument();

      fields.settle(FIELD_CATALOG);
      issues.settle(ISSUES);

      await screen.findByText('language packs');
      expect(fetches).toBe(1);

      await act(async () => void fireEvent.click(summaryHeader()));
      await act(async () => void fireEvent.click(summaryHeader()));

      expect(fetches).toBe(1);
    });

    // Back to what the report has saved, so the override — and with it the whole param, since it
    // was the only difference — has to go, or the document stays dirty forever.
    it('drops the param again when the sort returns to what was saved', async () => {
      renderDocument();

      fields.settle(FIELD_CATALOG);
      issues.settle(ISSUES);

      await screen.findByText('language packs');

      // tree (saved) → asc → desc → rank → tree.
      for (let click = 0; click < 4; click++) {
        await act(async () => void fireEvent.click(summaryHeader()));
      }

      expect(new URLSearchParams(window.location.search).get(SECTIONS_PARAM)).toBeNull();
      expect(window.location.search).toBe('?report=doc');
    });
  });
});
