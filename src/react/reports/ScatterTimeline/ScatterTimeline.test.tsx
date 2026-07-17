import React, { Suspense } from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease } from './types';
import {
  spacedIssues,
  collidingIssues,
  mixedMissingDueIssues,
  makeIssue,
  groupableIssues,
  groupableParents,
  groupableGrandparents,
} from './fixtures';

// Mock the measurement hook so jsdom's width-0 doesn't collapse the layout. Inject a fixed
// width per label so positioning/packing is deterministic.
vi.mock('./hooks/useMeasuredTextWidths', () => ({
  useMeasuredTextWidths: (config: { texts: string[] }) => ({
    widthsByText: new Map(config.texts.map((t) => [t, 120])),
    isMeasured: true,
  }),
}));

import { ScatterTimeline } from './ScatterTimeline';

/** Minimal stub matching the CanObservable surface the hook reads. */
const obs = <T,>(value: T): CanObservable<T> => {
  let current = value;
  const handlers = new Set<() => void>();
  return {
    value: current,
    getData: () => current,
    get: () => current,
    set: (v: T) => {
      current = v;
      handlers.forEach((h) => h());
    },
    on: (h: () => void) => handlers.add(h),
    off: (h: () => void) => handlers.delete(h),
  } as unknown as CanObservable<T>;
};

const renderScatter = (issues: IssueOrRelease[], roundTo = 'day') =>
  render(
    <Suspense fallback="loading">
      <ScatterTimeline
        primaryIssuesOrReleasesObs={obs(issues)}
        allIssuesOrReleasesObs={obs(issues)}
        roundToObs={obs(roundTo)}
      />
    </Suspense>,
  );

const renderGrouped = (issues: IssueOrRelease[], groupBy: string, allIssues: IssueOrRelease[] = issues) =>
  render(
    <Suspense fallback="loading">
      <ScatterTimeline
        primaryIssuesOrReleasesObs={obs(issues)}
        allIssuesOrReleasesObs={obs(allIssues)}
        roundToObs={obs('day')}
        groupByObs={obs(groupBy)}
      />
    </Suspense>,
  );

const renderGroupedWithDerivedIssues = (
  issues: IssueOrRelease[],
  groupBy: string,
  allIssues: IssueOrRelease[],
  filteredDerivedIssues: IssueOrRelease[],
) =>
  render(
    <Suspense fallback="loading">
      <ScatterTimeline
        primaryIssuesOrReleasesObs={obs(issues)}
        allIssuesOrReleasesObs={obs(allIssues)}
        filteredDerivedIssuesObs={obs(filteredDerivedIssues)}
        roundToObs={obs('day')}
        groupByObs={obs(groupBy)}
      />
    </Suspense>,
  );

beforeEach(() => {
  // Stub a non-zero container width for deterministic layout.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1230 });
});

afterEach(() => {
  cleanup();
});

describe('ScatterTimeline', () => {
  test('renders quarter and month headers', () => {
    renderScatter(spacedIssues);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
  });

  test('renders a today line', () => {
    renderScatter(spacedIssues);
    expect(screen.getByTestId('today-line')).toBeInTheDocument();
  });

  test('renders a marker for each issue with a due date', () => {
    renderScatter(spacedIssues);
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Beta release')).toBeInTheDocument();
  });

  test('omits issues without a rollup due date', () => {
    renderScatter(mixedMissingDueIssues);
    expect(screen.getByText('Has a due date')).toBeInTheDocument();
    expect(screen.getByText('Also has a due date')).toBeInTheDocument();
    expect(screen.queryByText('No due date')).not.toBeInTheDocument();
  });

  test('shows a footer key with the count of undated issues', () => {
    renderScatter(mixedMissingDueIssues);
    expect(screen.getByText('1 without dates')).toBeInTheDocument();
  });

  test('does not render the footer key when every issue has a due date', () => {
    renderScatter(spacedIssues);
    expect(screen.queryByText(/without dates/)).not.toBeInTheDocument();
  });

  test('applies status color classes to markers', () => {
    renderScatter(spacedIssues);
    const markers = screen.getAllByTestId('status-marker');
    const classes = markers.map((m) => m.className).join(' ');
    expect(classes).toContain('color-text-and-bg-complete');
    expect(classes).toContain('color-text-and-bg-ontrack');
    expect(classes).toContain('color-text-and-bg-behind');
  });

  test('packs colliding issues into multiple rows (still renders all markers)', () => {
    renderScatter(collidingIssues);
    expect(screen.getByText('Payments milestone alpha')).toBeInTheDocument();
    expect(screen.getByText('Payments milestone beta')).toBeInTheDocument();
    expect(screen.getByText('Payments milestone gamma')).toBeInTheDocument();
  });

  test('renders an empty grid (headers + today line only) with no issues', () => {
    renderScatter([]);
    expect(screen.getByTestId('today-line')).toBeInTheDocument();
    expect(screen.queryAllByTestId('status-marker')).toHaveLength(0);
  });

  test('applies density optimizations for > 20 issues (smaller markers)', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      makeIssue({ key: `D-${i}`, summary: `Dense ${i}`, due: new Date(2025, 1, (i % 27) + 1) }),
    );
    renderScatter(many);
    const marker = screen.getAllByTestId('status-marker')[0];
    // radius 6 → diameter 12px when dense (vs 16px normally).
    expect(marker.style.width).toBe('12px');
  });
});

describe('ScatterTimeline date range filter', () => {
  const renderWithRange = (issues: IssueOrRelease[], from?: string, to?: string) =>
    render(
      <Suspense fallback="loading">
        <ScatterTimeline
          primaryIssuesOrReleasesObs={obs(issues)}
          allIssuesOrReleasesObs={obs(issues)}
          roundToObs={obs('day')}
          dateRangeStartObs={obs(from ?? '')}
          dateRangeEndObs={obs(to ?? '')}
        />
      </Suspense>,
    );

  test('shows every dated issue when no range is set (default)', () => {
    renderWithRange(spacedIssues);
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Beta release')).toBeInTheDocument();
  });

  test('a bounded range shows only in-window markers', () => {
    renderWithRange(spacedIssues, '2025-01-01', '2025-02-10');
    expect(screen.getByText('Kickoff')).toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.queryByText('Beta release')).not.toBeInTheDocument();
  });

  test('an open-ended "from" excludes issues before it', () => {
    renderWithRange(spacedIssues, '2025-02-01', undefined);
    expect(screen.queryByText('Kickoff')).not.toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Beta release')).toBeInTheDocument();
  });

  test('undated issues are unaffected by the range filter', () => {
    renderWithRange(mixedMissingDueIssues, '2025-01-01', '2025-12-31');
    expect(screen.getByText('1 without dates')).toBeInTheDocument();
  });

  test('shows a "Showing X of Y" count hint and the outside-range key when a range is active', () => {
    renderWithRange(spacedIssues, '2025-01-01', '2025-02-10');
    expect(screen.getByText('Showing 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('1 outside date range')).toBeInTheDocument();
  });

  test('does not show the count hint or outside-range key when no range is set', () => {
    renderWithRange(spacedIssues);
    expect(screen.queryByText(/Showing \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/outside date range/)).not.toBeInTheDocument();
  });

  test('shows a friendly empty state when the range excludes every dated issue', () => {
    renderWithRange(spacedIssues, '2025-06-01', '2025-06-30');
    expect(screen.getByText('No issues are due in the selected date range.')).toBeInTheDocument();
    expect(screen.queryByText('Kickoff')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 3')).toBeInTheDocument();
    expect(screen.getByText('3 outside date range')).toBeInTheDocument();
  });
});

describe('ScatterTimeline grouping', () => {
  const allWithParents = [...groupableIssues, ...groupableParents];

  test('renders one band label per parent, plus a "No Parent" band', () => {
    renderGrouped(groupableIssues, 'parent', allWithParents);
    const bandTitles = screen.getAllByTestId('group-band-title').map((el) => el.textContent);
    expect(bandTitles).toEqual(['Onboarding Overhaul', 'Checkout Revamp', 'No Parent']);
  });

  test('each parent band contains its own issues', () => {
    renderGrouped(groupableIssues, 'parent', allWithParents);
    // Checkout Revamp (EPIC-1) children:
    expect(screen.getByText('Redesign cart page')).toBeInTheDocument();
    expect(screen.getByText('Add saved payment methods')).toBeInTheDocument();
    // Onboarding Overhaul (EPIC-2) children:
    expect(screen.getByText('Simplify signup flow')).toBeInTheDocument();
    expect(screen.getByText('Add social login')).toBeInTheDocument();
    // No Parent bucket:
    expect(screen.getByText('Unowned cleanup task')).toBeInTheDocument();
  });

  test('renders one band label per grandparent, plus a "No Grandparent" band', () => {
    renderGrouped(groupableIssues, 'grandparent', [...allWithParents, ...groupableGrandparents]);
    const bandTitles = screen.getAllByTestId('group-band-title').map((el) => el.textContent);
    expect(bandTitles).toEqual(['Revenue Growth Initiative', 'No Grandparent']);
  });

  test('each grandparent band contains the right issues', () => {
    renderGrouped(groupableIssues, 'grandparent', [...allWithParents, ...groupableGrandparents]);
    // Revenue Growth Initiative (INIT-1) -> Checkout Revamp (EPIC-1) children:
    expect(screen.getByText('Redesign cart page')).toBeInTheDocument();
    expect(screen.getByText('Add saved payment methods')).toBeInTheDocument();
    // Onboarding Overhaul (EPIC-2) has no parent -> No Grandparent bucket, along with the orphan:
    expect(screen.getByText('Simplify signup flow')).toBeInTheDocument();
    expect(screen.getByText('Add social login')).toBeInTheDocument();
    expect(screen.getByText('Unowned cleanup task')).toBeInTheDocument();
  });

  test('resolves the grandparent via filteredDerivedIssuesObs when the ancestor is outside allIssuesOrReleasesObs (real-world bug repro)', () => {
    // Mirrors the real bug: `allIssuesOrReleasesObs` (rolledupAndRolledBackIssuesAndReleases) is
    // scoped to the primary issue type and below, so when reporting on Epics with hierarchy
    // Outcome > Initiative > Epic, it contains ONLY the epics — the Initiative/Outcome are
    // absent even though they were fetched via JQL. `filteredDerivedIssuesObs` (the full,
    // unfiltered-by-hierarchy fetch) is where they actually live.
    renderGroupedWithDerivedIssues(
      groupableIssues,
      'grandparent',
      groupableIssues, // allIssuesOrReleasesObs: only the epics — no ancestors at all
      [...groupableIssues, ...groupableParents, ...groupableGrandparents], // filteredDerivedIssuesObs: everything
    );
    const bandTitles = screen.getAllByTestId('group-band-title').map((el) => el.textContent);
    expect(bandTitles).toEqual(['Revenue Growth Initiative', 'No Grandparent']);
  });

  test('renders one band label per team, with "No Team" last', () => {
    renderGrouped(groupableIssues, 'team', allWithParents);
    const bandTitles = screen.getAllByTestId('group-band-title').map((el) => el.textContent);
    expect(bandTitles).toEqual(['Checkout Team', 'Growth Team', 'No Team']);
  });

  test('renders one band label per project', () => {
    renderGrouped(groupableIssues, 'project', allWithParents);
    const bandTitles = screen.getAllByTestId('group-band-title').map((el) => el.textContent);
    expect(bandTitles).toEqual(['GROW', 'PROJ']);
  });

  test('renders a single band with no gutter label when ungrouped', () => {
    renderGrouped(groupableIssues, '', allWithParents);
    expect(screen.queryAllByTestId('group-band-title')).toHaveLength(0);
  });

  test('renders a single band when every issue shares the same group', () => {
    const sameTeam = [
      makeIssue({ key: 'S-1', summary: 'One', team: { name: 'Solo Team' }, due: new Date('2025-01-10') }),
      makeIssue({ key: 'S-2', summary: 'Two', team: { name: 'Solo Team' }, due: new Date('2025-02-10') }),
    ];
    renderGrouped(sameTeam, 'team');
    const bandTitles = screen.getAllByTestId('group-band-title').map((el) => el.textContent);
    expect(bandTitles).toEqual(['Solo Team']);
  });

  test('applies per-band density optimizations for a large group', () => {
    const bigTeam = Array.from({ length: 25 }, (_, i) =>
      makeIssue({
        key: `B-${i}`,
        summary: `Big ${i}`,
        team: { name: 'Mega Team' },
        due: new Date(2025, 1, (i % 27) + 1),
      }),
    );
    renderGrouped(bigTeam, 'team');
    const marker = screen.getAllByTestId('status-marker')[0];
    expect(marker.style.width).toBe('12px');
  });
});
