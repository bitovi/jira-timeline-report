import type { Report } from '../../../../jira/reports';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ObservableObject, value } from '../../../../can';
import { ChildReport } from './ChildReport';
import { useCanObservable } from '../../../hooks/useCanObservable';

/** Renders a value out of the shared prop bag, so a test can see which config produced it. */
const Probe = ({ roundToObs }: any) => <span data-testid="probe">{useCanObservable(roundToObs)}</span>;

/**
 * A stand-in for the one report that writes back. `TableReport` persists its sort by assigning
 * `tableSortDirObs.value`, which is what a real user's column click resolves to — so this exercises
 * the same path rather than reaching into the config.
 */
const SortingProbe = ({ tableSortDirObs }: any) => (
  <button type="button" data-testid="sort" onClick={() => (tableSortDirObs.value = 'desc')}>
    {useCanObservable(tableSortDirObs)}
  </button>
);

// can.js has loose (.js) types — ObservableObject's declaration exposes no static props hook.
const ObservableObjectClass = ObservableObject as any;

class FakeParent extends ObservableObjectClass {
  static props = {
    jiraHelpers: { default: null },
    isLoggedInObservable: { default: null },
    licensingPromise: { default: null },
    normalizeOptions: { default: null },
    simplifiedIssueHierarchy: {
      get default() {
        return [];
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

  parent.isLoggedInObservable = (value as any).with(true);
  parent.jiraHelpers = {
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: () => new Promise(() => {}),
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: () => new Promise(() => {}),
  };

  return parent;
};

const report = (id: string, queryParams: string): Report => ({ id, name: `Report ${id}`, queryParams });

const renderChild = (
  reportRecord: Report,
  {
    components = { 'start-due': Probe },
    loadingState = { status: 'resolved' },
    overrides,
    onParamChange,
  }: {
    components?: Record<string, any>;
    loadingState?: any;
    overrides?: string;
    onParamChange?: (key: string, serialized: string | undefined) => void;
  } = {},
) =>
  render(
    <ChildReport
      report={reportRecord}
      overrides={overrides}
      onParamChange={onParamChange}
      parent={makeParent()}
      components={components}
      useLoadingState={() => loadingState}
    />,
  );

describe('<ChildReport>', () => {
  it('renders the component registered for the child report type', () => {
    renderChild(report('a', 'jql=project%3DA&primaryReportType=start-due'));

    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });

  // The point of the whole phase: each child builds its own config, so two children on one page
  // do not share the shell's single routeData-bound props bag.
  it('gives each child a prop bag built from its own queryParams', () => {
    renderChild(report('a', 'jql=project%3DA&primaryReportType=start-due&roundTo=month'));
    renderChild(report('b', 'jql=project%3DB&primaryReportType=start-due&roundTo=week'));

    expect(screen.getAllByTestId('probe').map((node) => node.textContent)).toEqual(['month', 'week']);
  });

  it('refuses to nest a report-of-reports', () => {
    renderChild(report('a', 'primaryReportType=report-of-reports'));

    expect(screen.getByText(/cannot be embedded/i)).toBeInTheDocument();
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument();
  });

  // `ChildReportConfig` still clamps an unrecognized type to the default (so nothing downstream sees
  // a bogus value), but the child no longer *renders* that substitute: a document asking for a report
  // type this build doesn't have gets an explanation instead of an unrelated chart. That is what makes
  // deleting a migration at its end of life recoverable rather than silently wrong.
  // See spec/018-card-report/saved-report-migrations/plan.md § End of life 2.
  it('explains an unrecognized report type instead of silently rendering the default one', () => {
    renderChild(report('a', 'jql=project%3DA&primaryReportType=some-future-report'));

    expect(screen.getByText(/no longer support/)).toBeInTheDocument();
    expect(screen.getByText(/some-future-report/)).toBeInTheDocument();
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument();
  });

  it('explains a report type with no registered component instead of rendering nothing', () => {
    renderChild(report('a', 'jql=project%3DA&primaryReportType=start-due'), { components: {} });

    expect(screen.getByText(/Unknown report type "start-due"/)).toBeInTheDocument();
  });

  it('shows its own loading state while its own request is pending', () => {
    renderChild(report('a', 'jql=project%3DA&primaryReportType=start-due'), {
      loadingState: { status: 'pending', issuesReceived: 3, issuesRequested: 9 } as any,
    });

    expect(screen.getByText('3 of 9')).toBeInTheDocument();
    expect(screen.queryByTestId('probe')).not.toBeInTheDocument();
  });

  it('shows its own error state', () => {
    renderChild(report('a', 'jql=project%3DA&primaryReportType=start-due'), {
      loadingState: { status: 'rejected', rejectReason: { errorMessages: ['Bad JQL'] } } as any,
    });

    expect(screen.getByText(/There was an error loading from Jira/)).toBeInTheDocument();
    expect(screen.getByText(/Bad JQL/)).toBeInTheDocument();
  });

  // spec/016-report-of-reports/006-url-state Phase 2 — a change made inside an embedded report.
  describe('configuration overrides', () => {
    const sorted = () => report('a', 'jql=project%3DA&primaryReportType=table&tableSortDir=tree');
    const withTable = { components: { table: SortingProbe } };

    it('renders the overridden configuration, leaving the saved report untouched', () => {
      const saved = sorted();

      renderChild(saved, { ...withTable, overrides: 'tableSortDir=desc' });

      expect(screen.getByTestId('sort')).toHaveTextContent('desc');
      expect(saved.queryParams).toBe('jql=project%3DA&primaryReportType=table&tableSortDir=tree');
    });

    it('falls back to the saved value for a key the overrides do not mention', () => {
      renderChild(sorted(), { ...withTable, overrides: 'tableSortColumn=summary' });

      expect(screen.getByTestId('sort')).toHaveTextContent('tree');
    });

    it('announces a write the report makes', async () => {
      const changes: Array<[string, string | undefined]> = [];

      renderChild(sorted(), {
        ...withTable,
        onParamChange: (key, serialized) => changes.push([key, serialized]),
      });

      await userEvent.click(screen.getByTestId('sort'));

      expect(changes).toEqual([['tableSortDir', 'desc']]);
      expect(screen.getByTestId('sort')).toHaveTextContent('desc');
    });

    /**
     * The risk the whole design of Phase 2 is arranged around, watched at the only place it is
     * visible from outside: the identity of the observables in the prop bag.
     *
     * Recording an override rewrites the child's effective `queryParams`. If that rebuilt the
     * `ChildReportConfig`, `propsFor` would hand the report a whole new set of observables — a new
     * `rawIssuesRequestData`, and a fetch cascade restarted on every column click. So the config is
     * keyed on the *saved* params and has its `queryParams` reassigned in place instead. An
     * end-to-end test can't see this: `getRawIssues` collapses the repeat request, so the damage is
     * invisible right up until it isn't.
     */
    it('keeps one config across an override, rather than rebuilding it', async () => {
      const seen: any[] = [];

      // The document: it holds the override and feeds it back down, which is what makes the child's
      // effective `queryParams` change. `report`, `parent` and `onParamChange` are stable across
      // renders here because they are in production too — the query cache, the routeData singleton,
      // and `SavedReportView`'s `useCallback`. An unstable one would rebuild the config by itself
      // and this test would prove nothing.
      const savedReport = sorted();
      const parent = makeParent();

      const Document = () => {
        const [overrides, setOverrides] = React.useState<string | undefined>(undefined);
        const onParamChange = React.useCallback(
          (key: string, serialized: string | undefined) =>
            setOverrides(serialized === undefined ? undefined : `${key}=${serialized}`),
          [],
        );

        return (
          <ChildReport
            report={savedReport}
            overrides={overrides}
            onParamChange={onParamChange}
            parent={parent}
            components={{
              table: ({ tableSortDirObs }: any) => {
                seen.push(tableSortDirObs);

                return (
                  <button type="button" data-testid="sort" onClick={() => (tableSortDirObs.value = 'desc')}>
                    {useCanObservable(tableSortDirObs)}
                  </button>
                );
              },
            }}
            useLoadingState={() => ({ status: 'resolved' }) as any}
          />
        );
      };

      render(<Document />);

      await userEvent.click(screen.getByTestId('sort'));

      expect(screen.getByTestId('sort')).toHaveTextContent('desc');
      // Re-rendered, certainly — but every render saw the same observable, so the same config.
      expect(new Set(seen).size).toBe(1);
    });

    // What keeps a sort toggled there and back from leaving a permanently dirty document: the
    // child compares against its own saved value, and announces "no override" rather than the value.
    it('announces the absence of an override when the write matches what was saved', async () => {
      const changes: Array<[string, string | undefined]> = [];

      renderChild(report('a', 'jql=project%3DA&primaryReportType=table&tableSortDir=desc'), {
        ...withTable,
        overrides: 'tableSortDir=tree',
        onParamChange: (key, serialized) => changes.push([key, serialized]),
      });

      await userEvent.click(screen.getByTestId('sort'));

      expect(changes).toEqual([['tableSortDir', undefined]]);
    });
  });

  // An inline report is a whole report configured in the document rather than referring out to a
  // saved one. Nothing downstream can tell the difference — all any of it sees is a query string.
  // See spec/018-card-report/alt-plan.md.
  describe('an inline report', () => {
    const renderInline = (inlineQuery: string, { components = { 'start-due': Probe }, onParamChange }: any = {}) =>
      render(
        <ChildReport
          inlineQuery={inlineQuery}
          onParamChange={onParamChange}
          parent={makeParent()}
          components={components}
          useLoadingState={() => ({ status: 'resolved' }) as any}
        />,
      );

    it('builds its prop bag from the node’s query instead of a saved report', () => {
      renderInline('jql=project%3DA&primaryReportType=start-due&roundTo=month');

      expect(screen.getByTestId('probe')).toHaveTextContent('month');
    });

    // It is its own baseline, so there is nothing to diff against: every value it writes is a real
    // change, announced as-is for the document to write into the node's query.
    it('announces a write verbatim, with no override comparison', async () => {
      const changes: Array<[string, string | undefined]> = [];

      renderInline('jql=project%3DA&primaryReportType=table&tableSortDir=tree', {
        components: { table: SortingProbe },
        onParamChange: (key: string, serialized: string | undefined) => changes.push([key, serialized]),
      });

      await userEvent.click(screen.getByTestId('sort'));

      expect(changes).toEqual([['tableSortDir', 'desc']]);
      expect(screen.getByTestId('sort')).toHaveTextContent('desc');
    });

    // A saved-report child would report `undefined` here — the write matches its saved value, so the
    // override clears. An inline report has no such value, and announcing `undefined` would delete the
    // key from its own configuration.
    it('announces a write that matches the node’s own query, rather than clearing it', async () => {
      const changes: Array<[string, string | undefined]> = [];

      renderInline('jql=project%3DA&primaryReportType=table&tableSortDir=desc', {
        components: { table: SortingProbe },
        onParamChange: (key: string, serialized: string | undefined) => changes.push([key, serialized]),
      });

      await userEvent.click(screen.getByTestId('sort'));

      expect(changes).toEqual([['tableSortDir', 'desc']]);
    });

    it('reports a dead report type from the node’s query, same as it would from a record', () => {
      renderInline('jql=project%3DA&primaryReportType=some-future-report');

      expect(screen.getByText(/no longer support/)).toBeInTheDocument();
      expect(screen.getByText(/some-future-report/)).toBeInTheDocument();
    });

    it('still refuses to nest a report-of-reports', () => {
      renderInline('primaryReportType=report-of-reports');

      expect(screen.getByText(/cannot be embedded/i)).toBeInTheDocument();
    });
  });
});
