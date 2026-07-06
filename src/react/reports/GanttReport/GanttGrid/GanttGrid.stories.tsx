import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import type { GroupByOption, IssueOrRelease } from './types';
import { GanttGrid } from './GanttGrid';
import { makeIssue } from './fixtures';

/** A date `n` days from today (for stories, so bars render against the axis's real "today"). */
const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

/** A small hierarchy: one parent with two children, spread across the next couple months. */
const hierarchyIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-1',
    summary: 'Payments overhaul',
    status: 'ontrack',
    start: daysFromNow(-10),
    due: daysFromNow(60),
    childKeys: ['PROJ-2', 'PROJ-3'],
    completedWorkingDays: 20,
    totalWorkingDays: 45,
  }),
  makeIssue({
    key: 'PROJ-2',
    summary: 'Design new checkout flow',
    status: 'complete',
    start: daysFromNow(-10),
    due: daysFromNow(5),
    parentKey: 'PROJ-1',
    completedWorkingDays: 18,
    totalWorkingDays: 18,
  }),
  makeIssue({
    key: 'PROJ-3',
    summary: 'Implement payment gateway',
    status: 'behind',
    start: daysFromNow(6),
    due: daysFromNow(60),
    parentKey: 'PROJ-1',
    completedWorkingDays: 2,
    totalWorkingDays: 27,
  }),
];

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

interface Args {
  primaryIssues: IssueOrRelease[];
  allIssues?: IssueOrRelease[];
  groupBy?: GroupByOption;
  roundTo?: string;
  breakdown?: boolean;
  showPercentComplete?: boolean;
}

const meta: Meta<Args> = {
  title: 'Reports/GanttReport/GanttGrid',
  render: ({ primaryIssues, allIssues, groupBy, roundTo, breakdown, showPercentComplete }) => (
    <GanttGrid
      primaryIssuesOrReleasesObs={obs(primaryIssues)}
      allIssuesOrReleasesObs={obs(allIssues ?? primaryIssues)}
      groupByObs={obs(groupBy ?? '')}
      primaryIssueTypeObs={obs('Epic')}
      roundToObs={obs(roundTo ?? 'day')}
      breakdownObs={obs(breakdown ?? false)}
      showPercentCompleteObs={obs(showPercentComplete ?? false)}
    />
  ),
};
export default meta;

type Story = StoryObj<Args>;

/** A parent with two children, collapsed by default — click the chevron to expand. */
export const HierarchyCollapsed: Story = {
  args: { primaryIssues: [hierarchyIssues[0]], allIssues: hierarchyIssues },
};

/** With the % complete column enabled. */
export const WithPercentComplete: Story = {
  args: { primaryIssues: [hierarchyIssues[0]], allIssues: hierarchyIssues, showPercentComplete: true },
};

/** Grouped by team — each band shows a bold group header row. */
export const GroupedByTeam: Story = {
  args: {
    primaryIssues: [
      makeIssue({
        key: 'T-1',
        summary: 'Checkout redesign',
        team: { name: 'Payments' },
        start: daysFromNow(0),
        due: daysFromNow(30),
      }),
      makeIssue({
        key: 'T-2',
        summary: 'Fraud rules',
        team: { name: 'Trust & Safety' },
        start: daysFromNow(5),
        due: daysFromNow(45),
      }),
    ],
    groupBy: 'team',
  },
};

/** Breakdown mode: thin dev/qa/uat bars instead of one rollup bar. */
export const BreakdownMode: Story = {
  args: {
    primaryIssues: [
      makeIssue({
        key: 'B-1',
        summary: 'Multi-track feature',
        start: daysFromNow(0),
        due: daysFromNow(60),
        workTypeRollups: {
          dev: { status: 'complete', start: daysFromNow(0), due: daysFromNow(20), issueKeys: ['B-1'] },
          qa: { status: 'ontrack', start: daysFromNow(21), due: daysFromNow(40), issueKeys: ['B-1'] },
        },
      }),
    ],
    breakdown: true,
  },
};

/** Breakdown mode with every work type present — design, dev, qa, and uat bars. */
export const BreakdownAllWorkTypes: Story = {
  args: {
    primaryIssues: [
      makeIssue({
        key: 'ALL-1',
        summary: 'Full pipeline feature',
        start: daysFromNow(0),
        due: daysFromNow(80),
        workTypeRollups: {
          design: { status: 'complete', start: daysFromNow(0), due: daysFromNow(15), issueKeys: ['ALL-1'] },
          dev: { status: 'complete', start: daysFromNow(16), due: daysFromNow(40), issueKeys: ['ALL-1'] },
          qa: { status: 'ontrack', start: daysFromNow(41), due: daysFromNow(60), issueKeys: ['ALL-1'] },
          uat: { status: 'notstarted', start: daysFromNow(61), due: daysFromNow(80), issueKeys: ['ALL-1'] },
        },
      }),
      makeIssue({
        key: 'ALL-2',
        summary: 'Design only',
        start: daysFromNow(0),
        due: daysFromNow(20),
        workTypeRollups: {
          design: { status: 'ontrack', start: daysFromNow(0), due: daysFromNow(20), issueKeys: ['ALL-2'] },
        },
      }),
      makeIssue({
        key: 'ALL-3',
        summary: 'Dev only',
        start: daysFromNow(10),
        due: daysFromNow(45),
        workTypeRollups: {
          dev: { status: 'ontrack', start: daysFromNow(10), due: daysFromNow(45), issueKeys: ['ALL-3'] },
        },
      }),
      makeIssue({
        key: 'ALL-4',
        summary: 'UAT only',
        start: daysFromNow(55),
        due: daysFromNow(80),
        workTypeRollups: {
          uat: { status: 'notstarted', start: daysFromNow(55), due: daysFromNow(80), issueKeys: ['ALL-4'] },
        },
      }),
    ],
    breakdown: true,
  },
};

/** Breakdown mode where only dev and uat are used across the whole report — just two reserved lanes. */
export const BreakdownDevAndUat: Story = {
  args: {
    primaryIssues: [
      makeIssue({
        key: 'DU-1',
        summary: 'Dev and UAT',
        start: daysFromNow(0),
        due: daysFromNow(60),
        workTypeRollups: {
          dev: { status: 'complete', start: daysFromNow(0), due: daysFromNow(35), issueKeys: ['DU-1'] },
          uat: { status: 'ontrack', start: daysFromNow(36), due: daysFromNow(60), issueKeys: ['DU-1'] },
        },
      }),
      makeIssue({
        key: 'DU-2',
        summary: 'Dev only',
        start: daysFromNow(5),
        due: daysFromNow(40),
        workTypeRollups: {
          dev: { status: 'ontrack', start: daysFromNow(5), due: daysFromNow(40), issueKeys: ['DU-2'] },
        },
      }),
      makeIssue({
        key: 'DU-3',
        summary: 'UAT only',
        start: daysFromNow(45),
        due: daysFromNow(60),
        workTypeRollups: {
          uat: { status: 'notstarted', start: daysFromNow(45), due: daysFromNow(60), issueKeys: ['DU-3'] },
        },
      }),
    ],
    breakdown: true,
  },
};

/** Dense layout (> 20 issues) — smaller text/bars, density optimizations engaged. */
export const LotsOfIssues: Story = {
  args: {
    primaryIssues: Array.from({ length: 28 }, (_, i) =>
      makeIssue({
        key: `LOT-${i}`,
        summary: `Work item ${i}`,
        status: ['ontrack', 'complete', 'behind', 'warning', 'blocked'][i % 5],
        start: daysFromNow(i),
        due: daysFromNow(5 + i * 3),
      }),
    ),
  },
};

/** An issue with no start/due date renders an empty-set circle instead of a bar. */
export const UndatedIssue: Story = {
  args: { primaryIssues: [makeIssue({ key: 'U-1', summary: 'Not yet scheduled' })] },
};

/** An issue whose due date has already passed shows the past-due circle. */
export const PastDueIssue: Story = {
  args: {
    primaryIssues: [
      makeIssue({
        key: 'P-1',
        summary: 'Missed deadline',
        status: 'behind',
        start: new Date('2024-10-01'),
        due: new Date('2024-11-01'),
      }),
    ],
  },
};

/** A bar whose current period differs from its last snapshot shows a shadow bar underneath. */
export const WithShadowBar: Story = {
  args: {
    primaryIssues: [
      makeIssue({
        key: 'S-1',
        summary: 'Slipped a bit',
        status: 'behind',
        start: daysFromNow(0),
        due: daysFromNow(40),
        lastPeriod: { start: daysFromNow(0), due: daysFromNow(25) },
      }),
    ],
  },
};
