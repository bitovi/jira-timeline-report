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
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ObservableObject, value } from '../../../../can';
import { ChildReport } from './ChildReport';
import { JiraProvider } from '../../../services/jira';
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

const makeParent = () => {
  const parent = new FakeParent() as any;

  parent.isLoggedInObservable = valueAny.with(true);
  parent.licensingPromise = Promise.resolve({ active: true });
  parent.normalizeOptions = { getUrl: ({ key }: any) => `/browse/${key}` };
  parent.jiraHelpers = {
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: () => issues.promise,
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: () => issues.promise,
  };

  return parent;
};

/** A saved Table report as one is stored: the report type plus its persisted view state. */
const TABLE_PARAMS = new URLSearchParams({
  jql: 'project = ORDER',
  primaryReportType: 'table2',
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
            components={{ table2: TableReport }}
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
});
