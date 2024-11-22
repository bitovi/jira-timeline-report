import { workType as workTypes } from "../../derived/work-status/work-status"; // ["design","dev","qa","uat"]
import { WithIssueLastPeriod } from "../../rolledup-and-rolledback/rollup-and-rollback";
import { WithBlockedStatuses } from "../../rollup/blocked-status-issues/blocked-status-issues";
import { WithDateRollup } from "../../rollup/dates/dates";
import { isDerivedIssue, IssueOrRelease } from "../../rollup/rollup";
import { WithWarningIssues } from "../../rollup/warning-issues/warning-issues";
import { notEmpty } from "../../shared/helpers";
import { DateAndIssueKeys, WithWorkTypeRollups } from "../work-type/work-type";

const workTypeWithChildren = ["children", ...workTypes] as const;
const WIGGLE_ROOM = 0;

type PeriodStatus = {
  status?: string;
  statusFrom?: { message: string; warning?: boolean };
};

type DatesIssueKeysLastPeriodAndStatus = Partial<DateAndIssueKeys> & {
  lastPeriod?: Partial<DateAndIssueKeys> | null;
} & PeriodStatus;

type TimingData = {
  [key in (typeof workTypeWithChildren)[number]]?: DatesIssueKeysLastPeriodAndStatus;
} & { rollup: DatesIssueKeysLastPeriodAndStatus };

export type WithRollupStatus = { rollupStatuses: TimingData };

// The children "workTypeRollups" won't be right ...
// this is really a "rollup" type thing ...
// I think "workTypeRollups" probably shouldn't have children if we are only using it here ...
export function calculateReportStatuses<
  T extends WithDateRollup &
    WithWorkTypeRollups &
    WithBlockedStatuses &
    WithWarningIssues &
    WithIssueLastPeriod<WithDateRollup & WithWorkTypeRollups>
>(issues: IssueOrRelease<T>[]): IssueOrRelease<T & WithRollupStatus>[] {
  const getIssuesByKeys = makeGetIssuesByKeys(issues);

  return issues.map((issue) => {
    return {
      ...issue,
      rollupStatuses: calculateStatuses(issue, getIssuesByKeys),
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
  U extends IssueOrRelease & WithBlockedStatuses
>(issueWithPriorTiming: IssueOrRelease<T>, getIssuesByKeys: (keys: string[]) => U[]) {
  const timingData = prepareTimingData(issueWithPriorTiming);

  const isIssue = isDerivedIssue(issueWithPriorTiming);

  // do the rollup
  if (isIssue && issueWithPriorTiming.statusCategory === "done") {
    timingData.rollup.status = "complete";
    timingData.rollup.statusFrom = { message: "Own status" };
  } else if (
    // we should check all the children ...
    isIssue &&
    getIssuesByKeys(getAllWorkTypeRollupChildIssueKeys()).every(
      (issue) => isDerivedIssue(issue) && issue.statusCategory === "done"
    )
  ) {
    timingData.rollup.status = "complete";
    timingData.rollup.statusFrom = {
      message: "Children are all done, but the parent is not",
      warning: true,
    };
  } else if (isIssue && issueWithPriorTiming.blockedStatusIssues.length) {
    timingData.rollup.status = "blocked";
    timingData.rollup.statusFrom = { message: "This or a child is in a blocked status" };
  } else if (isIssue && issueWithPriorTiming.warningIssues.length) {
    timingData.rollup.status = "warning";
    timingData.rollup.statusFrom = { message: "This or a child is in a warning status" };
  } else {
    Object.assign(timingData.rollup, timedStatus(timingData.rollup));
  }
  // do all the others
  for (let workCategory of workTypes) {
    if (timingData[workCategory]) {
      setWorkTypeStatus(timingData[workCategory], getIssuesByKeys);
    }
  }

  return timingData;

  function getAllWorkTypeRollupChildIssueKeys(): string[] {
    return workTypes.flatMap(
      (x) => issueWithPriorTiming.workTypeRollups.children[x]?.issueKeys ?? []
    );
  }
}

function prepareTimingData<
  T extends WithDateRollup &
    WithWorkTypeRollups &
    WithIssueLastPeriod<WithDateRollup & WithWorkTypeRollups>
>(issueWithPriorTiming: IssueOrRelease<T>): TimingData {
  const isIssue = isDerivedIssue(issueWithPriorTiming);
  const issueLastPeriod = isIssue && issueWithPriorTiming.issueLastPeriod;
  const timingData: TimingData = {
    rollup: {
      ...issueWithPriorTiming.rollupDates,
      lastPeriod: issueLastPeriod ? issueLastPeriod.rollupDates : null,
    },
  };
  for (let workType of workTypes) {
    const workRollup = issueWithPriorTiming.workTypeRollups.children[workType];
    if (workRollup) {
      timingData[workType] = {
        ...workRollup,
        lastPeriod: issueLastPeriod ? issueLastPeriod.workTypeRollups.children[workType] : null,
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
  getIssuesByKeys: (keys: string[]) => T[]
) {
  // compare the parent status ... could be before design, after UAT and we should warn
  // what about blocked on any child?

  // if everything is complete, complete

  if (
    timingData?.issueKeys?.length &&
    getIssuesByKeys(timingData.issueKeys).every(
      (issue) => isDerivedIssue(issue) && issue.statusCategory === "done"
    )
  ) {
    timingData.status = "complete";
    timingData.statusFrom = { message: "Everything is done" };
  } else if (
    timingData.issueKeys &&
    getIssuesByKeys(timingData.issueKeys).some((issue) => issue.blockedStatusIssues.length)
  ) {
    timingData.status = "blocked";
    timingData.statusFrom = { message: "This or a child is in a blocked status" };
  } else {
    Object.assign(timingData, timedStatus(timingData));
  }
}

function timedStatus(timedRecord: DatesIssueKeysLastPeriodAndStatus): PeriodStatus {
  if (!timedRecord.due) {
    return { status: "unknown", statusFrom: { message: "there is no timing data" } };
  }
  // if now is after the complete date
  // we force complete ... however, we probably want to warn if this isn't in the
  // completed state
  else if (timedRecord.due < new Date()) {
    return {
      status: "complete",
      statusFrom: { message: "Issue is in the past, but not marked as done", warning: true },
    };
  } else if (
    timedRecord.lastPeriod?.due &&
    +timedRecord.due > WIGGLE_ROOM + +timedRecord.lastPeriod.due
  ) {
    return {
      status: "behind",
      statusFrom: { message: "This was due earlier last period", warning: true },
    };
  } else if (
    timedRecord.lastPeriod?.due &&
    +timedRecord.due + WIGGLE_ROOM < +timedRecord.lastPeriod.due
  ) {
    return { status: "ahead", statusFrom: { message: "Ahead of schedule compared to last time" } };
  } else if (!timedRecord.lastPeriod) {
    return { status: "new", statusFrom: { message: "Unable to find this last period" } };
  }

  if (timedRecord.start && timedRecord.start > new Date()) {
    return { status: "notstarted", statusFrom: { message: "This has not started yet" } };
  } else {
    return { status: "ontrack", statusFrom: { message: "This hasn't changed time yet" } };
  }
}
