import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedRelease,
} from "../../rollup/rollup";
import { getStartAndDueData, mergeStartAndDueData } from "../../rollup/dates/dates";
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
  children: Partial<DateAndIssueKeys>;
};

export type WithWorkTypeTiming = {
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

export function addWorkTypeDates<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[]
): IssueOrRelease<T & WithWorkTypeTiming>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );
  // const rollupMethods = rollupTimingLevelsAndCalculations
  //   .map((rollupData) => rollupData.calculation)
  //   .reverse();
  const rolledUpDates = rollupWorkTypeDates(groupedIssues);
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, (item, values) => ({
    ...item,
    workTypeRollups: values,
  }));
  return zipped.flat();
}

/**
 *
 * @param issuesOrReleases Starting from low to high
 * @return rollup response with work types
 */
export function rollupWorkTypeDates<T>(groupedHierarchy: IssueOrRelease<T>[][]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children: WorkTypeChildRollups[]) {
      //const methodName = methodNames[hierarchyLevel] || "childrenFirstThenParent";
      const method = mergeParentAndChildIfTheyHaveDates; //methods[methodName];
      return method(issueOrRelease, children);
    },
  });
}

function parentInfo<T>(parent: IssueOrRelease<T>) {
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

export function mergeParentAndChildIfTheyHaveDates<T>(
  parentIssueOrRelease: IssueOrRelease<T>,
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
