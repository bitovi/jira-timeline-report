/**
 * Shared mock issues/releases for tests and stories.
 *
 * These are deterministic fixtures so both unit/component tests and Storybook
 * boundary stories render predictable layouts.
 */
import type { IssueOrRelease } from './types';
import type { PlottedIssue } from './types';
import { getStatusColorClass } from '../shared/timeline';

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
  url?: string;
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
  url = undefined,
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
  url,
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
  makeIssue({
    key: 'PROJ-21',
    summary: 'No due date',
    status: 'unknown',
    due: null,
    url: 'https://example.atlassian.net/browse/PROJ-21',
  }),
  makeIssue({ key: 'PROJ-22', summary: 'Also has a due date', status: 'complete', due: new Date('2025-02-20') }),
];

/** Several undated issues across different statuses — used for the "N without dates" key/modal. */
export const undatedIssues: IssueOrRelease[] = [
  makeIssue({
    key: 'PROJ-42',
    summary: 'Payments epic — vendor selection',
    status: 'behind',
    due: null,
    url: 'https://example.atlassian.net/browse/PROJ-42',
  }),
  makeIssue({
    key: 'PROJ-58',
    summary: 'Search revamp discovery',
    status: 'ontrack',
    due: null,
    url: 'https://example.atlassian.net/browse/PROJ-58',
  }),
  makeIssue({
    key: 'PROJ-73',
    summary: 'Data migration from legacy warehouse',
    status: 'blocked',
    due: null,
    url: 'https://example.atlassian.net/browse/PROJ-73',
  }),
  makeIssue({
    key: 'PROJ-90',
    summary: 'Backlog cleanup & grooming',
    status: 'unknown',
    due: null,
    url: 'https://example.atlassian.net/browse/PROJ-90',
  }),
];

/**
 * Smart-layout scenario: an isolated early milestone (its due date lands a full quarter before
 * everything else) plus a dense cluster of long-labeled items with close due dates.
 *
 * Exercises both smart-layout behaviors at once:
 *  - The lone early item ("Outcome A", due Oct) flows its label RIGHT (inward), and the empty
 *    leading quarter (Jul–Sep) it would otherwise force is trimmed away.
 *  - The mid-range cluster's labels flip sides so near-collisions share rows, reducing height.
 */
export const smartLayoutIssues: IssueOrRelease[] = [
  makeIssue({ key: 'OUT-1', summary: 'Outcome A', status: 'complete', due: new Date('2025-10-10') }),
  makeIssue({ key: 'TRAF-1', summary: 'traffic capacity – 25% more', status: 'ontrack', due: new Date('2026-05-15') }),
  makeIssue({
    key: 'DIG-1',
    summary: 'Digital Channel sales – 5% increase',
    status: 'behind',
    due: new Date('2026-05-25'),
  }),
  makeIssue({ key: 'CONV-1', summary: 'conversions – 5% uplift', status: 'ontrack', due: new Date('2026-06-05') }),
  makeIssue({
    key: 'HOST-1',
    summary: 'hosting costs – 10% reduction',
    status: 'warning',
    due: new Date('2026-06-20'),
  }),
  makeIssue({
    key: 'ONB-1',
    summary: 'Onboarding costs – 30% reduction',
    status: 'ontrack',
    due: new Date('2026-07-25'),
  }),
  makeIssue({ key: 'STORE-100', summary: '100 Stores', status: 'ontrack', due: new Date('2026-11-01') }),
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
  url?: string;
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
  url = undefined,
}: MakePlottedIssueOptions = {}): PlottedIssue => ({
  key,
  issue: makeIssue({ key, summary, shortVersion, status, due: new Date('2025-02-15'), url }),
  leftPercentStart,
  rightPercentEnd,
  endPercentFromRight,
  widthInPercent,
  overflowsLeft,
  statusColorClass: getStatusColorClass(status),
  textSize,
  markerRadius,
});
