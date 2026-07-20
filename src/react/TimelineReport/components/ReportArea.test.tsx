import React from 'react';
import { render, screen } from '@testing-library/react';

import { ReportArea } from './ReportArea';
import type { ReportLoadingState } from '../hooks/useReportLoadingState';

// F1 (see spec/011-react-rewrite/testing/explore.md): ReportArea is pure, so every view state —
// including the live-growing progress counter — is testable by passing props. No routeData, no
// backend, no mocking.
const REPORT = <div data-testid="report-block">REPORT</div>;
const base = { isLoggedIn: true, jql: 'project = X', primaryIssueType: 'Initiative', primaryIssuesCount: 5 };

const renderArea = (loadingState: ReportLoadingState, overrides: Partial<typeof base> = {}) =>
  render(
    <ReportArea {...base} {...overrides} loadingState={loadingState}>
      {REPORT}
    </ReportArea>,
  );

describe('<ReportArea>', () => {
  it('renders the report block when resolved with data', () => {
    renderArea({ status: 'resolved' });
    expect(screen.getByTestId('report-block')).toBeInTheDocument();
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });

  it('shows a growing progress counter while pending (total climbs as children are found)', () => {
    const { rerender } = render(
      <ReportArea {...base} loadingState={{ status: 'pending', issuesReceived: 7, issuesRequested: 22 }}>
        {REPORT}
      </ReportArea>,
    );
    expect(screen.getByText(/Loaded 7 of 22 issues/)).toBeInTheDocument();
    expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();

    rerender(
      <ReportArea {...base} loadingState={{ status: 'pending', issuesReceived: 15, issuesRequested: 40 }}>
        {REPORT}
      </ReportArea>,
    );
    expect(screen.getByText(/Loaded 15 of 40 issues/)).toBeInTheDocument();
    expect(screen.queryByText(/Loaded 7 of 22/)).not.toBeInTheDocument();
  });

  it('shows a plain loading message before progress is known', () => {
    renderArea({ status: 'pending' });
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
    expect(screen.queryByText(/Loaded/)).not.toBeInTheDocument();
  });

  it('shows the empty-result warning when resolved with zero issues', () => {
    renderArea({ status: 'resolved' }, { primaryIssuesCount: 0 });
    expect(screen.getByText(/0 issues of type Initiative/)).toBeInTheDocument();
    expect(screen.getByText(/Please check your JQL and the View Settings/)).toBeInTheDocument();
    expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();
  });

  it('shows the no-license error', () => {
    renderArea({ status: 'rejected', rejectReason: { type: 'no-licensing' } });
    expect(screen.getByText(/No license/)).toBeInTheDocument();
  });

  it('shows a generic error with the first error message', () => {
    renderArea({ status: 'rejected', rejectReason: { errorMessages: ['Bad JQL'] } });
    expect(screen.getByText(/There was an error loading from Jira/)).toBeInTheDocument();
    expect(screen.getByText(/Bad JQL/)).toBeInTheDocument();
  });

  it('prompts for JQL when logged in with none configured', () => {
    renderArea({ status: 'idle' }, { jql: '' });
    expect(screen.getByText(/Configure a JQL/)).toBeInTheDocument();
    expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();
  });
});
