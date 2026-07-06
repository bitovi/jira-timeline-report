import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease } from './types';
import { ScatterTimeline } from './ScatterTimeline';
import {
  makeIssue,
  spacedIssues,
  collidingIssues,
  mixedMissingDueIssues,
  undatedIssues,
  smartLayoutIssues,
  groupableIssues,
  groupableParents,
} from './fixtures';

/** A minimal static observable stub for stories (no reactive updates needed). */
const obs = <T,>(value: T): CanObservable<T> =>
  ({
    value,
    getData: () => value,
    get: () => value,
    set: () => undefined,
    on: () => undefined,
    off: () => undefined,
  }) as unknown as CanObservable<T>;

/** Full-width container — the component measures its own container width. */
const FixedWidth = (Story: React.FC) => (
  <div style={{ width: '100%' }}>
    <Story />
  </div>
);

interface Args {
  issues: IssueOrRelease[];
  allIssues?: IssueOrRelease[];
  roundTo: string;
  groupBy?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

const meta: Meta<Args> = {
  title: 'Reports/ScatterTimeline/ScatterTimeline',
  decorators: [FixedWidth],
  render: ({ issues, allIssues, roundTo, groupBy, dateRangeStart, dateRangeEnd }) => (
    <ScatterTimeline
      primaryIssuesOrReleasesObs={obs(issues)}
      allIssuesOrReleasesObs={obs(allIssues ?? issues)}
      roundToObs={obs(roundTo)}
      groupByObs={obs(groupBy ?? '')}
      dateRangeStartObs={obs(dateRangeStart ?? '')}
      dateRangeEndObs={obs(dateRangeEnd ?? '')}
    />
  ),
  args: { roundTo: 'day' },
};
export default meta;

type Story = StoryObj<Args>;

/** #1 Empty — grid with headers + today line only. */
export const Empty: Story = { args: { issues: [] } };

/** A single issue near the middle of the range. */
export const SingleIssue: Story = {
  args: {
    issues: [makeIssue({ key: 'PROJ-1', summary: 'Only milestone', status: 'ontrack', due: new Date('2025-02-15') })],
  },
};

/** A small, well-spaced set (no collisions). */
export const SpacedIssues: Story = { args: { issues: spacedIssues } };

/** #2 Mix where issues without a due date are omitted from the grid and surfaced in the footer key. */
export const IssuesWithoutDueDates: Story = { args: { issues: mixedMissingDueIssues } };

/** Several undated issues alongside dated ones — click the footer key to open the modal list. */
export const ManyIssuesWithoutDates: Story = { args: { issues: [...spacedIssues, ...undatedIssues] } };

/** #4 Dense collisions on the same due date → multiple packed rows. */
export const DenseCollisions: Story = { args: { issues: collidingIssues } };

/**
 * Smart layout: labels flip to whichever side minimizes rows, and the empty leading quarter
 * (before the isolated early "Outcome A" milestone) is trimmed. "Outcome A"'s label flows
 * right into open space instead of left across the empty Jul–Sep quarter.
 */
export const SmartLayout: Story = { args: { issues: smartLayoutIssues } };

/** #6 Lots of issues (> 20) → density optimizations on. */
export const LotsOfIssues: Story = {
  args: {
    issues: Array.from({ length: 28 }, (_, i) =>
      makeIssue({
        key: `LOT-${i}`,
        summary: `Work item ${i}`,
        status: ['ontrack', 'complete', 'behind', 'warning', 'blocked'][i % 5],
        due: new Date(2025, 0, 5 + i * 3),
      }),
    ),
  },
};

/** #3 Out-of-range dates: due before firstDay and after lastDay. */
export const OutOfRangeDates: Story = {
  args: {
    issues: [
      makeIssue({ key: 'OOR-1', summary: 'Way in the past', status: 'complete', due: new Date('2024-06-01') }),
      makeIssue({ key: 'OOR-2', summary: 'Mid range', status: 'ontrack', due: new Date('2025-02-15') }),
      makeIssue({ key: 'OOR-3', summary: 'Far in the future', status: 'behind', due: new Date('2026-06-01') }),
    ],
  },
};

/** #3 Early-due long label → flips to the right of the marker (overflowsLeft). */
export const EarlyDueLongLabel: Story = {
  args: {
    issues: [
      makeIssue({
        key: 'EARLY-1',
        summary: 'This early milestone has a very long label that would clip off the left edge',
        status: 'ontrack',
        due: new Date('2025-01-05'),
      }),
      // A far-future issue widens the total range so the early issue sits near the left edge,
      // where its long label would clip off-screen and must flip to the right of the marker.
      makeIssue({ key: 'FAR-1', summary: 'Far future milestone', status: 'behind', due: new Date('2026-06-01') }),
    ],
  },
};

/** Leap-year span crossing Feb 2024 (column width 29fr). */
export const LeapYearSpan: Story = {
  args: {
    issues: [
      makeIssue({ key: 'LEAP-1', summary: 'Jan 2024', status: 'complete', due: new Date('2024-01-20') }),
      makeIssue({ key: 'LEAP-2', summary: 'Feb 2024', status: 'ontrack', due: new Date('2024-02-20') }),
      makeIssue({ key: 'LEAP-3', summary: 'Mar 2024', status: 'behind', due: new Date('2024-03-20') }),
    ],
  },
};

/** #9 One issue per status to verify every color-text-and-bg-* class. */
export const AllStatuses: Story = {
  args: {
    issues: ['complete', 'ontrack', 'behind', 'warning', 'blocked', 'unknown', 'notstarted', 'ahead', 'new'].map(
      (status, i) => makeIssue({ key: `ST-${i}`, summary: status, status, due: new Date(2025, 0, 8 + i * 8) }),
    ),
  },
};

/** No grouping selected — unchanged single-band layout, using the groupable fixture set. */
export const NoGrouping: Story = {
  args: { issues: groupableIssues, allIssues: [...groupableIssues, ...groupableParents], groupBy: '' },
};

/** Grouped by parent — one band per epic (via `parentKey`), labeled with the parent's summary, plus a "No Parent" band. */
export const GroupedByParent: Story = {
  args: { issues: groupableIssues, allIssues: [...groupableIssues, ...groupableParents], groupBy: 'parent' },
};

/** Grouped by team — one band per `team.name`, plus a "No Team" band for issues without one. */
export const GroupedByTeam: Story = {
  args: { issues: groupableIssues, allIssues: [...groupableIssues, ...groupableParents], groupBy: 'team' },
};

/** Grouped by project — one band per `projectKey`. */
export const GroupedByProject: Story = {
  args: { issues: groupableIssues, allIssues: [...groupableIssues, ...groupableParents], groupBy: 'project' },
};

/** Edge case: every issue shares one team → a single labeled band. */
export const GroupedSingleGroup: Story = {
  args: {
    issues: [
      makeIssue({
        key: 'S-1',
        summary: 'First task',
        status: 'ontrack',
        due: new Date('2025-01-15'),
        team: { name: 'Solo Team' },
      }),
      makeIssue({
        key: 'S-2',
        summary: 'Second task',
        status: 'behind',
        due: new Date('2025-02-10'),
        team: { name: 'Solo Team' },
      }),
      makeIssue({
        key: 'S-3',
        summary: 'Third task',
        status: 'complete',
        due: new Date('2025-03-05'),
        team: { name: 'Solo Team' },
      }),
    ],
    groupBy: 'team',
  },
};

/** Edge case: a large band (> 20 issues) → per-band density optimizations (smaller markers). */
export const GroupedLargeBand: Story = {
  args: {
    issues: Array.from({ length: 26 }, (_, i) =>
      makeIssue({
        key: `MEGA-${i}`,
        summary: `Mega item ${i}`,
        status: ['ontrack', 'complete', 'behind', 'warning', 'blocked'][i % 5],
        due: new Date(2025, 0, 5 + i * 3),
        team: { name: 'Mega Team' },
      }),
    ),
    groupBy: 'team',
  },
};

/** No range set (default) — every dated issue is plotted, identical to `SpacedIssues`. */
export const DateRangeEmpty: Story = { args: { issues: spacedIssues } };

/** A bounded `from`/`to` window — only "Design review" (Feb 5) falls inside Jan 20 – Feb 20; the axis auto-fits to it. */
export const DateRangeBounded: Story = {
  args: { issues: spacedIssues, dateRangeStart: '2025-01-20', dateRangeEnd: '2025-02-20' },
};

/** An open-ended `from` with no `to` — excludes everything due before Feb 1, keeps the rest. */
export const DateRangeOpenEnded: Story = {
  args: { issues: spacedIssues, dateRangeStart: '2025-02-01' },
};

/** A window that excludes every dated issue — shows the friendly empty state instead of a blank chart. */
export const DateRangeExcludesEverything: Story = {
  args: { issues: spacedIssues, dateRangeStart: '2025-06-01', dateRangeEnd: '2025-06-30' },
};
