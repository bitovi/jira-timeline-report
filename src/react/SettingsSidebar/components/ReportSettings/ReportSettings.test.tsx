import React from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, type MockInstance } from 'vitest';

import ReportSettings from './ReportSettings';
import { FlagsProvider } from '@atlaskit/flag';
import { RoutingProvider } from '../../../services/routing';

describe('ReportSettings Component', () => {
  it('renders without crashing', () => {
    render(<ReportSettings showSidebarBranding changeSettings={vi.fn()} />, {
      wrapper: ({ children }) => <FlagsProvider>{children}</FlagsProvider>,
    });

    const reportSettingsHeading = screen.getByText(/report settings/i);
    expect(reportSettingsHeading).toBeInTheDocument();

    const buttons = [/sources/i, /timing/i, /teams/i, /theme/i];

    buttons.forEach((name) => {
      const button = screen.getByRole('button', { name });
      expect(button).toBeInTheDocument();
    });

    const links = [/read the guides/i, /apm training/i, /connect with bitovi/i];

    links.forEach((name) => {
      const link = screen.getByRole('link', { name });
      expect(link).toBeInTheDocument();
    });
  });

  describe('New Report link', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <FlagsProvider>{children}</FlagsProvider>;

    it('links to a blank report with Sources open and tells the app a report started', () => {
      const onNewReport = vi.fn();
      render(<ReportSettings showSidebarBranding={false} changeSettings={vi.fn()} onNewReport={onNewReport} />, {
        wrapper,
      });

      const newReport = screen.getByRole('link', { name: 'New Report' });
      expect(newReport).toHaveAttribute('href', '?settings=SOURCES');

      // jsdom doesn't navigate; the click handler is what matters here.
      newReport.addEventListener('click', (event) => event.preventDefault());
      newReport.click();
      expect(onNewReport).toHaveBeenCalledTimes(1);
    });

    describe('with unsaved changes', () => {
      // Forge-style: `Link` would pushState inside its own click handler, so a confirmation that ran
      // any later would be too late.
      const forgeWrapper = ({ children }: { children: React.ReactNode }) => (
        <FlagsProvider>
          <RoutingProvider routing={{ linkBuilder: (query) => query, interceptLinkClicks: true }}>
            {children}
          </RoutingProvider>
        </FlagsProvider>
      );

      let pushState: MockInstance<Parameters<History['pushState']>, void>;

      beforeEach(() => {
        window.history.replaceState(null, '', '/?report=abc&jql=project%3DECOM');
        pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
      });

      afterEach(() => {
        pushState.mockRestore();
        window.history.replaceState(null, '', '/');
      });

      const renderNewReport = () => {
        const onNewReport = vi.fn();
        render(<ReportSettings showSidebarBranding={false} changeSettings={vi.fn()} onNewReport={onNewReport} />, {
          wrapper: forgeWrapper,
        });

        return onNewReport;
      };

      it('asks before leaving, and goes nowhere until answered', async () => {
        const onNewReport = renderNewReport();

        await userEvent.click(screen.getByRole('link', { name: 'New Report' }));

        expect(await screen.findByText('Leave this report?')).toBeInTheDocument();
        expect(pushState).not.toHaveBeenCalled();
        expect(onNewReport).not.toHaveBeenCalled();
      });

      it('stays put on Stay', async () => {
        const onNewReport = renderNewReport();

        await userEvent.click(screen.getByRole('link', { name: 'New Report' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Stay' }));

        await waitFor(() => expect(screen.queryByText('Leave this report?')).not.toBeInTheDocument());
        expect(pushState).not.toHaveBeenCalled();
        expect(onNewReport).not.toHaveBeenCalled();
      });

      it('starts a new report on Leave', async () => {
        const onNewReport = renderNewReport();

        await userEvent.click(screen.getByRole('link', { name: 'New Report' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Leave' }));

        expect(pushState).toHaveBeenCalledWith(null, '', '?settings=SOURCES');
        expect(onNewReport).toHaveBeenCalledTimes(1);
      });

      it('does not ask for a saved report with no changes', async () => {
        window.history.replaceState(null, '', '/?report=abc&settings=SOURCES');
        const onNewReport = renderNewReport();

        await userEvent.click(screen.getByRole('link', { name: 'New Report' }));

        expect(screen.queryByText('Leave this report?')).not.toBeInTheDocument();
        expect(pushState).toHaveBeenCalledWith(null, '', '?settings=SOURCES');
        expect(onNewReport).toHaveBeenCalledTimes(1);
      });
    });

    it('is absent without onNewReport', () => {
      render(<ReportSettings showSidebarBranding={false} changeSettings={vi.fn()} />, { wrapper });

      expect(screen.queryByRole('link', { name: 'New Report' })).not.toBeInTheDocument();
    });
  });
});
