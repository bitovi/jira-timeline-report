import React from 'react';
import { render, screen } from '@testing-library/react';

import { ReportArea, hasStartedReport, isShowingHome } from './ReportArea';
import type { ReportAreaProps } from './ReportArea';
import type { ReportLoadingState } from '../hooks/useReportLoadingState';

// F1 (see spec/011-react-rewrite/testing/explore.md): ReportArea is pure, so every view state —
// including the live-growing progress counter — is testable by passing props. No routeData, no
// backend, no mocking.
const REPORT = <div data-testid="report-block">REPORT</div>;
const base = { isLoggedIn: true, jql: 'project = X', primaryIssueType: 'Initiative', primaryIssuesCount: 5 };

// A stub, because home is a slot: ReportArea only decides *whether* it shows, so these tests need
// no Jira or storage.
const HOME = <div data-testid="home">HOME</div>;
const SETUP = <div data-testid="setup">SETUP</div>;

const renderArea = (loadingState: ReportLoadingState, overrides: Partial<ReportAreaProps> = {}) =>
  render(
    <ReportArea {...base} home={HOME} setup={SETUP} {...overrides} loadingState={loadingState}>
      {REPORT}
    </ReportArea>,
  );

describe('hasStartedReport', () => {
  it('is false on a first visit', () => {
    expect(hasStartedReport(false, '')).toBe(false);
    expect(hasStartedReport(false, '?settings=SOURCES')).toBe(false);
  });

  it('is true once a Create button set the flag', () => {
    expect(hasStartedReport(true, '')).toBe(true);
  });

  // A saved report's type lives in the saved record, so its URL is just `?report=<id>`. Without this,
  // a saved Report of Reports switched to Gantt (no JQL) would fall back to home with no controls.
  it('is true whenever a saved report is open, whatever else the URL holds', () => {
    expect(hasStartedReport(false, '?report=abc')).toBe(true);
    expect(hasStartedReport(false, '?report=abc&primaryReportType=start-due')).toBe(true);
  });
});

describe('isShowingHome', () => {
  it('is false for an unsupported report type, which takes precedence', () => {
    expect(isShowingHome({ jql: '', isLoggedIn: true, unsupportedReportType: 'table2' })).toBe(false);
  });

  it('is false for a self-managed report', () => {
    expect(isShowingHome({ jql: '', isLoggedIn: true, selfManagesData: true })).toBe(false);
  });
});

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

  it('shows the empty-result message when resolved with zero issues', () => {
    renderArea({ status: 'resolved' }, { primaryIssuesCount: 0 });
    expect(screen.getByText('No Initiative work items found')).toBeInTheDocument();
    expect(screen.getByText(/Check the JQL in Sources/)).toBeInTheDocument();
    expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();
  });

  it('shows a generic error with the first error message', () => {
    renderArea({ status: 'rejected', rejectReason: { errorMessages: ['Bad JQL'] } });
    expect(screen.getByText(/There was an error loading from Jira/)).toBeInTheDocument();
    expect(screen.getByText(/Bad JQL/)).toBeInTheDocument();
  });

  it('shows home when logged in with no JQL configured', () => {
    renderArea({ status: 'idle' }, { jql: '' });
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();
  });

  // Home is the landing page. Once the user has left it to build a report, a missing JQL asks for
  // sources instead — e.g. Create Report of Reports, then switching the type to Gantt.
  it('asks for sources instead of showing home once the user has started a report', () => {
    renderArea({ status: 'idle' }, { jql: '', startedReport: true });
    expect(screen.getByTestId('setup')).toBeInTheDocument();
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });

  it('shows neither home nor the sources prompt once there is a JQL', () => {
    renderArea({ status: 'resolved' }, { startedReport: true });
    expect(screen.queryByTestId('setup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });

  it('does not show home once there is a JQL', () => {
    renderArea({ status: 'resolved' });
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
  });

  // Sample data: there are no saved reports to show, and nobody to own one.
  it('does not show home to a logged-out session', () => {
    renderArea({ status: 'idle' }, { jql: '', isLoggedIn: false });
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
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
      expect(screen.queryByTestId('home')).not.toBeInTheDocument();
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
      expect(screen.queryByTestId('home')).not.toBeInTheDocument();
      expect(screen.queryByText(/work items found/)).not.toBeInTheDocument();
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
      expect(screen.getByTestId('home')).toBeInTheDocument();
      expect(screen.queryByTestId('report-block')).not.toBeInTheDocument();
    });
  });
});
