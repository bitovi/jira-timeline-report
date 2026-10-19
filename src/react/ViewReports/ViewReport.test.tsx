import type { AppStorage } from '../../jira/storage/common';
import type { ComponentProps } from 'react';
import type { Jira } from '../../jira-oidc-helpers';
import type { Report } from '../../jira/reports';
import type { StarsStore } from '../services/reports';

import React, { Suspense } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';
import userEvent from '@testing-library/user-event';

import ViewReports, { byLastUpdated, PAGE_SIZE } from './ViewReports';
import { pushStateObservable } from '../../canjs/routing/state-storage';
import { StorageProvider } from '../services/storage';
import { JiraProvider } from '../services/jira';
import { UserServicesProvider } from '../services/user';

const ME = 'acct-me';
const ADA = 'acct-ada';
const GRACE = 'acct-grace';

const report = (id: string, name: string, extra: Partial<Report> = {}): Report => ({
  id,
  name,
  queryParams: 'primaryReportType=due',
  ...extra,
});

const toMap = (reports: Report[]) => Object.fromEntries(reports.map((r) => [r.id, r]));

/**
 * Phase 1 makes no Jira calls from this page — names would need `read:jira-user` (spec/041 phase 2).
 * Any request fails the test.
 */
const noJiraRequests = vi.fn(async (url: string) => {
  throw new Error(`unexpected Jira request: ${url}`);
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
  update: AppStorage['update'];
}

/**
 * Renders the page and waits until it has finished loading. The stars are a separate read from the
 * reports: until they land the table is a skeleton and the Starred count reads "–". Tests that act
 * straight away pass locally, where the read resolves at once, and flake on a slower CI machine.
 */
const renderPage = async (config: Partial<RenderConfig> = {}) => {
  const { reports = [], stars = [], props = {} } = config;
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
      <JiraProvider jira={{ requester: noJiraRequests } as unknown as Jira}>
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

  await screen.findByRole('table', { name: 'Saved reports' });

  return { starsStore, update };
};

const tab = (name: RegExp) => screen.findByRole('tab', { name });
const rows = () => within(screen.getByRole('table')).getAllByRole('link');
const rowNames = () => rows().map((link) => link.getAttribute('aria-label'));
const search = () => screen.findByRole('textbox', { name: 'Search reports' });
/** A row's cells, in column order: star, name, owner, last updated, type, delete. */
const cellsOf = (name: string) =>
  within(screen.getByRole('link', { name }).closest('[role="row"]') as HTMLElement).getAllByRole('cell');
const ownerOf = (name: string) => cellsOf(name)[2];
const updatedOf = (name: string) => cellsOf(name)[3];

const MIXED = [
  report('1', 'Alpha', { ownerId: ME, queryParams: 'primaryReportType=due&jql=project%3DECOM' }),
  report('2', 'Beta', { ownerId: ADA }),
  report('3', 'Gamma'),
  report('4', 'Delta', { ownerId: GRACE }),
  // A Reports Space report saved before `ownerId` existed: its work item's creator stands in.
  report('5', 'Epsilon', { creatorId: ME }),
];

describe('ViewReports', () => {
  beforeEach(() => {
    noJiraRequests.mockClear();
    window.localStorage.clear();
    window.env = { ...(window.env ?? {}), JIRA_APP_KEY: 'test-app' } as typeof window.env;
  });

  it('renders the page chrome and the reports', async () => {
    const onCreateReportClicked = vi.fn();
    await renderPage({ reports: MIXED, props: { onCreateReportClicked } });

    expect(await screen.findByText('Back to report')).toBeInTheDocument();
    expect(screen.getByText('Saved Reports')).toBeInTheDocument();
    expect(await search()).toHaveAttribute('placeholder', 'Search by name or JQL');
    expect(await screen.findByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '?report=1');

    await userEvent.click(screen.getByRole('button', { name: 'Create new report' }));
    expect(onCreateReportClicked).toHaveBeenCalled();
  });

  it("shows each report's type and owner, without looking up any names", async () => {
    await renderPage({ reports: MIXED });

    expect(await screen.findAllByText('Scatter Plot')).toHaveLength(5);
    expect(screen.getAllByText('You')).toHaveLength(2);
    expect(screen.getAllByText('Someone else')).toHaveLength(2);
    expect(ownerOf('Gamma')).toHaveTextContent('—');
    expect(noJiraRequests).not.toHaveBeenCalled();
  });

  it('shows when each report was last updated, falling back to its work item', async () => {
    await renderPage({
      reports: [
        report('1', 'Alpha', { updatedAt: '2026-10-14T09:00:00.000Z' }),
        report('2', 'Beta', { workItemUpdatedAt: '2026-10-13T09:00:00.000Z' }),
        report('3', 'Gamma'),
      ],
    });

    await screen.findByRole('link', { name: 'Alpha' });

    expect(updatedOf('Alpha').querySelector('time')).toHaveAttribute('dateTime', '2026-10-14T09:00:00.000Z');
    expect(updatedOf('Beta').querySelector('time')).toHaveAttribute('dateTime', '2026-10-13T09:00:00.000Z');
    expect(updatedOf('Gamma')).toHaveTextContent('—');
  });

  // Search filters this order but never reorders it, so it holds on every tab and every query.
  it('sorts every tab by last updated, most recent first, undated reports last by name', async () => {
    await renderPage({
      reports: [
        report('1', 'Zulu', { updatedAt: '2026-10-01T00:00:00.000Z', ownerId: ME }),
        report('2', 'Bravo', { ownerId: ME }),
        report('3', 'Alpha', { ownerId: ME }),
        report('4', 'Mike', { workItemUpdatedAt: '2026-10-10T00:00:00.000Z', ownerId: ME }),
        report('5', 'Yankee', { updatedAt: '2026-10-14T00:00:00.000Z', ownerId: ME }),
      ],
      stars: ['1', '2', '3', '4', '5'],
    });

    const expected = ['Yankee', 'Mike', 'Zulu', 'Alpha', 'Bravo'];

    await waitFor(async () => expect(await tab(/Starred/)).toHaveAttribute('aria-selected', 'true'));
    expect(rowNames()).toEqual(expected);

    await userEvent.click(await tab(/My reports/));
    expect(rowNames()).toEqual(expected);

    await userEvent.click(await tab(/All reports/));
    expect(rowNames()).toEqual(expected);
  });

  it('byLastUpdated falls back to name for equal timestamps', () => {
    const at = '2026-10-14T00:00:00.000Z';

    expect(
      [report('1', 'Beta', { updatedAt: at }), report('2', 'Alpha', { updatedAt: at })]
        .sort(byLastUpdated)
        .map((r) => r.name),
    ).toEqual(['Alpha', 'Beta']);
  });

  // This page can be open over a saved report. Only opening Sources would leave that report attached,
  // so editing it and pressing Save would overwrite it.
  it('"Create new report" starts from a clean URL with Sources open, and marks a report as started', async () => {
    const set = vi.spyOn(pushStateObservable, 'set').mockImplementation(() => pushStateObservable);
    const onStartReport = vi.fn();

    await renderPage({ reports: MIXED, props: { onCreateReportClicked: undefined, onStartReport } });

    await userEvent.click(await screen.findByRole('button', { name: 'Create new report' }));

    expect(onStartReport).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith('?settings=SOURCES');

    set.mockRestore();
  });

  describe('tabs', () => {
    it('counts each tab', async () => {
      await renderPage({ reports: MIXED, stars: ['2'] });

      expect(await tab(/Starred/)).toHaveTextContent('Starred1');
      expect(await tab(/My reports/)).toHaveTextContent('My reports2');
      expect(await tab(/All reports/)).toHaveTextContent('All reports5');
    });

    it('opens on Starred when something is starred', async () => {
      await renderPage({ reports: MIXED, stars: ['2'] });

      await waitFor(async () => expect(await tab(/Starred/)).toHaveAttribute('aria-selected', 'true'));
      expect(rowNames()).toEqual(['Beta']);
    });

    it('opens on All when nothing is starred', async () => {
      await renderPage({ reports: MIXED });

      await waitFor(async () => expect(await tab(/All reports/)).toHaveAttribute('aria-selected', 'true'));
    });

    // A starred id whose report was deleted doesn't count.
    it('opens on All when the only star is a deleted report', async () => {
      await renderPage({ reports: MIXED, stars: ['deleted'] });

      await waitFor(async () => expect(await tab(/All reports/)).toHaveAttribute('aria-selected', 'true'));
      expect(await tab(/Starred/)).toHaveTextContent('Starred0');
    });

    it('stays on Starred after unstarring the last starred report', async () => {
      await renderPage({ reports: MIXED, stars: ['2'] });
      await waitFor(async () => expect(await tab(/Starred/)).toHaveAttribute('aria-selected', 'true'));

      await userEvent.click(screen.getByRole('button', { name: 'Unstar Beta' }));

      expect(await tab(/Starred/)).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByText('No starred reports yet')).toBeInTheDocument();
    });

    it('My reports shows only your own, including Space reports you created', async () => {
      await renderPage({ reports: MIXED });

      await userEvent.click(await tab(/My reports/));

      expect(rowNames()).toEqual(['Alpha', 'Epsilon']);
    });
  });

  describe('search', () => {
    it('filters by name', async () => {
      await renderPage({ reports: MIXED });

      await userEvent.type(await search(), 'alph');

      expect(rowNames()).toEqual(['Alpha']);
    });

    it('filters by JQL', async () => {
      await renderPage({ reports: MIXED });

      await userEvent.type(await search(), 'ecom');

      expect(rowNames()).toEqual(['Alpha']);
    });
  });

  describe('paging', () => {
    // A page and a half, so the All tab starts with one page loaded and one left to scroll to.
    const many = Array.from({ length: PAGE_SIZE + 10 }, (_, i) =>
      report(String(i), `Report ${String(i).padStart(2, '0')}`),
    );

    // jsdom has no IntersectionObserver. This one records what's observed so a test can "scroll"
    // the sentinel into view.
    let observers: Array<{ callback: IntersectionObserverCallback; targets: Element[] }>;

    beforeEach(() => {
      observers = [];
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          private entry: { callback: IntersectionObserverCallback; targets: Element[] };
          constructor(callback: IntersectionObserverCallback) {
            this.entry = { callback, targets: [] };
            observers.push(this.entry);
          }
          observe(target: Element) {
            this.entry.targets.push(target);
          }
          disconnect() {
            observers = observers.filter((o) => o !== this.entry);
          }
          unobserve() {}
          takeRecords() {
            return [];
          }
        },
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const scrollToEnd = () =>
      act(() => {
        for (const { callback, targets } of [...observers]) {
          callback(
            targets.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
            {} as IntersectionObserver,
          );
        }
      });

    it('loads the next page on the All tab when scrolled to the end', async () => {
      await renderPage({ reports: many });

      await screen.findByRole('link', { name: 'Report 00' });
      expect(rows()).toHaveLength(PAGE_SIZE);

      scrollToEnd();

      expect(rows()).toHaveLength(PAGE_SIZE + 10);
      // Everything is loaded, so nothing is left watching for the end.
      expect(observers).toHaveLength(0);
    });

    it('has no "Load more" button or "Showing X of Y"', async () => {
      await renderPage({ reports: many });

      await screen.findByRole('link', { name: 'Report 00' });
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
    });

    // ↓ moves through every match, but only the loaded pages have links — ↵ on an unloaded row used
    // to do nothing.
    it('loads the page of the keyboard-selected row, scrolls to it, and opens it on Enter', async () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      await renderPage({ reports: many });

      await screen.findByRole('link', { name: 'Report 00' });

      await userEvent.click(await search());
      // From the first row (index 0) to the first row of the unloaded page.
      await userEvent.keyboard(`{ArrowDown>${PAGE_SIZE}/}`);

      const link = await screen.findByRole('link', { name: `Report ${PAGE_SIZE}` });
      expect(rows()).toHaveLength(PAGE_SIZE + 10);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'nearest' });

      const opened = vi.fn((event: Event) => event.preventDefault());
      link.addEventListener('click', opened);
      await userEvent.keyboard('{Enter}');

      expect(opened).toHaveBeenCalledTimes(1);
    });

    it('starts over when the query changes', async () => {
      await renderPage({ reports: many });
      await screen.findByRole('link', { name: 'Report 00' });
      scrollToEnd();
      expect(rows()).toHaveLength(PAGE_SIZE + 10);

      await userEvent.type(await search(), 'Report');

      expect(rows()).toHaveLength(PAGE_SIZE);
    });

    it('does not page the other tabs', async () => {
      await renderPage({ reports: many.map((r) => ({ ...r, ownerId: ME })) });

      await userEvent.click(await tab(/My reports/));

      expect(rows()).toHaveLength(PAGE_SIZE + 10);
    });
  });

  describe('empty states', () => {
    it('explains itself when nothing has been saved yet', async () => {
      await renderPage({ reports: [] });

      expect(await screen.findByText('No saved reports yet')).toBeInTheDocument();
      expect(screen.getByText('Save a report and it will show up here.')).toBeInTheDocument();
    });

    it('has an empty Starred tab', async () => {
      await renderPage({ reports: MIXED });

      await userEvent.click(await tab(/Starred/));

      expect(screen.getByText('No starred reports yet')).toBeInTheDocument();
    });

    it('has an empty My reports tab', async () => {
      await renderPage({ reports: [report('2', 'Beta', { ownerId: ADA })] });

      await userEvent.click(await tab(/My reports/));

      expect(screen.getByText('You have not saved any reports')).toBeInTheDocument();
    });

    it('says when nothing matches the search', async () => {
      await renderPage({ reports: MIXED });

      await userEvent.type(await search(), 'zzz');

      expect(screen.getByText('No reports match "zzz"')).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('is offered on your own and unowned reports only', async () => {
      await renderPage({ reports: MIXED });
      await screen.findByRole('link', { name: 'Alpha' });

      expect(screen.getByRole('button', { name: 'Delete Alpha' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete Beta' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete Gamma' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete Delta' })).not.toBeInTheDocument();
      // No `ownerId` at all, so unowned as far as delete goes, even though its creator is shown.
      expect(screen.getByRole('button', { name: 'Delete Epsilon' })).toBeInTheDocument();
    });

    it('asks first, then deletes and forgets the report in stars and recents', async () => {
      window.localStorage.setItem('test-app-local-reports', JSON.stringify(['1', '2']));
      const { starsStore, update } = await renderPage({ reports: MIXED, stars: ['1', '2'] });

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
    const { starsStore } = await renderPage({ reports: MIXED });

    await userEvent.click(await screen.findByRole('button', { name: 'Star Gamma' }));

    await waitFor(() => expect(starsStore.ids).toEqual(['3']));
    expect(await tab(/Starred/)).toHaveTextContent('Starred1');
  });
});
