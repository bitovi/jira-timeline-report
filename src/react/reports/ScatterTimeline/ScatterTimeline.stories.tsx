import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease } from './types';
import { ScatterTimeline } from './ScatterTimeline';
import { makeIssue, spacedIssues, collidingIssues, mixedMissingDueIssues } from './fixtures';

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
  roundTo: string;
}

const meta: Meta<Args> = {
  title: 'Reports/ScatterTimeline/ScatterTimeline',
  decorators: [FixedWidth],
  render: ({ issues, roundTo }) => (
    <ScatterTimeline
      primaryIssuesOrReleasesObs={obs(issues)}
      allIssuesOrReleasesObs={obs(issues)}
      roundToObs={obs(roundTo)}
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

/** #2 Mix where issues without a due date are omitted. */
export const IssuesWithoutDueDates: Story = { args: { issues: mixedMissingDueIssues } };

/** #4 Dense collisions on the same due date → multiple packed rows. */
export const DenseCollisions: Story = { args: { issues: collidingIssues } };

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
