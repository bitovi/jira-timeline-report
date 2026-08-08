import React from 'react';
import { render, screen } from '@testing-library/react';

import { ReportArea } from './ReportArea';
import type { ReportAreaProps } from './ReportArea';
import type { ReportLoadingState } from '../hooks/useReportLoadingState';

// F1 (see spec/011-react-rewrite/testing/explore.md): ReportArea is pure, so every view state —
// including the live-growing progress counter — is testable by passing props. No routeData, no
// backend, no mocking.
const REPORT = <div data-testid="report-block">REPORT</div>;
const base = { isLoggedIn: true, jql: 'project = X', primaryIssueType: 'Initiative', primaryIssuesCount: 5 };

const renderArea = (loadingState: ReportLoadingState, overrides: Partial<ReportAreaProps> = {}) =>
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

  // The Theme panel's font is scoped to this block by class, so that the app's own chrome — nav,
  // sidebar, saved-reports bar, report controls — keeps the default stack. Losing the class would
  // silently push the report font back onto the whole page. See src/css/fonts.css.
  it('scopes the report font to the report block', () => {
    renderArea({ status: 'resolved' });

    expect(screen.getByTestId('report-block').closest('.report-font-scope')).not.toBeNull();
  });

  it('shows a growing progress counter while pending (the primary step total climbs)', () => {
    // The text-only "Loaded X of Y issues" line was replaced by the three-step LoadingProgress stepper
    // (spec/013-loader); the growing primary count now reads "<received> of <requested>".
    const { rerender } = render(
      <ReportArea {...base} loadingState={{ status: 'pending', issuesReceived: 7, issuesRequested: 22 }}>
        {REPORT}
      </ReportArea>,
    );
    expect(screen.getByText('7 of 22')).toBeInTheDocument();
    expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();

    rerender(
      <ReportArea {...base} loadingState={{ status: 'pending', issuesReceived: 15, issuesRequested: 40 }}>
        {REPORT}
      </ReportArea>,
    );
    expect(screen.getByText('15 of 40')).toBeInTheDocument();
    expect(screen.queryByText('7 of 22')).not.toBeInTheDocument();
  });

  it('shows the loading stepper before progress is known', () => {
    renderArea({ status: 'pending' });
    expect(screen.getByText('Loading primary work items')).toBeInTheDocument();
    expect(screen.getByText('estimating scope…')).toBeInTheDocument();
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

  // A dead report type (a saved report from before a report was renamed or removed) is dead whatever
  // the request does, and route-data clamps it to the first entry in REPORTS — so without this the
  // user gets a Gantt and no explanation. See unsupportedReportType.ts.
  describe('unsupportedReportType', () => {
    it('explains the dead report type instead of rendering a report', () => {
      renderArea({ status: 'resolved' }, { unsupportedReportType: 'table2' });

      expect(screen.getByText(/no longer support/)).toBeInTheDocument();
      expect(screen.getByText('table2')).toBeInTheDocument();
      expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();
    });

    it('takes precedence over every other view state', () => {
      renderArea({ status: 'pending' }, { unsupportedReportType: 'table2', jql: '', primaryIssuesCount: 0 });

      expect(screen.getByText(/no longer support/)).toBeInTheDocument();
      expect(screen.queryByText(/Configure a JQL/)).not.toBeInTheDocument();
      expect(screen.queryByText('Loading primary work items')).not.toBeInTheDocument();
    });

    it('is absent for every renderable report type', () => {
      renderArea({ status: 'resolved' });

      expect(screen.queryByText(/no longer support/)).not.toBeInTheDocument();
      expect(screen.getByTestId('report-block')).toBeInTheDocument();
    });
  });

  // A report-of-reports has no JQL and no primary issues of its own — its children each fetch their
  // own data. `selfManagesData` bypasses the JQL / empty-result / loading gates that assume the
  // shell owns the request. See spec/016-report-of-reports Phase 0.
  describe('selfManagesData', () => {
    const selfManaged = { jql: '', primaryIssuesCount: 0, selfManagesData: true };

    it('renders the report block with no JQL and no primary issues', () => {
      renderArea({ status: 'idle' }, selfManaged);
      expect(screen.getByTestId('report-block')).toBeInTheDocument();
      expect(screen.queryByText(/Configure a JQL/)).not.toBeInTheDocument();
      expect(screen.queryByText(/issues of type/)).not.toBeInTheDocument();
    });

    // With no JQL, getRawIssues returns undefined and derivedIssuesRequestData falls back to an
    // always-pending promise, so the shell's status sits at 'pending' forever. That must not
    // replace the document with a loading stepper.
    it('renders the report block instead of the loading stepper while the shell sits pending', () => {
      renderArea({ status: 'pending', issuesReceived: 7, issuesRequested: 22 }, selfManaged);
      expect(screen.getByTestId('report-block')).toBeInTheDocument();
      expect(screen.queryByText('7 of 22')).not.toBeInTheDocument();
      expect(screen.queryByText('Loading primary work items')).not.toBeInTheDocument();
    });

    it('still surfaces a rejection', () => {
      renderArea({ status: 'rejected', rejectReason: { errorMessages: ['Bad JQL'] } }, selfManaged);
      expect(screen.getByText(/There was an error loading from Jira/)).toBeInTheDocument();
    });

    it('does not affect reports that let the shell own the request', () => {
      renderArea({ status: 'idle' }, { jql: '', primaryIssuesCount: 0 });
      expect(screen.getByText(/Configure a JQL/)).toBeInTheDocument();
      expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();
    });
  });
});
