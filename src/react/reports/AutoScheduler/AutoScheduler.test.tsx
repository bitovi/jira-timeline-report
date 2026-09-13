import type { StatsUIData } from './scheduler/stats-analyzer';

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutoScheduler from './AutoScheduler';

// The simulation itself is out of scope here — this exercises the rail's wiring to the grid.
const setUIStates: Array<(data: StatsUIData) => void> = [];
vi.mock('./scheduler/stats-analyzer', () => ({
  StatsAnalyzer: class {
    constructor({ setUIState }: { setUIState: (data: StatsUIData) => void }) {
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
      teamData: { parallelWorkLimit: 1, pointsPerDayPerTrack: 1 },
      tracks: [EPICS.map((key, i) => issueResult(key, 10 - i))],
    },
  ],
} as unknown as StatsUIData;

function renderScheduler() {
  const issues = EPICS.map((key) => ({ key })) as never;
  render(<AutoScheduler primaryIssuesOrReleasesObs={issues} allIssuesOrReleasesObs={issues} />);
  act(() => {
    for (const setUIState of setUIStates) setUIState(UI_DATA);
  });
}

/** The plan-finish row is not a team track, so it is never filtered — exclude it from the check. */
const gridIssueNames = () =>
  Array.from(document.querySelectorAll('.work-item'))
    .map((element) => element.getAttribute('id'))
    .filter((key) => key !== 'end-date');

const openRail = () => userEvent.click(screen.getByRole('button', { expanded: false }));

beforeEach(() => {
  setUIStates.length = 0;
});

describe('AutoScheduler critical-path rail', () => {
  it('starts closed, behind a labelled spine', async () => {
    renderScheduler();
    expect(screen.getByRole('button', { expanded: false })).toHaveTextContent('Plan analysis');
    expect(screen.queryByText('Most common critical paths')).not.toBeInTheDocument();
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

  it('clears the selection when the lit row is clicked again', async () => {
    renderScheduler();
    await openRail();

    const routeRows = () => screen.getAllByRole('button').filter((button) => button.dataset.routeRow !== undefined);
    await userEvent.click(routeRows()[0]);
    expect(gridIssueNames()).toHaveLength(2);

    await userEvent.click(routeRows()[0]);
    expect(new Set(gridIssueNames())).toEqual(new Set(EPICS));
  });
});
