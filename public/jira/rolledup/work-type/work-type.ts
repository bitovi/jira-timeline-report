import {
  makeGetChildrenFromReportingIssues,
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  ReportingHierarchyIssueOrRelease,
  isDerivedIssue,
  isDerivedRelease,
} from "../../rollup/rollup";
import {
  DateCalculations,
  getStartAndDueData,
  mergeStartAndDueData,
  WithDateRollup,
} from "../../rollup/dates/dates";
import {
  workType as workTypes,
  WorkType,
  DerivedWorkStatus,
} from "../../derived/work-status/work-status";
import { RollupLevelAndCalculation } from "../../shared/types";
import { StartData, DueData } from "../../../shared/issue-data/date-data";
import { DerivedWorkTiming } from "../../derived/work-timing/work-timing";

// TODO:

// this is more like "derived" from "rollup"

// given some "rolled up" dates ....

// Go to each item ... get it's children ... filter by work status type ...
// add those as children ...

export type DateAndIssueKeys = StartData &
  DueData & {
    issueKeys: string[];
  };

export type WorkTypeRollups = {
  [key in WorkType]?: Partial<DateAndIssueKeys>;
};

export type WithChildren = {
  children?: Partial<DateAndIssueKeys>;
};

export type WithWorkTypeTiming = WithDateRollup & {
  workTypeRollups: WorkTypeRollups & WithChildren;
};

export type WorkTypeChildRollups = {
  self: WorkTypeRollups;
  combined: WorkTypeRollups;
  children: WorkTypeRollups;
};

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

/**
 * Children are now recursive
 * @param issuesAndReleases
 * @return
 */

function rollupDatesByWorkType(
  issuesAndReleases: ReportingHierarchyIssueOrRelease<IssueOrRelease<WithWorkTypeTiming>>[]
) {
  // lets make the copies b/c we are going to mutate ...
  const copies = issuesAndReleases.map((issue) => {
    return { ...issue }; //Object.create(issue);
  });

  // we probably don't want to assign "issues" if we want to keep things functional ...
  const getChildren = makeGetChildrenFromReportingIssues(copies);

  for (let issue of copies) {
    issue.workTypeRollups = getWorkTypeTimings(issue, getChildren);
  }
  return copies;
}

/**
 *
 * @param {import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue} issue
 * @param {function(import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue): Array<import("../../rollup/dates/dates").RolledupDatesReleaseOrIssue>} getChildren
 */
export function getWorkTypeTimings(
  issue: ReportingHierarchyIssueOrRelease<IssueOrRelease<WithWorkTypeTiming>>,
  getChildren: (
    issue: ReportingHierarchyIssueOrRelease<IssueOrRelease<WithWorkTypeTiming>>
  ) => ReportingHierarchyIssueOrRelease<IssueOrRelease<WithWorkTypeTiming>>[]
) {
  const children = getChildren(issue).filter(isDerivedIssue);
  const groupedByWorkType = Object.entries(
    Object.groupBy(children, (child) => child.derivedStatus.workType)
  );
  const dateRangeRollups: WorkTypeRollups & WithChildren = Object.fromEntries(
    groupedByWorkType.map(([type, issues]) => [
      type as keyof (WorkTypeRollups & WithChildren),
      {
        ...mergeStartAndDueData(issues.map((issue) => issue.rollupDates)),
        issueKeys: issues.map((issue) => issue.key),
      },
    ])
  );

  return dateRangeRollups;
}

export function addWorkTypeDates(
  issuesOrReleases: IssueOrRelease<{}>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation<DateCalculations>[]
) {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );
  // const rollupMethods = rollupTimingLevelsAndCalculations
  //   .map((rollupData) => rollupData.calculation)
  //   .reverse();
  const rolledUpDates = rollupWorkTypeDates(groupedIssues);
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, "workTypeRollups");
  return zipped.flat();
}

/**
 *
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupWorkTypeDates(groupedHierarchy: IssueOrRelease<{}>[][]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children: WorkTypeChildRollups[]) {
      //const methodName = methodNames[hierarchyLevel] || "childrenFirstThenParent";
      const method = mergeParentAndChildIfTheyHaveDates; //methods[methodName];
      return method(issueOrRelease, children);
    },
  });
}

function parentInfo(parent: IssueOrRelease<{}>) {
  if (isDerivedRelease(parent))
    return {
      key: parent.key,
      hasStartAndDue: false,
      derivedStatus: null,
      derivedTiming: null,
    };

  const { key, derivedStatus, derivedTiming } = parent;
  const hasStartAndDue = !!derivedTiming?.start && !!derivedTiming?.due;

  return { key, hasStartAndDue, derivedStatus, derivedTiming };
}

function getSelf({
  key,
  hasStartAndDue,
  derivedStatus,
  derivedTiming,
}: {
  key: string;
  hasStartAndDue: boolean;
  derivedStatus: DerivedWorkStatus | null;
  derivedTiming: DerivedWorkTiming | null;
}): WorkTypeRollups {
  if (!derivedStatus?.workType) return {};

  const result =
    derivedTiming && hasStartAndDue
      ? {
          ...getStartAndDueData(derivedTiming),
          issueKeys: [key],
        }
      : {};

  return {
    [derivedStatus?.workType]: result,
  };
}

export function mergeParentAndChildIfTheyHaveDates(
  parentIssueOrRelease: IssueOrRelease<{}>,
  childRollups: WorkTypeChildRollups[]
) {
  const parent = parentInfo(parentIssueOrRelease);
  const self = getSelf(parent);

  if (!childRollups.length) {
    return { self, combined: self, children: {} };
  }

  const children: WorkTypeRollups = {};
  const combined: WorkTypeRollups = {};

  for (let workType of workTypes) {
    // combine for children
    const rollupForWorkType = childRollups
      .map((childRollup) => childRollup.combined?.[workType])
      .filter(notEmpty);

    // if the children have something for this type
    if (rollupForWorkType.length) {
      const issues = new Set(
        rollupForWorkType
          .map((r) => r.issueKeys)
          .flat(1)
          .filter(notEmpty)
      );

      const workTypeDates = {
        ...mergeStartAndDueData(rollupForWorkType),
        issueKeys: [...issues],
      };
      children[workType] = workTypeDates;

      // what if the parent has it also
      if (parent.hasStartAndDue && parent.derivedStatus?.workType === workType) {
        const combinedDates = {
          ...mergeStartAndDueData([workTypeDates, getStartAndDueData(parent.derivedTiming)]),
          issueKeys: [...new Set([...issues, parentIssueOrRelease.key])],
        };
        combined[workType] = combinedDates;
      } else {
        combined[workType] = workTypeDates;
      }
    }
    // what if the parent has it
    else if (parent.hasStartAndDue && parent.derivedStatus?.workType === workType) {
      combined[workType] = self[workType];
    }
  }
  return { self, combined, children };
}
