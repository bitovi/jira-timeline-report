/**
 * Shared mock issues/releases for tests and stories.
 *
 * These are deterministic fixtures so both unit/component tests and Storybook
 * boundary stories render predictable layouts.
 */
import type { IssueOrRelease } from './types';
import type { PlottedIssue } from './types';
import { getStatusColorClass } from './helpers';

interface MakeIssueOptions {
  key: string;
  summary?: string;
  shortVersion?: string | null;
  status?: string;
  due?: Date | null;
  dueTo?: Date | null;
  start?: Date | null;
  team?: { name: string } | null;
  parentKey?: string | null;
  projectKey?: string;
  rank?: string | null;
}

/** Build a minimal issue/release with the fields the scatter report reads. */
export const makeIssue = ({
  key,
  summary = key,
  shortVersion = null,
  status = 'ontrack',
  due = null,
  dueTo = null,
  start = null,
  team = null,
  parentKey = null,
  projectKey = undefined,
  rank = null,
}: MakeIssueOptions): IssueOrRelease => ({
  key,
  summary,
  names: { shortVersion },
  rollupDates: { start, due, dueTo },
  rollupStatuses: { rollup: { status, due, start } },
  status,
  team,
  parentKey,
  projectKey,
  rank,
});

/** A small, well-spaced set of issues within Q1 2025 (no collisions). */
export const spacedIssues: IssueOrRelease[] = [
  makeIssue({ key: 'PROJ-1', summary: 'Kickoff', status: 'complete', due: new Date('2025-01-10') }),
  makeIssue({ key: 'PROJ-2', summary: 'Design review', status: 'ontrack', due: new Date('2025-02-05') }),
  makeIssue({ key: 'PROJ-3', summary: 'Beta release', status: 'behind', due: new Date('2025-03-01') }),
];

/** Issues clustered on the same due date to force multiple packed rows. */
export const collidingIssues: IssueOrRelease[] = [
  makeIssue({ key: 'PROJ-10', summary: 'Payments milestone alpha', status: 'ontrack', due: new Date('2025-02-14') }),
  makeIssue({ key: 'PROJ-11', summary: 'Payments milestone beta', status: 'warning', due: new Date('2025-02-14') }),
  makeIssue({ key: 'PROJ-12', summary: 'Payments milestone gamma', status: 'blocked', due: new Date('2025-02-15') }),
];

/** A mix where some issues lack a due date and should be omitted. */
export const mixedMissingDueIssues: IssueOrRelease[] = [
  makeIssue({ key: 'PROJ-20', summary: 'Has a due date', status: 'ontrack', due: new Date('2025-02-10') }),
  makeIssue({ key: 'PROJ-21', summary: 'No due date', status: 'unknown', due: null }),
  makeIssue({ key: 'PROJ-22', summary: 'Also has a due date', status: 'complete', due: new Date('2025-02-20') }),
];

/** Parent issues referenced by {@link groupableIssues}' `parentKey` — passed as `allIssues`. */
export const groupableParents: IssueOrRelease[] = [
  makeIssue({ key: 'EPIC-1', summary: 'Checkout Revamp', rank: '0|b' }),
  makeIssue({ key: 'EPIC-2', summary: 'Onboarding Overhaul', rank: '0|a' }),
];

/** Issues carrying `parentKey`/`team`/`projectKey` — enough to exercise every v1 grouping dimension. */
export const groupableIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-30',
    summary: 'Redesign cart page',
    status: 'ontrack',
    due: new Date('2025-01-15'),
    parentKey: 'EPIC-1',
    team: { name: 'Checkout Team' },
    projectKey: 'PROJ',
  }),
  makeIssue({
    key: 'PROJ-31',
    summary: 'Add saved payment methods',
    status: 'behind',
    due: new Date('2025-02-10'),
    parentKey: 'EPIC-1',
    team: { name: 'Checkout Team' },
    projectKey: 'PROJ',
  }),
  makeIssue({
    key: 'PROJ-32',
    summary: 'Simplify signup flow',
    status: 'complete',
    due: new Date('2025-01-25'),
    parentKey: 'EPIC-2',
    team: { name: 'Growth Team' },
    projectKey: 'GROW',
  }),
  makeIssue({
    key: 'PROJ-33',
    summary: 'Add social login',
    status: 'warning',
    due: new Date('2025-03-05'),
    parentKey: 'EPIC-2',
    team: { name: 'Growth Team' },
    projectKey: 'GROW',
  }),
  makeIssue({
    key: 'PROJ-34',
    summary: 'Unowned cleanup task',
    status: 'unknown',
    due: new Date('2025-02-20'),
    parentKey: null,
    team: null,
    projectKey: 'PROJ',
  }),
];

interface MakePlottedIssueOptions {
  key?: string;
  summary?: string;
  shortVersion?: string | null;
  status?: string;
  leftPercentStart?: number;
  rightPercentEnd?: number;
  endPercentFromRight?: number;
  widthInPercent?: number;
  overflowsLeft?: boolean;
  textSize?: string;
  markerRadius?: number;
}

/** Build a fully positioned {@link PlottedIssue} for marker tests/stories. */
export const makePlottedIssue = ({
  key = 'PROJ-1',
  summary = 'Sample issue',
  shortVersion = null,
  status = 'ontrack',
  leftPercentStart = 40,
  rightPercentEnd = 50,
  endPercentFromRight = 50,
  widthInPercent = 10,
  overflowsLeft = false,
  textSize = '',
  markerRadius = 8,
}: MakePlottedIssueOptions = {}): PlottedIssue => ({
  key,
  issue: makeIssue({ key, summary, shortVersion, status, due: new Date('2025-02-15') }),
  leftPercentStart,
  rightPercentEnd,
  endPercentFromRight,
  widthInPercent,
  overflowsLeft,
  statusColorClass: getStatusColorClass(status),
  textSize,
  markerRadius,
});
