/**
 * Shared mock issues for GanttGrid tests and stories.
 *
 * These are deterministic fixtures so both unit/component tests and Storybook
 * boundary stories render predictable layouts.
 */
import type { DerivedTimingSlice, IssueOrRelease, RollupStatus } from './types';

interface MakeRollupStatusOptions {
  status?: string;
  start?: Date | null;
  due?: Date | null;
  issueKeys?: string[];
  lastPeriod?: { start?: Date | null; due?: Date | null } | null;
}

const makeRollupStatus = ({
  status = 'ontrack',
  start = null,
  due = null,
  issueKeys = [],
  lastPeriod = null,
}: MakeRollupStatusOptions = {}): RollupStatus => ({ status, start, due, issueKeys, lastPeriod });

interface MakeIssueOptions {
  key: string;
  summary?: string;
  status?: string;
  start?: Date | null;
  due?: Date | null;
  lastPeriod?: { start?: Date | null; due?: Date | null } | null;
  team?: IssueOrRelease['team'];
  type?: string;
  parentKey?: string | null;
  projectKey?: string;
  rank?: string | null;
  url?: string;
  childKeys?: string[];
  depth?: number;
  completedWorkingDays?: number;
  totalWorkingDays?: number;
  /** Which % complete calculation produced these numbers — defaults to 'children' (the pre-existing fixture behavior). */
  source?: 'self' | 'children' | 'average';
  remainingWorkingDays?: number;
  derivedTiming?: DerivedTimingSlice;
  issueTypeIconUrl?: string;
  workTypeRollups?: Partial<Record<'dev' | 'qa' | 'uat' | 'design', MakeRollupStatusOptions>>;
}

/** Build a minimal issue/release with the fields the Gantt report reads. */
export const makeIssue = ({
  key,
  summary = key,
  status = 'ontrack',
  start = null,
  due = null,
  lastPeriod = null,
  team = null,
  parentKey = null,
  projectKey = undefined,
  rank = null,
  url = `https://example.atlassian.net/browse/${key}`,
  childKeys = [],
  depth = 0,
  completedWorkingDays = 0,
  totalWorkingDays = 0,
  source = 'children',
  remainingWorkingDays = totalWorkingDays - completedWorkingDays,
  derivedTiming,
  issueTypeIconUrl,
  type,
  workTypeRollups = {},
}: MakeIssueOptions): IssueOrRelease => ({
  key,
  summary,
  type,
  url,
  parentKey,
  projectKey,
  rank,
  team,
  names: {},
  rollupDates: { start, due },
  rollupStatuses: {
    rollup: makeRollupStatus({ status, start, due, lastPeriod }),
    // When any work-type rollup is provided, fill the absent types with empty placeholders so
    // every lane is reserved in design→dev→qa→uat order (matching the real pipeline, where
    // prepareTimingData always writes `{ issueKeys: [] }` for missing types). This keeps a bar
    // like a lone uat in its own lane instead of floating to the top of the row.
    ...(Object.keys(workTypeRollups).length
      ? Object.fromEntries((['design', 'dev', 'qa', 'uat'] as const).map((wt) => [wt, makeRollupStatus()]))
      : {}),
    ...Object.fromEntries(
      Object.entries(workTypeRollups).map(([workType, options]) => [workType, makeRollupStatus(options)]),
    ),
  },
  completionRollup: { completedWorkingDays, totalWorkingDays, remainingWorkingDays, source },
  derivedTiming,
  issue: issueTypeIconUrl ? { fields: { 'Issue Type': { iconUrl: issueTypeIconUrl } } } : undefined,
  reportingHierarchy: { depth, childKeys },
  issueLastPeriod: lastPeriod ? { rollupDates: lastPeriod } : undefined,
});

/** A small hierarchy: one parent with two children, spread across Q1 2025. */
export const hierarchyIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-1',
    summary: 'Payments overhaul',
    status: 'ontrack',
    start: new Date('2025-01-06'),
    due: new Date('2025-03-14'),
    childKeys: ['PROJ-2', 'PROJ-3'],
    completedWorkingDays: 20,
    totalWorkingDays: 45,
  }),
  makeIssue({
    key: 'PROJ-2',
    summary: 'Design new checkout flow',
    status: 'complete',
    start: new Date('2025-01-06'),
    due: new Date('2025-01-31'),
    parentKey: 'PROJ-1',
    completedWorkingDays: 18,
    totalWorkingDays: 18,
  }),
  makeIssue({
    key: 'PROJ-3',
    summary: 'Implement payment gateway',
    status: 'behind',
    start: new Date('2025-02-01'),
    due: new Date('2025-03-14'),
    parentKey: 'PROJ-1',
    completedWorkingDays: 2,
    totalWorkingDays: 27,
  }),
];

/** A flat set of issues (no parent/child relationships) spread across teams. */
export const flatIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-10',
    summary: 'Kickoff milestone',
    status: 'complete',
    start: new Date('2025-01-02'),
    due: new Date('2025-01-10'),
    team: { name: 'Payments' },
  }),
  makeIssue({
    key: 'PROJ-11',
    summary: 'Beta release',
    status: 'ontrack',
    start: new Date('2025-01-15'),
    due: new Date('2025-02-15'),
    team: { name: 'Checkout' },
  }),
  makeIssue({
    key: 'PROJ-12',
    summary: 'GA release',
    status: 'warning',
    start: new Date('2025-02-15'),
    due: new Date('2025-03-20'),
    team: { name: 'Checkout' },
  }),
];

/** Issues without any start/due dates — render as empty-set circles. */
export const undatedIssues: IssueOrRelease[] = [
  makeIssue({ key: 'PROJ-20', summary: 'Not yet scheduled', status: 'notstarted' }),
  makeIssue({ key: 'PROJ-21', summary: 'Also not scheduled', status: 'new' }),
];

/** An issue whose current due date is entirely in the past (renders a "←" circle). */
export const pastDueIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-30',
    summary: 'Overdue milestone',
    status: 'blocked',
    start: new Date('2024-10-01'),
    due: new Date('2024-11-01'),
  }),
];

/** An issue whose last period differs from the current period (renders a shadow bar). */
export const shadowBarIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-40',
    summary: 'Slipping milestone',
    status: 'warning',
    start: new Date('2025-01-10'),
    due: new Date('2025-02-20'),
    lastPeriod: { start: new Date('2025-01-10'), due: new Date('2025-01-31') },
  }),
];

/** More than 20 issues — triggers density optimizations. */
export const denseIssues: IssueOrRelease[] = Array.from({ length: 25 }, (_, index) =>
  makeIssue({
    key: `PROJ-${100 + index}`,
    summary: `Milestone ${index + 1}`,
    status: index % 3 === 0 ? 'complete' : index % 3 === 1 ? 'ontrack' : 'behind',
    start: new Date(2025, 0, 1 + index * 3),
    due: new Date(2025, 0, 10 + index * 3),
  }),
);

/** Issues with dev/qa/uat work-type rollups — for breakdown mode. */
export const breakdownIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-50',
    summary: 'Feature with breakdown',
    status: 'ontrack',
    start: new Date('2025-01-06'),
    due: new Date('2025-03-14'),
    workTypeRollups: {
      dev: { status: 'complete', start: new Date('2025-01-06'), due: new Date('2025-01-31'), issueKeys: ['DEV-1'] },
      qa: { status: 'ontrack', start: new Date('2025-02-01'), due: new Date('2025-02-20'), issueKeys: ['QA-1'] },
      uat: { status: 'notstarted', start: new Date('2025-02-21'), due: new Date('2025-03-14'), issueKeys: ['UAT-1'] },
    },
  }),
];
