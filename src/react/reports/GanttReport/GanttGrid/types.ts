/**
 * Gantt-specific TypeScript types.
 *
 * Extends the shared timeline `IssueOrRelease` slice (src/react/reports/shared/timeline/types.ts)
 * with the fields the Gantt reads that the scatter timeline does not: rollup dates, work-type
 * (dev/qa/uat) rollups, completion percentage, reporting hierarchy (for expand/collapse), and
 * the prior-period snapshot used for "shadow" bars.
 */

export interface DateReason {
  reference?: { url?: string; summary?: string };
  message?: string;
}

export interface RollupStatus {
  status: string;
  start?: Date | null;
  due?: Date | null;
  issueKeys: string[];
  lastPeriod?: { start?: Date | null; due?: Date | null } | null;
  /** Why `start`/`due` ended up where they did — shown in `IssueTooltip`. */
  startFrom?: DateReason;
  dueTo?: DateReason;
  statusData?: { warning?: boolean; message?: string };
}

/** Timing fields read by the % complete modal's "self" calculation breakdown. */
export interface DerivedTimingSlice {
  completedDaysOfWork: number;
  totalDaysOfWork: number | null;
  datesDaysOfWork: number | null;
  datesCompletedDaysOfWork: number;
  isStoryPointsMedianValid: boolean;
  isStoryPointsValid: boolean;
  deterministicTotalPoints: number;
  defaultOrStoryPointsMedian: number;
  usedConfidence: number;
}

/** Minimal issue/release shape the Gantt report reads. */
export interface IssueOrRelease {
  key: string;
  summary: string;
  type?: string;
  url?: string;
  parentKey?: string | null;
  projectKey?: string;
  rank?: string | null;
  team?: {
    name: string;
    velocity?: number;
    daysPerSprint?: number;
    parallelWorkLimit?: number;
    pointsPerDayPerTrack?: number;
    spreadEffortAcrossDates?: boolean;
  } | null;
  names?: { shortVersion?: string | null };
  rollupDates: { start?: Date | null; due?: Date | null; dueTo?: Date | null };
  rollupStatuses: {
    rollup: RollupStatus;
    dev?: RollupStatus;
    qa?: RollupStatus;
    uat?: RollupStatus;
    design?: RollupStatus;
    [workType: string]: RollupStatus | undefined;
  };
  completionRollup: {
    completedWorkingDays: number;
    totalWorkingDays: number;
    remainingWorkingDays?: number;
    source?: 'self' | 'children' | 'average';
  };
  /** Present when the underlying issue has been through `deriveIssue` — powers the "self" calculation breakdown. */
  derivedTiming?: DerivedTimingSlice;
  /** Raw Jira issue, only read for its issue-type icon in the % complete modal header. */
  issue?: { fields?: { 'Issue Type'?: { iconUrl?: string } } };
  reportingHierarchy: { depth: number; childKeys: string[] };
  issueLastPeriod?: { rollupDates?: { start?: Date | null; due?: Date | null } };
}

/** Minimal, additive group-header data for a "group" row (parent/team/project band). */
export interface GroupHeader {
  key: string;
  summary: string;
  status?: string | null;
  /** The parent issue itself, when grouping by parent — enables the full `IssueTooltip`. */
  parent?: IssueOrRelease | null;
}

export type GanttRow =
  | { type: 'issue'; issue: IssueOrRelease; isShowingChildren: boolean; depth: number }
  | { type: 'group'; issue: GroupHeader; depth: 0 };

export interface AxisRange {
  firstDay: Date;
  lastDay: Date;
}

export interface Work {
  start?: Date | null;
  due?: Date | null;
}

export interface BarPosition {
  isEmpty: boolean;
  startExtends: boolean;
  endExtends: boolean;
  endIsBeforeFirstDay: boolean;
  startIsAfterLastDay: boolean;
  widthPercent: number;
  marginLeftPercent: number;
}

export interface WorkTypeWithWork {
  type: string;
  hasWork: boolean;
}

export interface DatesTooltipData {
  /** Work-type label (e.g. "Dev", "QA", "UAT") — shown only for breakdown segment bars. */
  labelPill?: string;
  startPill?: string;
  durationPill?: string;
  endPill?: string;
}

// Quarter, Month, QuartersAndMonths — reused from shared/timeline (compute-quarters-and-months).
export type { Month, Quarter, QuartersAndMonths } from '../../shared/timeline/types';
export type { GroupByOption, AncestorRef } from '../../shared/timeline/helpers/groupIssues';
