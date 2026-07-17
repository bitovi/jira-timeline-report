import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { CanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import { GanttGrid } from './GanttGrid';
import { hierarchyIssues, makeIssue } from './fixtures';
import type { GroupByOption, IssueOrRelease } from './types';

/** Minimal stub matching the CanObservable surface the hook reads. */
const obs = <T,>(value: T): CanObservable<T> => {
  const handlers = new Set<() => void>();
  return {
    value,
    getData: () => value,
    get: () => value,
    set: () => undefined,
    on: (h: () => void) => handlers.add(h),
    off: (h: () => void) => handlers.delete(h),
  } as unknown as CanObservable<T>;
};

function renderGrid(overrides: Partial<React.ComponentProps<typeof GanttGrid>> = {}) {
  return render(
    <GanttGrid
      primaryIssuesOrReleasesObs={obs([hierarchyIssues[0]])}
      allIssuesOrReleasesObs={obs(hierarchyIssues)}
      groupByObs={obs('' as GroupByOption)}
      primaryIssueTypeObs={obs('Epic')}
      roundToObs={obs('day')}
      breakdownObs={obs(false)}
      showPercentCompleteObs={obs(false)}
      {...overrides}
    />,
  );
}

describe('GanttGrid', () => {
  it('renders one row per top-level issue when nothing is expanded', () => {
    const { container } = renderGrid();
    expect(screen.getByText('Payments overhaul')).toBeInTheDocument();
    // hierarchyIssues has 1 parent + 2 children; children only show once expanded.
    expect(container.querySelectorAll('a[href]').length).toBe(1);
  });

  it('expands to show children when the chevron is clicked', () => {
    const { container } = renderGrid();
    const chevronArea = container.querySelector('img')!.parentElement!;
    fireEvent.click(chevronArea);
    expect(container.querySelectorAll('a[href]').length).toBe(3);
  });

  it('renders a % complete column when showPercentCompleteObs is true', () => {
    renderGrid({ showPercentCompleteObs: obs(true) });
    // PROJ-1: 20/45 completed working days => 44%.
    expect(screen.getByText('44%')).toBeInTheDocument();
  });

  it('opens the percent-complete modal when a % cell is clicked', () => {
    renderGrid({ showPercentCompleteObs: obs(true) });
    fireEvent.click(screen.getByText('44%'));
    expect(screen.getByText('Remaining Work Calculation Summary')).toBeInTheDocument();
  });

  it('renders group rows when grouped by team', () => {
    const teamIssue = makeIssue({ key: 'T-1', team: { name: 'Team Rocket' } });
    renderGrid({
      groupByObs: obs('team' as GroupByOption),
      primaryIssuesOrReleasesObs: obs([teamIssue]),
      allIssuesOrReleasesObs: obs([teamIssue]),
    });
    expect(screen.getByText('Team Rocket')).toBeInTheDocument();
  });

  describe('due date range filter', () => {
    const inRange = makeIssue({ key: 'IN-1', summary: 'Due in January', due: new Date('2025-01-15') });
    const outOfRange = makeIssue({ key: 'OUT-1', summary: 'Due in March', due: new Date('2025-03-15') });
    const undated = makeIssue({ key: 'UNDATED-1', summary: 'No due date yet' });

    it('hides dated issues outside the range but keeps issues inside it', () => {
      renderGrid({
        primaryIssuesOrReleasesObs: obs([inRange, outOfRange]),
        allIssuesOrReleasesObs: obs([inRange, outOfRange]),
        dateRangeStartObs: obs('2025-01-01'),
        dateRangeEndObs: obs('2025-01-31'),
      });
      expect(screen.getByText('Due in January')).toBeInTheDocument();
      expect(screen.queryByText('Due in March')).not.toBeInTheDocument();
    });

    it('keeps undated issues regardless of an active range', () => {
      renderGrid({
        primaryIssuesOrReleasesObs: obs([inRange, outOfRange, undated]),
        allIssuesOrReleasesObs: obs([inRange, outOfRange, undated]),
        dateRangeStartObs: obs('2025-01-01'),
        dateRangeEndObs: obs('2025-01-31'),
      });
      expect(screen.getByText('Due in January')).toBeInTheDocument();
      expect(screen.getByText('No due date yet')).toBeInTheDocument();
      expect(screen.queryByText('Due in March')).not.toBeInTheDocument();
    });

    it('renders every issue when the range is empty (default/no filter)', () => {
      renderGrid({
        primaryIssuesOrReleasesObs: obs([inRange, outOfRange]),
        allIssuesOrReleasesObs: obs([inRange, outOfRange]),
      });
      expect(screen.getByText('Due in January')).toBeInTheDocument();
      expect(screen.getByText('Due in March')).toBeInTheDocument();
    });
  });
});
