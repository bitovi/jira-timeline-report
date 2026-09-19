import type { ReactNode } from 'react';
import type { StatsUIData } from './scheduler/stats-analyzer';

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutoScheduler from './AutoScheduler';
import { CapacityOverridesProvider } from '../../services/capacity-overrides';

// The simulation itself is out of scope here — this exercises the rail's wiring to the grid.
const setUIStates: Array<(data: StatsUIData) => void> = [];
let throwOnConstruct: Error | null = null;
vi.mock('./scheduler/stats-analyzer', () => ({
  StatsAnalyzer: class {
    constructor({ setUIState }: { setUIState: (data: StatsUIData) => void }) {
      if (throwOnConstruct) throw throwOnConstruct;
      setUIStates.push(setUIState);
    }
    updateUncertaintyWeight() {}
    teardown() {}
  },
}));

vi.mock('./components/UpdateModal/UpdateModal', () => ({ default: () => null }));
vi.mock('../../../canjs/routing/route-data/index', () => ({ default: { jiraHelpers: {} } }));
// The issue observables are passed straight through, so the props below can be plain arrays.
vi.mock('../../hooks/useCanObservable', () => ({ useCanObservable: (observable: unknown) => observable }));
vi.mock('../../hooks/useSelectedStartDate/useSelectedStartDate.js', () => ({
  useSelectedStartDate: () => [new Date(Date.UTC(2026, 0, 5))],
}));
vi.mock('../../hooks/useUncertaintyWeight/useUncertaintyWeight.js', () => ({
  useUncertaintyWeight: () => ['average'],
}));
// Committing reaches storage through suspense queries; the row's wiring is what's under test here.
vi.mock('./components/TeamCapacityControls/useTeamCommit', () => ({
  useTeamCommit: () => ({ commit: vi.fn(), isSaving: false }),
}));
// `routeData.storage` is undefined here, so only the provider is stubbed — the rest of the module
// stays real, since replacing it wholesale would undefine `useStorage` for anything reaching for it.
vi.mock('../../services/storage', async () => ({
  ...(await vi.importActual<typeof import('../../services/storage')>('../../services/storage')),
  StorageProvider: ({ children }: { children: ReactNode }) => children,
}));

const ROUTES = [
  { keys: ['STORE-17', 'ORDER-23'], count: 60 },
  { keys: ['STORE-17', 'MARKETING-5'], count: 30 },
  { keys: ['MARKETING-6'], count: 10 },
];

const EPICS = ['STORE-17', 'ORDER-23', 'MARKETING-5', 'MARKETING-6'];

function issueResult(key: string, daysAdded: number) {
  return {
    linkedIssue: {
      key,
      summary: `Summary of ${key}`,
      url: `#${key}`,
      team: { name: 'ORDER' },
      derivedTiming: { isConfidenceValid: true, isStoryPointsValid: true, isStoryPointsMedianValid: true },
    },
    sequencingDaysAdded: daysAdded,
    sequencingCriticalityIndex: 0.5,
    startDayBottom: 0,
    startDateWithTimeEnoughToFinish: 0,
    dueDayBottom: 10,
    dueDayTop: 10,
    adjustedDaysOfWork: 10,
  };
}

const UI_DATA = {
  percentComplete: 100,
  simulationIssueResults: EPICS.map((key, i) => issueResult(key, 10 - i)),
  endDaySimulationResult: {
    linkedIssue: { key: 'end-date', summary: 'Plan finish', team: { name: 'Summary' } },
    startDayBottom: 0,
    startDateWithTimeEnoughToFinish: 0,
    dueDayBottom: 91,
    dueDayTop: 91,
    adjustedDaysOfWork: 0,
  },
  planSpread: null,
  criticalPath: {
    meanLength: 53.8,
    iterations: 100,
    distinctPathCount: ROUTES.length,
    topPaths: () => ROUTES,
  },
  teams: [
    {
      team: 'ORDER',
      teamData: {
        parallelWorkLimit: 1,
        pointsPerDayPerTrack: 1,
        totalPointsPerDay: 1,
        velocity: 21,
        daysPerSprint: 10,
      },
      hierarchyLevel: 7,
      tracks: [EPICS.map((key, i) => issueResult(key, 10 - i))],
    },
  ],
} as unknown as StatsUIData;

/** In the app the provider is mounted by the shell (`TimelineReport`), above every report. */
const withOverrides = (ui: ReactNode) => <CapacityOverridesProvider>{ui}</CapacityOverridesProvider>;

function renderScheduler() {
  const issues = EPICS.map((key) => ({ key })) as never;
  const view = render(
    withOverrides(<AutoScheduler primaryIssuesOrReleasesObs={issues} allIssuesOrReleasesObs={issues} />),
  );
  act(() => {
    for (const setUIState of setUIStates) setUIState(UI_DATA);
  });
  return view;
}

/** The plan-finish row is not a team track, so it is never filtered — exclude it from the check. */
const gridIssueNames = () =>
  Array.from(document.querySelectorAll('.work-item'))
    .map((element) => element.getAttribute('id'))
    .filter((key) => key !== 'end-date');

const openRail = () => userEvent.click(screen.getByRole('button', { expanded: false }));

beforeEach(() => {
  setUIStates.length = 0;
  throwOnConstruct = null;
});

describe('AutoScheduler contradictory Blocks links', () => {
  it("shows the numbered cycle, closing the loop back to item 1, instead of hanging on 'Starting'", async () => {
    const { BlocksCycleError } = await import('./scheduler/link-issues');
    throwOnConstruct = new BlocksCycleError([
      { key: 'STORE-17', summary: 'Summary of STORE-17', url: '#STORE-17' },
      { key: 'ORDER-23', summary: 'Summary of ORDER-23', url: '#ORDER-23' },
      { key: 'STORE-17', summary: 'Summary of STORE-17', url: '#STORE-17' },
    ]);

    renderScheduler();

    expect(screen.getByText("This plan can't be simulated")).toBeInTheDocument();
    // The closing entry repeats STORE-17, so the numbered list visibly loops back to item 1.
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('STORE-17');
    expect(items[0]).toContain('Summary of STORE-17');
    expect(items[1]).toContain('ORDER-23');
    expect(items[1]).toContain('Summary of ORDER-23');
    expect(items[2]).toContain('STORE-17');
    const links = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('#'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['#STORE-17', '#ORDER-23', '#STORE-17']);
  });
});

describe('AutoScheduler critical-path rail', () => {
  it('starts closed, behind a labelled spine', async () => {
    renderScheduler();
    expect(screen.getByRole('button', { expanded: false })).toHaveTextContent('Plan analysis');
    expect(screen.queryByText('Most common critical paths')).not.toBeInTheDocument();
  });

  it('disables epic and route rows while the simulation is still running', async () => {
    render(
      withOverrides(
        <AutoScheduler
          primaryIssuesOrReleasesObs={EPICS.map((key) => ({ key })) as never}
          allIssuesOrReleasesObs={EPICS.map((key) => ({ key })) as never}
        />,
      ),
    );
    act(() => {
      setUIStates[setUIStates.length - 1]({ ...UI_DATA, percentComplete: 60 });
    });
    await openRail();

    const rows = screen.getAllByRole('button').filter((button) => button.hasAttribute('data-epic-row'));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.hasAttribute('disabled'))).toBe(true);
  });

  it('shows both tables once opened, routes first', async () => {
    renderScheduler();
    await openRail();
    const headings = screen.getAllByText(/Most common critical paths|Epics on the critical path/);
    expect(headings.map((element) => element.textContent)).toEqual([
      'Most common critical paths',
      'Epics on the critical path',
    ]);
  });

  it('lights every route through an epic and filters the Gantt to their union', async () => {
    renderScheduler();
    await openRail();

    const epicRow = screen
      .getAllByRole('button')
      .find((button) => button.dataset.epicRow !== undefined && button.textContent?.includes('Summary of STORE-17'))!;
    await userEvent.click(epicRow);

    const routeRows = screen.getAllByRole('button').filter((button) => button.dataset.routeRow !== undefined);
    expect(routeRows[0]).toHaveAttribute('data-lit');
    expect(routeRows[1]).toHaveAttribute('data-lit');
    expect(routeRows[2]).not.toHaveAttribute('data-lit');

    expect(new Set(gridIssueNames())).toEqual(new Set(['STORE-17', 'ORDER-23', 'MARKETING-5']));
  });

  it('dims the epics that are off a selected route, and filters the Gantt to that chain', async () => {
    renderScheduler();
    await openRail();

    const routeRows = screen.getAllByRole('button').filter((button) => button.dataset.routeRow !== undefined);
    await userEvent.click(routeRows[1]);

    const epicRows = screen.getAllByRole('button').filter((button) => button.dataset.epicRow !== undefined);
    const dimmed = epicRows.filter((row) => row.className.includes('opacity-40'));
    expect(dimmed.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Summary of ORDER-23'),
      expect.stringContaining('Summary of MARKETING-6'),
    ]);

    expect(new Set(gridIssueNames())).toEqual(new Set(['STORE-17', 'MARKETING-5']));
  });

  it('updates the highlight when a later batch reveals a new route through the selection, instead of freezing it at click-time', async () => {
    renderScheduler();
    await openRail();

    const epicRow = screen
      .getAllByRole('button')
      .find((button) => button.dataset.epicRow !== undefined && button.textContent?.includes('Summary of STORE-17'))!;
    await userEvent.click(epicRow);
    expect(new Set(gridIssueNames())).toEqual(new Set(['STORE-17', 'ORDER-23', 'MARKETING-5']));

    // Simulates the Monte Carlo simulation converging further: a chain through STORE-17 that
    // hadn't won any iteration yet now has, so it's a brand-new entry in `topPaths`.
    const laterUiData = {
      ...UI_DATA,
      criticalPath: {
        ...UI_DATA.criticalPath,
        topPaths: () => [...ROUTES, { keys: ['STORE-17', 'MARKETING-6'], count: 1 }],
      },
    } as unknown as StatsUIData;
    act(() => {
      setUIStates[setUIStates.length - 1](laterUiData);
    });

    expect(new Set(gridIssueNames())).toEqual(new Set(['STORE-17', 'ORDER-23', 'MARKETING-5', 'MARKETING-6']));
  });

  it('clears the selection when the lit row is clicked again', async () => {
    renderScheduler();
    await openRail();

    const routeRows = () => screen.getAllByRole('button').filter((button) => button.dataset.routeRow !== undefined);
    await userEvent.click(routeRows()[0]);
    expect(gridIssueNames()).toHaveLength(2);

    await userEvent.click(routeRows()[0]);
    expect(new Set(gridIssueNames())).toEqual(new Set(EPICS));
  });

  it('clears a stale selection when the dataset changes, instead of filtering the new plan to nothing', async () => {
    const { rerender } = renderScheduler();
    await openRail();

    const routeRows = () => screen.getAllByRole('button').filter((button) => button.dataset.routeRow !== undefined);
    await userEvent.click(routeRows()[0]);
    expect(gridIssueNames()).toHaveLength(2);

    // A new array of issue objects, as a real JQL/team change would produce — the `[primary]`
    // effect tears down and restarts the simulation for it.
    const newIssues = EPICS.map((key) => ({ key })) as never;
    rerender(
      withOverrides(<AutoScheduler primaryIssuesOrReleasesObs={newIssues} allIssuesOrReleasesObs={newIssues} />),
    );
    act(() => {
      setUIStates[setUIStates.length - 1](UI_DATA);
    });

    expect(new Set(gridIssueNames())).toEqual(new Set(EPICS));
    expect(screen.getAllByRole('button').some((button) => button.hasAttribute('data-lit'))).toBe(false);
  });
});

describe('AutoScheduler team capacity row', () => {
  it('renders capacity as an editable read view and the outputs as text', () => {
    renderScheduler();

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.getByText('Points / Day')).toBeInTheDocument();
    expect(screen.getByText('Total Working Days')).toBeInTheDocument();
  });

  it('shows the track stepper for the team', () => {
    renderScheduler();

    expect(screen.getByText('1 track')).toBeInTheDocument();
  });

  it('has no commit controls until something changes', () => {
    renderScheduler();

    expect(screen.queryByRole('button', { name: 'Commit' })).not.toBeInTheDocument();
  });

  it('marks the row dirty and offers Reset once a track is added', async () => {
    renderScheduler();

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));

    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    expect(document.querySelector('[data-team-row="ORDER"][data-dirty="true"]')).toBeInTheDocument();
  });
});
