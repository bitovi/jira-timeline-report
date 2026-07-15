import { workType as workTypes } from '../../derived/work-status/work-status'; // ["design","dev","qa","uat"]
import { WithIssueLastPeriod } from '../../rolledup-and-rolledback/rollup-and-rollback';
import { WithBlockedStatuses } from '../../rollup/blocked-status-issues/blocked-status-issues';
import { WithDateRollup } from '../../rollup/dates/dates';
import { isDerivedIssue, IssueOrRelease } from '../../rollup/rollup';
import { WithWarningIssues } from '../../rollup/warning-issues/warning-issues';
import { notEmpty } from '../../shared/helpers';
import { DateAndIssueKeys, WithWorkTypeRollups } from '../work-type/work-type';

//!! This breaks the "clean" jira folder.  We should probably give these as arguments.
import { roundDateByRoundToParam } from '../../../canjs/routing/utils/round.js';

const workTypeWithChildren = ['children', ...workTypes] as const;
const WIGGLE_ROOM = 0;

type PeriodStatus = {
  status?: string;
  statusFrom?: { message: string; warning?: boolean };
};

/**
 * Three independent, pure date comparisons ({@link calculateNewlyFlags}) — NOT reconstructed
 * status categories. Only meaningful on `rollup` (not per-work-type lanes).
 */
export type NewlyFlags = {
  newlyStarted: boolean;
  newlyCompleted: boolean;
  newlyDated: boolean;
};

type DatesIssueKeysLastPeriodAndStatus = Partial<DateAndIssueKeys> & {
  lastPeriod?: Partial<DateAndIssueKeys> | null;
} & PeriodStatus;

type RollupTimingData = DatesIssueKeysLastPeriodAndStatus & Partial<NewlyFlags>;

type TimingData = {
  [key in (typeof workTypeWithChildren)[number]]?: DatesIssueKeysLastPeriodAndStatus;
} & { rollup: RollupTimingData };

export type WithRollupStatus = { rollupStatuses: TimingData };

/**
 * The 3 independent, pure date comparisons behind "Newly started"/"Newly completed"/"Newly
 * dated" (see spec/007-secondary-improvements/filter-changed-and-blocked). Each compares the same
 * raw start/due dates at two points in time — `today` and `when` (the Compare-to period's
 * timestamp) — with no reconstruction of a prior-period status category. Fails closed (all
 * `false`) when there's no prior period to compare against.
 */
export function calculateNewlyFlags(
  current: { start?: Date | null; due?: Date | null },
  lastPeriod: { start?: Date | null; due?: Date | null } | null | undefined,
  when: Date,
  today: Date = new Date(),
): NewlyFlags {
  if (!lastPeriod) {
    return { newlyStarted: false, newlyCompleted: false, newlyDated: false };
  }

  const hasCurrentStart = current.start != null;
  const hasCurrentDue = current.due != null;
  const hadPriorStart = lastPeriod.start != null;
  const hadPriorDue = lastPeriod.due != null;

  // Newly started: has a start date on/before today, but as of `when` it had none or hadn't
  // arrived yet.
  const startedByToday = hasCurrentStart && current.start!.getTime() <= today.getTime();
  const startedByWhen = hadPriorStart && lastPeriod.start!.getTime() <= when.getTime();
  const newlyStarted = startedByToday && !startedByWhen;

  // Newly completed: has a due date on/before today, but as of `when` it hadn't passed yet —
  // mirrors the existing "due date passed -> complete" rule in `timedStatus`, evaluated twice.
  const dueByToday = hasCurrentDue && current.due!.getTime() <= today.getTime();
  const dueByWhen = hadPriorDue && lastPeriod.due!.getTime() <= when.getTime();
  const newlyCompleted = dueByToday && !dueByWhen;

  // Newly dated: had no start/due at all as of `when`, but has one now.
  const hadNoDatesAtWhen = !hadPriorStart && !hadPriorDue;
  const hasDatesNow = hasCurrentStart || hasCurrentDue;
  const newlyDated = hadNoDatesAtWhen && hasDatesNow;

  return { newlyStarted, newlyCompleted, newlyDated };
}

// The children "workTypeRollups" won't be right ...
// this is really a "rollup" type thing ...
// I think "workTypeRollups" probably shouldn't have children if we are only using it here ...
export function calculateReportStatuses<
  T extends WithDateRollup &
    WithWorkTypeRollups &
    WithBlockedStatuses &
    WithWarningIssues &
    WithIssueLastPeriod<WithDateRollup & WithWorkTypeRollups>,
>(issues: IssueOrRelease<T>[], when: Date): IssueOrRelease<T & WithRollupStatus>[] {
  const getIssuesByKeys = makeGetIssuesByKeys(issues);

  return issues.map((issue) => {
    return {
      ...issue,
      rollupStatuses: calculateStatuses(issue, getIssuesByKeys, when),
    };
  });
}

function makeGetIssuesByKeys<T>(issues: IssueOrRelease<T>[]) {
  const map = new Map<string, IssueOrRelease<T>>();
  for (const issue of issues) {
    map.set(issue.key, issue);
  }
  return function getIssuesByKeys(issueKeys: string[]) {
    return issueKeys.map((key) => map.get(key)).filter(notEmpty);
  };
}

function calculateStatuses<
  T extends WithDateRollup &
    WithWorkTypeRollups &
    WithBlockedStatuses &
    WithWarningIssues &
    WithIssueLastPeriod<WithDateRollup & WithWorkTypeRollups>,
  U extends IssueOrRelease & WithBlockedStatuses,
>(issueWithPriorTiming: IssueOrRelease<T>, getIssuesByKeys: (keys: string[]) => U[], when: Date) {
  const timingData = prepareTimingData(issueWithPriorTiming);

  const isIssue = isDerivedIssue(issueWithPriorTiming);
  const childKeys = getAllWorkTypeRollupChildIssueKeys();

  // do the rollup
  if (isIssue && issueWithPriorTiming.statusCategory === 'Done') {
    timingData.rollup.status = 'complete';
    timingData.rollup.statusFrom = { message: 'Own status' };
  } else if (
    // we should check all the children ...
    isIssue &&
    childKeys.length &&
    getIssuesByKeys(childKeys).every((issue) => isDerivedIssue(issue) && issue.statusCategory === 'Done')
  ) {
    timingData.rollup.status = 'complete';
    timingData.rollup.statusFrom = {
      message: 'Children are all done, but the parent is not',
      warning: true,
    };
  } else if (isIssue && issueWithPriorTiming?.blockedStatusIssues?.length) {
    timingData.rollup.status = 'blocked';
    timingData.rollup.statusFrom = { message: 'This or a child is in a blocked status' };
  } else if (isIssue && issueWithPriorTiming?.warningIssues?.length) {
    timingData.rollup.status = 'warning';
    timingData.rollup.statusFrom = { message: 'This or a child is in a warning status' };
  } else {
    Object.assign(timingData.rollup, timedStatus(timingData.rollup));
  }

  // Blocked/Warning/Complete are plain, always-current-state values above. Newly started/
  // completed/dated are independent of which of those branches ran, so they're computed here
  // unconditionally, straight off the same rollup start/due + lastPeriod already prepared above.
  Object.assign(
    timingData.rollup,
    calculateNewlyFlags(
      { start: timingData.rollup.start, due: timingData.rollup.due },
      timingData.rollup.lastPeriod,
      when,
    ),
  );

  // do all the others
  for (let workCategory of workTypes) {
    if (timingData[workCategory]) {
      setWorkTypeStatus(timingData[workCategory], getIssuesByKeys);
    }
  }

  return timingData;

  function getAllWorkTypeRollupChildIssueKeys(): string[] {
    return workTypes.flatMap((workType) => issueWithPriorTiming.workTypeRollups.children[workType]?.issueKeys ?? []);
  }
}

function prepareTimingData<
  T extends WithDateRollup & WithWorkTypeRollups & WithIssueLastPeriod<WithDateRollup & WithWorkTypeRollups>,
>(issueWithPriorTiming: IssueOrRelease<T>): TimingData {
  const isIssue = isDerivedIssue(issueWithPriorTiming);
  const issueLastPeriod = isIssue && issueWithPriorTiming.issueLastPeriod;
  const timingData: TimingData = {
    rollup: {
      ...issueWithPriorTiming.rollupDates,
      lastPeriod: issueLastPeriod ? issueLastPeriod.rollupDates : null,
    },
  };
  const children = issueWithPriorTiming.workTypeRollups.children;
  const self = issueWithPriorTiming.workTypeRollups.self;
  // If an issue has NO child work-type breakdown at all (e.g. a `QA: ...` epic whose stories
  // aren't themselves broken down by dev/qa/uat), fall back to the issue's own work type so it
  // still renders a single timing bar in its proper lane instead of showing nothing.
  const hasChildWorkTypeBreakdown = workTypes.some((workType) => (children[workType]?.issueKeys?.length ?? 0) > 0);
  const useSelfFallback = !hasChildWorkTypeBreakdown;
  for (let workType of workTypes) {
    const workRollup = children[workType] ?? (useSelfFallback ? self?.[workType] : undefined);
    if (workRollup) {
      // When we fall back to the issue's own (self) rollup for the current period, we must also
      // read last period from self — otherwise the empty `children` last period leaves the bar
      // without prior timing, which `timedStatus` reports as "new".
      const lastPeriodWorkTypeRollups = issueLastPeriod ? issueLastPeriod.workTypeRollups : null;
      const lastPeriod = lastPeriodWorkTypeRollups
        ? (lastPeriodWorkTypeRollups.children[workType] ??
          (useSelfFallback ? lastPeriodWorkTypeRollups.self?.[workType] : undefined) ??
          null)
        : null;
      timingData[workType] = {
        ...workRollup,
        lastPeriod,
      };
    } else {
      timingData[workType] = {
        issueKeys: [],
      };
    }
  }
  return timingData;
}

function setWorkTypeStatus<T extends IssueOrRelease & WithBlockedStatuses>(
  timingData: DatesIssueKeysLastPeriodAndStatus,
  getIssuesByKeys: (keys: string[]) => T[],
) {
  // compare the parent status ... could be before design, after UAT and we should warn
  // what about blocked on any child?

  // if everything is complete, complete

  if (
    timingData?.issueKeys?.length &&
    getIssuesByKeys(timingData.issueKeys).every((issue) => isDerivedIssue(issue) && issue.statusCategory === 'Done')
  ) {
    timingData.status = 'complete';
    timingData.statusFrom = { message: 'Everything is done' };
  } else if (
    timingData.issueKeys &&
    getIssuesByKeys(timingData.issueKeys).some((issue) => issue?.blockedStatusIssues?.length)
  ) {
    timingData.status = 'blocked';
    timingData.statusFrom = { message: 'This or a child is in a blocked status' };
  } else {
    Object.assign(timingData, timedStatus(timingData));
  }
}

function timedStatus(timedRecord: DatesIssueKeysLastPeriodAndStatus): PeriodStatus {
  if (timedRecord.due == null) {
    return { status: 'unknown', statusFrom: { message: 'there is no timing data' } };
  }
  // if now is after the complete date
  // we force complete ... however, we probably want to warn if this isn't in the
  // completed state
  else if (roundDateByRoundToParam.end(timedRecord.due) < new Date()) {
    return {
      status: 'complete',
      statusFrom: { message: 'Issue is in the past, but not marked as done', warning: true },
    };
  } else if (
    timedRecord.lastPeriod?.due &&
    roundDateByRoundToParam.end(timedRecord.due) > roundDateByRoundToParam.end(timedRecord.lastPeriod.due)
  ) {
    return {
      status: 'behind',
      statusFrom: { message: 'This was due earlier last period', warning: true },
    };
  } else if (
    timedRecord.lastPeriod?.due &&
    roundDateByRoundToParam.end(timedRecord.due) < roundDateByRoundToParam.end(timedRecord.lastPeriod.due)
  ) {
    return { status: 'ahead', statusFrom: { message: 'Ahead of schedule compared to last time' } };
  } else if (!timedRecord.lastPeriod) {
    return { status: 'new', statusFrom: { message: 'Unable to find this last period' } };
  }

  if (timedRecord.start && timedRecord.start > new Date()) {
    return { status: 'notstarted', statusFrom: { message: 'This has not started yet' } };
  } else {
    return { status: 'ontrack', statusFrom: { message: "This hasn't changed time yet" } };
  }
}
