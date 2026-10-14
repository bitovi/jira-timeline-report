import type { ReportHomeProps } from './ReportHome';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReportHome } from './ReportHome';
import { createHomeActions } from './ReportHomeContainer';
import { SAMPLE_REPORTS } from '../components/ReportListing/sample-reports';

const renderHome = (props: Partial<ReportHomeProps> = {}) => {
  const handlers = {
    onToggleStar: vi.fn(),
    onViewAllReports: vi.fn(),
    onCreateReport: vi.fn(),
    onCreateReportOfReports: vi.fn(),
    onOpenSources: vi.fn(),
  };

  render(
    <ReportHome
      recentReports={SAMPLE_REPORTS}
      owners={{}}
      currentAccountId={null}
      starredIds={new Set()}
      {...handlers}
      {...props}
    />,
  );

  return handlers;
};

describe('<ReportHome>', () => {
  it('lists at most five recent reports as links', () => {
    renderHome();

    expect(screen.getByText('Pick up where you left off')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: SAMPLE_REPORTS[0].name })).toHaveAttribute('href', '?report=1');
    expect(screen.getByRole('link', { name: SAMPLE_REPORTS[4].name })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SAMPLE_REPORTS[5].name })).not.toBeInTheDocument();
  });

  it('stars a recent report', async () => {
    const { onToggleStar } = renderHome();

    await userEvent.click(screen.getByRole('button', { name: `Star ${SAMPLE_REPORTS[0].name}` }));

    expect(onToggleStar).toHaveBeenCalledWith(SAMPLE_REPORTS[0]);
  });

  it('never offers delete', () => {
    renderHome();

    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('links to every saved report', async () => {
    const { onViewAllReports } = renderHome();

    await userEvent.click(screen.getByRole('button', { name: 'All saved reports →' }));

    expect(onViewAllReports).toHaveBeenCalled();
  });

  it('opens Sources from the subtitle', async () => {
    const { onOpenSources } = renderHome();

    await userEvent.click(screen.getByRole('button', { name: 'Sources' }));

    expect(onOpenSources).toHaveBeenCalled();
  });

  it('has both create buttons', async () => {
    const { onCreateReport, onCreateReportOfReports } = renderHome();

    await userEvent.click(screen.getByRole('button', { name: 'Create new report' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create report of reports' }));

    expect(onCreateReport).toHaveBeenCalled();
    expect(onCreateReportOfReports).toHaveBeenCalled();
  });

  describe('with no recents', () => {
    it('keeps a plain way to every saved report, and both create buttons', () => {
      renderHome({ recentReports: [] });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByText(/haven't opened any reports yet/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All saved reports' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create new report' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create report of reports' })).toBeInTheDocument();
    });
  });
});

describe('createHomeActions', () => {
  const target = () => ({ showSettings: '', primaryReportType: 'start-due' });

  it('"Create report of reports" switches the report type', () => {
    const route = target();

    createHomeActions(route).onCreateReportOfReports();

    expect(route.primaryReportType).toBe('report-of-reports');
  });

  it('"Create new report" and "Sources" open the Sources panel', () => {
    const route = target();
    const actions = createHomeActions(route);

    actions.onCreateReport();
    expect(route.showSettings).toBe('SOURCES');

    route.showSettings = '';
    actions.onOpenSources();
    expect(route.showSettings).toBe('SOURCES');
  });

  it('"All saved reports" opens the Saved Reports page', () => {
    const route = target();

    createHomeActions(route).onViewAllReports();

    expect(route.showSettings).toBe('REPORTS');
  });
});
