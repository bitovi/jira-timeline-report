import type { AppStorage } from '../../jira/storage/common';
import type { ComponentProps } from 'react';
import type { Jira } from '../../jira-oidc-helpers';
import type { Report } from '../../jira/reports';
import type { StarsStore } from '../services/reports';

import React, { Suspense } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';
import userEvent from '@testing-library/user-event';

import ViewReports, { pageSizeFor } from './ViewReports';
import { StorageProvider } from '../services/storage';
import { JiraProvider } from '../services/jira';
import { UserServicesProvider } from '../services/user';

const ME = 'acct-me';
const ADA = 'acct-ada';
const GONE = 'acct-gone';

const report = (id: string, name: string, extra: Partial<Report> = {}): Report => ({
  id,
  name,
  queryParams: 'primaryReportType=due',
  ...extra,
});

const toMap = (reports: Report[]) => Object.fromEntries(reports.map((r) => [r.id, r]));

const USERS: Record<string, object> = {
  [ME]: { accountId: ME, displayName: 'Arthur Me', active: true },
  [ADA]: { accountId: ADA, displayName: 'Ada Lovelace', active: true },
  [GONE]: { accountId: GONE, displayName: 'Gone Person', active: false },
};

/** `/user/bulk`, answered from `USERS`. */
const usersRequester = vi.fn(async (url: string) => {
  const ids = new URLSearchParams(url.split('?')[1]).getAll('accountId');

  return { values: ids.map((id) => USERS[id]).filter(Boolean) };
});

const memoryStars = (initial: string[] = []): StarsStore & { ids: string[] } => {
  const store = {
    ids: [...initial],
    read: async () => [...store.ids],
    write: vi.fn(async (ids: string[]) => {
      store.ids = [...ids];
    }),
  };

  return store;
};

interface RenderConfig {
  reports: Report[];
  stars: string[];
  props: Partial<ComponentProps<typeof ViewReports>>;
  requester: (url: string) => Promise<unknown>;
  update: AppStorage['update'];
}

const renderPage = (config: Partial<RenderConfig> = {}) => {
  const { reports = [], stars = [], props = {}, requester = usersRequester } = config;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const starsStore = memoryStars(stars);
  const update = vi.fn(config.update ?? (async () => {}));

  const storage = {
    get: async () => toMap(reports),
    update,
    storageInitialized: async () => true,
  } as unknown as AppStorage;

  render(
    <UserServicesProvider services={{ readCurrentAccountId: async () => ME, starsStore }}>
      <JiraProvider jira={{ requester } as unknown as Jira}>
        <Suspense fallback="loading">
          <FlagsProvider>
            <StorageProvider storage={storage}>
              <QueryClientProvider client={queryClient}>
                <ViewReports onBackButtonClicked={vi.fn()} onCreateReportClicked={vi.fn()} {...props} />
              </QueryClientProvider>
            </StorageProvider>
          </FlagsProvider>
        </Suspense>
      </JiraProvider>
    </UserServicesProvider>,
  );

  return { starsStore, update };
};

const tab = (name: RegExp) => screen.findByRole('tab', { name });
const rows = () => within(screen.getByRole('table')).getAllByRole('link');
const rowNames = () => rows().map((link) => link.getAttribute('aria-label'));
const search = () => screen.findByRole('textbox', { name: 'Search reports' });

const MIXED = [
  report('1', 'Alpha', { ownerId: ME, queryParams: 'primaryReportType=due&jql=project%3DECOM' }),
  report('2', 'Beta', { ownerId: ADA }),
  report('3', 'Gamma'),
  report('4', 'Delta', { ownerId: GONE }),
];

describe('ViewReports', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.env = { ...(window.env ?? {}), JIRA_APP_KEY: 'test-app' } as typeof window.env;
  });

  it('renders the page chrome and the reports', async () => {
    const onCreateReportClicked = vi.fn();
    renderPage({ reports: MIXED, props: { onCreateReportClicked } });

    expect(await screen.findByText('Back to report')).toBeInTheDocument();
    expect(screen.getByText('Saved Reports')).toBeInTheDocument();
    expect(await search()).toHaveAttribute('placeholder', 'Search by name, JQL, or owner');
    expect(await screen.findByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '?report=1');

    await userEvent.click(screen.getByRole('button', { name: 'Create new report' }));
    expect(onCreateReportClicked).toHaveBeenCalled();
  });

  it("shows each report's type and owner", async () => {
    renderPage({ reports: MIXED });

    expect(await screen.findAllByText('Scatter Plot')).toHaveLength(4);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Former user')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  describe('tabs', () => {
    it('counts each tab', async () => {
      renderPage({ reports: MIXED, stars: ['2'] });

      expect(await tab(/Starred/)).toHaveTextContent('Starred1');
      expect(await tab(/My reports/)).toHaveTextContent('My reports1');
      expect(await tab(/All reports/)).toHaveTextContent('All reports4');
    });

    it('opens on Starred when something is starred', async () => {
      renderPage({ reports: MIXED, stars: ['2'] });

      await waitFor(async () => expect(await tab(/Starred/)).toHaveAttribute('aria-selected', 'true'));
      expect(rowNames()).toEqual(['Beta']);
    });

    it('opens on All when nothing is starred', async () => {
      renderPage({ reports: MIXED });

      await waitFor(async () => expect(await tab(/All reports/)).toHaveAttribute('aria-selected', 'true'));
    });

    // A starred id whose report was deleted doesn't count.
    it('opens on All when the only star is a deleted report', async () => {
      renderPage({ reports: MIXED, stars: ['deleted'] });

      await waitFor(async () => expect(await tab(/All reports/)).toHaveAttribute('aria-selected', 'true'));
      expect(await tab(/Starred/)).toHaveTextContent('Starred0');
    });

    it('stays on Starred after unstarring the last starred report', async () => {
      renderPage({ reports: MIXED, stars: ['2'] });
      await waitFor(async () => expect(await tab(/Starred/)).toHaveAttribute('aria-selected', 'true'));

      await userEvent.click(screen.getByRole('button', { name: 'Unstar Beta' }));

      expect(await tab(/Starred/)).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByText('No starred reports yet')).toBeInTheDocument();
    });

    it('My reports shows only your own', async () => {
      renderPage({ reports: MIXED });

      await userEvent.click(await tab(/My reports/));

      expect(rowNames()).toEqual(['Alpha']);
    });
  });

  describe('search', () => {
    it('filters by name', async () => {
      renderPage({ reports: MIXED });

      await userEvent.type(await search(), 'alph');

      expect(rowNames()).toEqual(['Alpha']);
    });

    it('filters by JQL', async () => {
      renderPage({ reports: MIXED });

      await userEvent.type(await search(), 'ecom');

      expect(rowNames()).toEqual(['Alpha']);
    });

    it("filters by the owner's name once it has loaded", async () => {
      renderPage({ reports: MIXED });
      await screen.findByText('Ada Lovelace');

      await userEvent.type(await search(), 'lovelace');

      expect(rowNames()).toEqual(['Beta']);
    });
  });

  describe('paging', () => {
    const many = Array.from({ length: 10 }, (_, i) => report(String(i), `Report ${String(i).padStart(2, '0')}`));

    it('sizes a page to fill the panel, at least 6 rows', () => {
      expect(pageSizeFor(0)).toBe(6);
      expect(pageSizeFor(530)).toBe(11);
    });

    it('loads more on the All tab', async () => {
      renderPage({ reports: many });

      expect(await screen.findByText('Showing 6 of 10')).toBeInTheDocument();
      expect(rows()).toHaveLength(6);

      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

      expect(rows()).toHaveLength(10);
      expect(screen.getByText('Showing 10 of 10')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('starts over when the query changes', async () => {
      renderPage({ reports: many });
      await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

      await userEvent.type(await search(), 'Report');

      expect(screen.getByText('Showing 6 of 10')).toBeInTheDocument();
    });

    it('does not page the other tabs', async () => {
      renderPage({ reports: many.map((r) => ({ ...r, ownerId: ME })) });

      await userEvent.click(await tab(/My reports/));

      expect(rows()).toHaveLength(10);
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('explains itself when nothing has been saved yet', async () => {
      renderPage({ reports: [] });

      expect(await screen.findByText('No saved reports yet')).toBeInTheDocument();
      expect(screen.getByText('Save a report and it will show up here.')).toBeInTheDocument();
    });

    it('has an empty Starred tab', async () => {
      renderPage({ reports: MIXED });

      await userEvent.click(await tab(/Starred/));

      expect(screen.getByText('No starred reports yet')).toBeInTheDocument();
    });

    it('has an empty My reports tab', async () => {
      renderPage({ reports: [report('2', 'Beta', { ownerId: ADA })] });

      await userEvent.click(await tab(/My reports/));

      expect(screen.getByText('You have not saved any reports')).toBeInTheDocument();
    });

    it('says when nothing matches the search', async () => {
      renderPage({ reports: MIXED });

      await userEvent.type(await search(), 'zzz');

      expect(screen.getByText('No reports match "zzz"')).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it("is offered on your own, unowned and former users' reports only", async () => {
      renderPage({ reports: MIXED });
      await screen.findByText('Former user');

      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete Beta' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Gamma' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Delta' })).toBeInTheDocument();
    });

    it('asks first, then deletes and forgets the report in stars and recents', async () => {
      window.localStorage.setItem('test-app-local-reports', JSON.stringify(['1', '2']));
      const { starsStore, update } = renderPage({ reports: MIXED, stars: ['1', '2'] });

      await userEvent.click(await screen.findByRole('button', { name: 'Delete Alpha' }));

      expect(await screen.findByText('Alpha to be deleted')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to delete this report?')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Delete report'));

      await waitFor(() => expect(update).toHaveBeenLastCalledWith('saved-reports', toMap(MIXED.slice(1))));
      await waitFor(() => expect(starsStore.ids).toEqual(['2']));
      expect(JSON.parse(window.localStorage.getItem('test-app-local-reports')!)).toEqual(['2']);
    });
  });

  it('stars a report', async () => {
    const { starsStore } = renderPage({ reports: MIXED });

    await userEvent.click(await screen.findByRole('button', { name: 'Star Gamma' }));

    await waitFor(() => expect(starsStore.ids).toEqual(['3']));
    expect(await tab(/Starred/)).toHaveTextContent('Starred1');
  });

  describe('sign-in banner', () => {
    const unauthorized = vi.fn(async () => {
      throw Object.assign(new Error('HTTP status code: 401'), { status: 401 });
    });

    it('asks a user on an old token to sign in again', async () => {
      const onReauthorize = vi.fn();
      renderPage({ reports: MIXED, requester: unauthorized, props: { onReauthorize } });

      expect(await screen.findByText('Sign in again to see who owns each report')).toBeInTheDocument();
      // The page still works: your own reports are "You", everyone else's "Unknown".
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getAllByText('Unknown')).toHaveLength(3);

      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(onReauthorize).toHaveBeenCalled();
    });

    it('can be dismissed', async () => {
      renderPage({ reports: MIXED, requester: unauthorized, props: { onReauthorize: vi.fn() } });

      await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));

      expect(screen.queryByText('Sign in again to see who owns each report')).not.toBeInTheDocument();
    });

    // Forge passes no `onReauthorize`: its scopes come from the manifest.
    it('never shows without a way to sign in', async () => {
      renderPage({ reports: MIXED, requester: unauthorized });

      await screen.findByRole('link', { name: 'Alpha' });
      await waitFor(() => expect(unauthorized).toHaveBeenCalled());

      expect(screen.queryByText('Sign in again to see who owns each report')).not.toBeInTheDocument();
    });

    it('does not show when names load', async () => {
      renderPage({ reports: MIXED, props: { onReauthorize: vi.fn() } });

      await screen.findByText('Ada Lovelace');

      expect(screen.queryByText('Sign in again to see who owns each report')).not.toBeInTheDocument();
    });
  });
});
