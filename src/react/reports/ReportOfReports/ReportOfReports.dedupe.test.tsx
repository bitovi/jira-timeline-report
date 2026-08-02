/**
 * The one test that states what request-dedupe is *for*
 * (`spec/016-report-of-reports/005-optimize/001-request-dedupe/plan.md`, Phase 4).
 *
 * Every other test in this change checks one layer in isolation, and all of them can pass while the
 * feature saves zero requests: "`queryKeyOf` edited without updating the grouping" or "the provider
 * stops reaching a `ChildReport`" break no layer, only the composition between them. This suite is
 * the only assertion downstream of the entire chain — document roster → field union → cache key →
 * singleflight → one HTTP cascade.
 *
 * It drives the real `ChildReportConfig`, the real `state-helpers` pipeline and the real
 * `getRawIssues` against a fake `jiraHelpers` that records every call, per the pattern in
 * `ChildReportConfig.test.js`.
 */
import type { StoredNode } from './model/sections';
import type { ComponentProps } from 'react';

import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ObservableObject, value } from '../../../can';
import { ReportOfReports } from './ReportOfReports';
import { StorageProvider } from '../../services/storage';
import { JiraProvider } from '../../services/jira';
import { ReportLayoutProvider } from '../../services/report-layout';
import { __clearRawIssuesCache } from '../../../stateful-data/raw-issues-cache';

vi.mock('../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => [{ id: 'summary', name: 'Summary', schema: { type: 'string' }, clauseNames: ['summary'] }],
}));

/** Every issue fetch the whole document issued, in order. */
let requested: Array<{ jql: string; fields: string[] }> = [];

const rawIssue = (key: string) => ({
  id: key,
  key,
  fields: {
    Summary: `summary for ${key}`,
    'Issue Type': { hierarchyLevel: 1, name: 'Epic' },
    Created: '2023-02-03T10:58:38.994-0600',
    Team: null,
    Parent: null,
    Sprint: null,
    'Fix versions': [],
    Labels: [],
    Rank: '0|hzzzzn:',
    Status: { id: '1', name: 'Done', statusCategory: { name: 'Done' } },
  },
  changelog: [],
});

const ObservableObjectClass = ObservableObject as any;
const valueAny = value as any;

class FakeParent extends ObservableObjectClass {
  static props = {
    jiraHelpers: { default: null },
    isLoggedInObservable: { default: null },
    licensingPromise: { default: null },
    normalizeOptions: { default: null },
    simplifiedIssueHierarchy: {
      get default() {
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

/**
 * A fresh parent per render — and therefore a fresh `jiraHelpers`. The cache is a
 * `WeakMap<jiraHelpers, …>`, so a new helpers object is already isolated from the last test's
 * entries; `__clearRawIssuesCache()` in `beforeEach` is belt and braces.
 */
const makeParent = () => {
  const parent = new FakeParent() as any;

  parent.isLoggedInObservable = valueAny.with(true);
  parent.licensingPromise = Promise.resolve({ active: true });
  parent.normalizeOptions = { getUrl: ({ key }: any) => `/browse/${key}` };

  const record = (params: any) => {
    requested.push({ jql: params.jql, fields: params.fields });

    return Promise.resolve([rawIssue('ORDER-1')]);
  };

  parent.jiraHelpers = {
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: record,
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: record,
  };

  return parent;
};

/** Stands in for a real report. Renders only once its child's fetch has actually resolved. */
const Probe = ({ reportName }: any) => <span data-testid="rendered-report">{reportName ?? 'report'}</span>;

const params = (entries: Record<string, string>) => new URLSearchParams(entries).toString();

const ORDER_JQL = 'project = ORDER';

const savedReports: Record<string, { id: string; name: string; queryParams: string }> = {
  gantt: {
    id: 'gantt',
    name: 'Order Gantt',
    queryParams: params({ jql: ORDER_JQL, primaryReportType: 'start-due' }),
  },
  // NON-core on purpose: with a core column, the cache key's own canonicalization already dedupes and
  // the headline test would prove nothing about the field union.
  table: {
    id: 'table',
    name: 'Order Table',
    queryParams: params({
      jql: ORDER_JQL,
      primaryReportType: 'table',
      tableColumns: JSON.stringify([{ sourceId: 'field:customfield_1' }]),
    }),
  },
  // Same JQL, one core extra column. Should collapse without any union.
  coreTable: {
    id: 'coreTable',
    name: 'Core Table',
    queryParams: params({
      jql: ORDER_JQL,
      primaryReportType: 'table',
      tableColumns: JSON.stringify([{ sourceId: 'field:Status' }]),
    }),
  },
  ganttCopy: {
    id: 'ganttCopy',
    name: 'Order Gantt Copy',
    queryParams: params({ jql: ORDER_JQL, primaryReportType: 'start-due' }),
  },
  ganttCopy2: {
    id: 'ganttCopy2',
    name: 'Order Gantt Copy 2',
    queryParams: params({ jql: ORDER_JQL, primaryReportType: 'start-due' }),
  },
  otherJql: {
    id: 'otherJql',
    name: 'Billing Gantt',
    queryParams: params({ jql: 'project = BILLING', primaryReportType: 'start-due' }),
  },
};

const storage = {
  get: async () => savedReports,
  update: async () => {},
  storageInitialized: async () => true,
} as unknown as ComponentProps<typeof StorageProvider>['storage'];

const stored = (reportId: string): StoredNode => ({ type: 'saved-report', params: { reportId } });

const renderDocument = (reportIds: string[]) =>
  render(
    <Suspense fallback="loading">
      <StorageProvider storage={storage}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <JiraProvider jira={{} as any}>
            <ReportLayoutProvider savedReport={{ id: 'doc', sections: reportIds.map(stored) }}>
              <ReportOfReports
                childReportProps={{
                  parent: makeParent(),
                  components: { 'start-due': Probe, table: Probe },
                }}
              />
            </ReportLayoutProvider>
          </JiraProvider>
        </QueryClientProvider>
      </StorageProvider>
    </Suspense>,
  );

/**
 * Waits until every embedded report has left its loading state and rendered.
 *
 * Deliberately asserts inside `waitFor` and returns nothing. A child can dip back into `pending` for
 * a frame after it first resolves — CanJS unbinds an observable that momentarily loses its listeners
 * and recomputes on rebind — so re-querying the DOM straight after the wait is a race. What these
 * tests are about is the *fetch count*, which is unaffected either way: a rebind is exactly the case
 * the cache turns into a hit, and every assertion here checks `requested` rather than the DOM.
 */
const renderedReports = async (count: number) => {
  await waitFor(() => expect(screen.getAllByTestId('rendered-report')).toHaveLength(count));
};

describe('a document sharing one fetch between its reports', () => {
  beforeEach(() => {
    requested = [];
    __clearRawIssuesCache();
  });

  /**
   * The headline. All three assertions are load-bearing:
   *
   * 1. without it there is no dedupe;
   * 2. without it, a bug that simply *ignores* the Table's columns also yields one fetch — you would
   *    have "deduped" by not loading a field the Table needs, and its custom column would render
   *    empty;
   * 3. without it, a child that is broken and never fetches also yields one fetch.
   */
  it('issues one fetch for a Gantt and a Table over the same JQL, carrying the union of their fields', async () => {
    renderDocument(['gantt', 'table']);

    await renderedReports(2);

    expect(requested).toHaveLength(1);
    // The id, not the display name: `requiredFieldsFor('field:customfield_1')` strips the prefix and
    // the union carries ids through unchanged. Name→id resolution happens inside the helper the fake
    // replaces, further down than this assertion can see.
    expect(requested[0].fields).toContain('customfield_1');
    expect(requested[0].jql).toBe(ORDER_JQL);
  });

  it('issues one fetch for three byte-identical reports', async () => {
    renderDocument(['gantt', 'ganttCopy', 'ganttCopy2']);

    await renderedReports(3);

    expect(requested).toHaveLength(1);
  });

  // Core absorption, no union needed: `Status` is already always-loaded, so the two requests were
  // never really different. This is the case that would pass with Phase 1 reverted.
  it('issues one fetch when the only extra column is a core field', async () => {
    renderDocument(['gantt', 'coreTable']);

    await renderedReports(2);

    expect(requested).toHaveLength(1);
  });

  // Guards against an over-broad key, and against the union crossing group boundaries.
  it('keeps a genuinely different JQL on its own fetch', async () => {
    renderDocument(['gantt', 'table', 'otherJql']);

    await renderedReports(3);

    expect(requested).toHaveLength(2);
    expect(requested.map(({ jql }) => jql).sort()).toEqual(['project = BILLING', 'project = ORDER']);

    const billing = requested.find(({ jql }) => jql === 'project = BILLING');
    expect(billing?.fields).not.toContain('customfield_1');
  });
});
