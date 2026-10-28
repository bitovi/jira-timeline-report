import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SimulationIssueResult } from './scheduler/stats-analyzer';
import type { GridUIData } from './AutoScheduler';

import React, { useState } from 'react';

import { IssueSimulationRow } from './IssueSimulationRow';

// Monday. Jira dates are local midnights, as `normalizeIssue` parses them.
const PLAN_START = new Date(Date.UTC(2026, 0, 5));
const DAYS = 40;

type RowArgs = {
  frozen: { startDay: number | null; dueDay: number | null } | null;
  jiraStart?: Date;
  jiraDue?: Date;
  bar: [number, number];
  /** The early tail of when it could start: the dot. */
  mightStart?: number;
  /** When its own estimate says it should start and end, at the slider's risk: the ticks. */
  should?: [number, number];
  isOverflowTrack?: boolean;
  mustStartByDay?: number;
  lateForFrozenPercent?: number;
  overlapInfo?: SimulationIssueResult['overlapInfo'];
  beforeStartPercent?: number;
  gridStartDay?: number;
};

const frozenDependent = { key: 'ORDER-9', summary: 'Launch campaign', frozen: { startDay: 10, dueDay: 20 } };

function toResult(args: RowArgs) {
  return {
    linkedIssue: {
      key: 'ORDER-1',
      summary: 'Apply referral reward in order flow',
      url: 'https://jira.example/browse/ORDER-1',
      frozen: args.frozen,
      linkedBlocks: args.lateForFrozenPercent ? [frozenDependent] : [],
      storyPointsMedian: 8,
      confidence: 70,
      team: { name: 'ORDER', parallelWorkLimit: 1, totalPointsPerDay: 1, pointsPerDayPerTrack: 1 },
      derivedTiming: {
        start: args.jiraStart,
        due: args.jiraDue,
        isConfidenceValid: true,
        isStoryPointsValid: true,
        isStoryPointsMedianValid: true,
        defaultOrStoryPointsMedian: 8,
        usedConfidence: 70,
      },
    },
    startDayBottom: args.mightStart ?? args.bar[0],
    startDateWithTimeEnoughToFinish: args.bar[0],
    dueDayBottom: args.bar[1],
    dueDayTop: args.bar[1],
    ownDueDayTop: (args.should ?? args.bar)[1],
    ownShouldStartDay: (args.should ?? args.bar)[0],
    ownShouldEndDay: (args.should ?? args.bar)[1],
    ownDaysOfWork: (args.should ?? args.bar)[1] - (args.should ?? args.bar)[0],
    track: 0,
    adjustedDaysOfWork: args.bar[1] - args.bar[0],
    isOverflowTrack: args.isOverflowTrack ?? false,
    mustStartByDay: args.mustStartByDay,
    lateForFrozenPercent: args.lateForFrozenPercent ?? 0,
    beforeStartPercent: args.beforeStartPercent ?? 0,
    overlapInfo: args.overlapInfo,
  } as unknown as SimulationIssueResult;
}

/** One row of the grid: the label column, then `DAYS` day columns. Hover the bar for its tooltip. */
const Row = (args: RowArgs) => {
  const [isFrozen, setIsFrozen] = useState(Boolean(args.frozen));
  return (
    <div
      className="grid border border-neutral-30"
      style={{ gridTemplateColumns: `[what] 260px repeat(${DAYS}, minmax(12px, 1fr))` }}
    >
      <IssueSimulationRow
        issue={toResult(args)}
        gridRowStart={1}
        gridData={{ gridNumberOfDays: DAYS, gridStartDay: args.gridStartDay ?? 0 } as GridUIData}
        selectedStartDate={PLAN_START}
        uncertaintyWeight={80}
        isFrozen={isFrozen}
        onToggleFreeze={(_, next) => setIsFrozen(next)}
      />
    </div>
  );
};

const meta: Meta<typeof Row> = {
  title: 'reports/AutoScheduler/IssueSimulationRow',
  component: Row,
};

export default meta;

/** Unfrozen, with its Jira dates (days 15–25) shadowed behind the scheduled bar. Hover the label for the lock. */
export const WithJiraShadow: StoryObj<typeof Row> = {
  args: {
    frozen: null,
    jiraStart: new Date(2026, 0, 26),
    jiraDue: new Date(2026, 1, 6),
    bar: [4, 12],
    startRange: [2, 6],
  },
};

/**
 * The plan gives this item days 4–12. It might start as early as day 2 (the dot); at its own 80% size
 * of 12 days it should start by day 6 and end by day 18 (the ticks).
 */
export const ShouldStartAndEnd: StoryObj<typeof Row> = {
  args: { frozen: null, bar: [4, 12], mightStart: 2, should: [6, 18] },
};

/** Frozen with both dates: a solid, locked bar exactly on its Jira dates, so no shadow. */
export const Frozen: StoryObj<typeof Row> = {
  args: {
    frozen: { startDay: 15, dueDay: 25 },
    jiraStart: new Date(2026, 0, 26),
    jiraDue: new Date(2026, 1, 6),
    bar: [15, 25],
  },
};

/** Frozen with only a due date: the start side keeps its uncertainty. */
export const FrozenDueOnly: StoryObj<typeof Row> = {
  args: { frozen: { startDay: null, dueDay: 25 }, jiraDue: new Date(2026, 1, 6), bar: [17, 25] },
};

/** More frozen items overlap than the team has tracks: the orange border, and an over-capacity tooltip. */
export const OverflowTrack: StoryObj<typeof Row> = {
  args: {
    ...Frozen.args,
    isOverflowTrack: true,
    overlapInfo: { overlapping: 2, tracks: 1, startDay: 15, endDay: 22 },
  },
};

/** Work upstream of a frozen item that usually finishes too late. Hover for "Must start by" and the late line. */
export const LateBlocker: StoryObj<typeof Row> = {
  args: { frozen: null, bar: [3, 14], mightStart: 0, mustStartByDay: -1, lateForFrozenPercent: 62 },
};

/**
 * A blocker of a frozen item that doesn't fit before it: scheduled as late as possible, so it starts
 * before the start date. The grid begins 6 days early; the start-date line marks where the plan begins.
 */
export const StartsBeforeStartDate: StoryObj<typeof Row> = {
  args: { frozen: null, bar: [-6, 4], mightStart: -8, beforeStartPercent: 72, gridStartDay: -8 },
};
