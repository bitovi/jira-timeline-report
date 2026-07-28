import type { Report } from '../../../../jira/reports';

import React from 'react';
import { render, screen } from '@testing-library/react';

import { ObservableObject, value } from '../../../../can';
import { ChildReport } from './ChildReport';
import { useCanObservable } from '../../../hooks/useCanObservable';

/** Renders a value out of the shared prop bag, so a test can see which config produced it. */
const Probe = ({ roundToObs }: any) => <span data-testid="probe">{useCanObservable(roundToObs)}</span>;

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
  }: { components?: Record<string, any>; loadingState?: any } = {},
) =>
  render(
    <ChildReport
      report={reportRecord}
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

  it('falls back to the default report type for a value it does not recognize, as route-data does', () => {
    renderChild(report('a', 'jql=project%3DA&primaryReportType=some-future-report'));

    expect(screen.getByTestId('probe')).toBeInTheDocument();
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
});
