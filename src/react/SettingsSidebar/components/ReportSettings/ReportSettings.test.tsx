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

  describe('Home link', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <FlagsProvider>{children}</FlagsProvider>;

    it('links to the bare app URL and tells the app it is going home', () => {
      const onGoHome = vi.fn();
      render(<ReportSettings showSidebarBranding={false} changeSettings={vi.fn()} onGoHome={onGoHome} />, {
        wrapper,
      });

      const home = screen.getByRole('link', { name: 'Home' });
      expect(home).toHaveAttribute('href', '?');

      // jsdom doesn't navigate; the click handler is what matters here.
      home.addEventListener('click', (event) => event.preventDefault());
      home.click();
      expect(onGoHome).toHaveBeenCalledTimes(1);
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

      const renderHome = () => {
        const onGoHome = vi.fn();
        render(<ReportSettings showSidebarBranding={false} changeSettings={vi.fn()} onGoHome={onGoHome} />, {
          wrapper: forgeWrapper,
        });

        return onGoHome;
      };

      it('asks before leaving, and goes nowhere until answered', async () => {
        const onGoHome = renderHome();

        await userEvent.click(screen.getByRole('link', { name: 'Home' }));

        expect(await screen.findByText('Leave this report?')).toBeInTheDocument();
        expect(pushState).not.toHaveBeenCalled();
        expect(onGoHome).not.toHaveBeenCalled();
      });

      it('stays put on Stay', async () => {
        const onGoHome = renderHome();

        await userEvent.click(screen.getByRole('link', { name: 'Home' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Stay' }));

        await waitFor(() => expect(screen.queryByText('Leave this report?')).not.toBeInTheDocument());
        expect(pushState).not.toHaveBeenCalled();
        expect(onGoHome).not.toHaveBeenCalled();
      });

      it('goes home on Leave', async () => {
        const onGoHome = renderHome();

        await userEvent.click(screen.getByRole('link', { name: 'Home' }));
        await userEvent.click(await screen.findByRole('button', { name: 'Leave' }));

        expect(pushState).toHaveBeenCalledWith(null, '', '?');
        expect(onGoHome).toHaveBeenCalledTimes(1);
      });

      it('does not ask for a saved report with no changes', async () => {
        window.history.replaceState(null, '', '/?report=abc&settings=SOURCES');
        const onGoHome = renderHome();

        await userEvent.click(screen.getByRole('link', { name: 'Home' }));

        expect(screen.queryByText('Leave this report?')).not.toBeInTheDocument();
        expect(pushState).toHaveBeenCalledWith(null, '', '?');
        expect(onGoHome).toHaveBeenCalledTimes(1);
      });
    });

    it('is absent when the host gives no way home', () => {
      render(<ReportSettings showSidebarBranding={false} changeSettings={vi.fn()} />, { wrapper });

      expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    });
  });
});
