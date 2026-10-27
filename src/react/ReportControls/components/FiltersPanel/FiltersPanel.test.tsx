import React, { Suspense } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import routeData from '../../../../canjs/routing/route-data/route-data';
import FiltersPanel from './FiltersPanel';
import type { LevelFilters } from '../../../../jira/rollup/filter-rows/level-filters';

vi.mock('../../../../canjs/routing/route-data/route-data', async () => {
  const { ObservableObject } = await import('../../../../can');
  const { resolveLevelFilters } = await import('../../../../jira/rollup/filter-rows/level-filters');
  const list = () => ({
    get default() {
      return [];
    },
  });

  // Only what the panel reads, with the real resolver so legacy fallbacks behave as in the app.
  class FakeRouteData extends (ObservableObject as any) {
    static props = {
      primaryReportType: { default: 'start-due' },
      primaryIssueType: { default: 'Epic' },
      secondaryIssueType: { default: undefined },
      issueHierarchy: {
        get default() {
          return [
            { name: 'Initiative', hierarchyLevel: 2 },
            { name: 'Epic', hierarchyLevel: 1 },
            { name: 'Story', hierarchyLevel: 0 },
          ];
        },
      },
      derivedIssues: {
        get default() {
          return [
            { key: 'E-1', type: 'Epic', hierarchyLevel: 1, status: 'Done', releases: [] },
            { key: 'E-2', type: 'Feature', hierarchyLevel: 1, status: 'Todo', releases: [] },
            { key: 'S-1', type: 'Story', hierarchyLevel: 0, status: 'Todo', releases: [] },
          ];
        },
      },
      levelFilters: {
        get default() {
          return {};
        },
      },
      filterRows: list(),
      statusesToShow: list(),
      statusesToRemove: list(),
      hideUnknownInitiatives: { default: false },
      scatterDateRangeStart: { default: '' },
      scatterDateRangeEnd: { default: '' },
      releasesToShow: list(),
      showOnlySemverReleases: { default: false },
      cardsChildFilterRows: list(),
      get effectiveFilterRows() {
        const self = this as any;
        if (self.filterRows?.length) return self.filterRows;
        if (self.statusesToShow?.length) {
          return [{ id: 'legacy', field: 'jiraStatus', operator: 'is', value: self.statusesToShow }];
        }
        return [];
      },
      get effectiveLevelFilters() {
        return resolveLevelFilters(this as any);
      },
    };
  }

  return { default: new FakeRouteData() };
});

type FakeRouteData = Record<string, any>;
const data = routeData as unknown as FakeRouteData;

const row = (overrides = {}) => ({ id: 'r1', field: 'jiraStatus', operator: 'is', value: ['Done'], ...overrides });

const renderPanel = async () => {
  const user = userEvent.setup();
  render(
    <Suspense fallback="loading">
      <FiltersPanel />
    </Suspense>,
  );
  await user.click(screen.getByRole('button', { name: /^Filters/ }));
  return { user, dialog: screen.getByRole('dialog', { name: 'Filters' }) };
};

beforeEach(() => {
  data.primaryReportType = 'start-due';
  data.levelFilters = {};
  data.filterRows = [];
  data.statusesToShow = [];
  data.statusesToRemove = [];
  data.hideUnknownInitiatives = false;
  data.scatterDateRangeStart = '';
  data.scatterDateRangeEnd = '';
  data.releasesToShow = [];
  data.showOnlySemverReleases = false;
  data.cardsChildFilterRows = [];
});

// jsdom has no scrolling; `ScrollableTabList` scrolls a focused tab into view.
beforeAll(() => {
  Element.prototype.scrollTo ??= vi.fn() as unknown as Element['scrollTo'];
  Element.prototype.scrollBy ??= vi.fn() as unknown as Element['scrollBy'];
});

describe('<FiltersPanel />', () => {
  it('opens from the trigger with All items first and one tab per level', async () => {
    const { dialog } = await renderPanel();
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['All items', 'Initiatives', 'Epics', 'Stories']);
    expect(within(dialog).getByText('These filters apply to every issue type in the report.')).toBeInTheDocument();
  });

  it.each([
    ['Done', (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Done' }))],
    [
      'X',
      (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Close filters' })),
    ],
    ['Escape', (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    [
      'the backdrop',
      (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByTestId('filters-panel-backdrop')),
    ],
  ])('closes on %s', async (_label, closeWith) => {
    const { user } = await renderPanel();
    await closeWith(user);
    // It slides out before it unmounts.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('badges each tab, and the trigger, with its active filter count', async () => {
    data.levelFilters = { Story: { rows: [row(), row({ id: 'r2', value: [] })], hideWithoutDates: true } };
    data.hideUnknownInitiatives = true; // legacy fallback for the Report on level
    const { dialog } = await renderPanel();

    expect(within(dialog).getByRole('tab', { name: 'Stories 2' })).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: 'Epics 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters 3' })).toBeInTheDocument();
  });

  it("Clear empties only the selected tab's field filters", async () => {
    data.levelFilters = { Epic: { rows: [row()], hideWithoutDates: true }, Story: { rows: [row()] } };
    const { user, dialog } = await renderPanel();

    await user.click(within(dialog).getByRole('tab', { name: 'Epics 2' }));
    expect(within(dialog).getByText('These filters apply to Epics.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Clear field filters' }));

    expect((data.levelFilters as LevelFilters).Epic).toEqual({ rows: [], hideWithoutDates: true });
    expect((data.levelFilters as LevelFilters).Story).toEqual({ rows: [row()] });
  });

  it('the due date range Clear sits in its section header and clears only the range', async () => {
    data.levelFilters = { all: { rows: [row()], dueDateStart: '2026-01-01', dueDateEnd: '2026-03-31' } };
    const { user, dialog } = await renderPanel();

    await user.click(within(dialog).getByRole('button', { name: 'Clear due date range' }));

    expect((data.levelFilters as LevelFilters).all).toEqual({ rows: [row()] });
    expect(within(dialog).getByRole('button', { name: 'Clear due date range' })).toBeDisabled();
  });

  it('hides the due date range where it changes nothing', async () => {
    data.primaryReportType = 'estimate-analysis';
    const { user, dialog } = await renderPanel();

    expect(within(dialog).queryByText('Due date range')).not.toBeInTheDocument();

    // Above Report on, the range filters the rows every report reads.
    await user.click(within(dialog).getByRole('tab', { name: 'Initiatives' }));
    expect(within(dialog).getByText('Due date range')).toBeInTheDocument();
  });

  it('Clear all filters clears levelFilters and every legacy param', async () => {
    data.levelFilters = { all: { rows: [row()] } };
    data.statusesToShow = ['Done'];
    data.hideUnknownInitiatives = true;
    data.scatterDateRangeStart = '2026-01-01';
    data.cardsChildFilterRows = [row()];
    const { user } = await renderPanel();

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));

    expect(data.levelFilters).toEqual({});
    expect(data.statusesToShow).toEqual([]);
    expect(data.hideUnknownInitiatives).toBe(false);
    expect(data.scatterDateRangeStart).toBe('');
    expect(data.cardsChildFilterRows).toEqual([]);
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
  });

  it('offers Issue Type and writes rows live', async () => {
    const { user, dialog } = await renderPanel();

    await user.click(within(dialog).getByText('+ Add filter'));
    await user.click(within(dialog).getByLabelText('Field'));
    await user.click(screen.getByText('Issue Type'));
    await user.click(within(dialog).getByLabelText('Value'));
    await user.click(screen.getByText('Feature (1)'));

    expect((data.levelFilters as LevelFilters).all.rows).toEqual([
      expect.objectContaining({ field: 'issueType', operator: 'is', value: ['Feature'] }),
    ]);
  });

  it('does not offer Rollup Status above Report on', async () => {
    const { user, dialog } = await renderPanel();

    await user.click(within(dialog).getByRole('tab', { name: 'Initiatives' }));
    await user.click(within(dialog).getByText('+ Add filter'));
    await user.click(within(dialog).getByLabelText('Field'));

    expect(screen.getAllByText('Issue Type').length).toBeGreaterThan(0);
    expect(screen.queryByText('Rollup Status')).not.toBeInTheDocument();
  });

  it('labels hide-without-dates per tab', async () => {
    const { user, dialog } = await renderPanel();
    expect(within(dialog).getByLabelText('Hide items without dates')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('tab', { name: 'Stories' }));
    expect(within(dialog).getByLabelText('Hide Stories without dates')).toBeInTheDocument();
  });
});
