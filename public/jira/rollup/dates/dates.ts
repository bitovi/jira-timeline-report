import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedRelease,
} from "../rollup";
import { selectDue, selectStart, descSortByDue, sortByStart } from "../../shared/helpers";
import { RollupLevelAndCalculation } from "../../shared/types";
import { DueData, StartData } from "../../../shared/issue-data/date-data";

const methods = {
  parentFirstThenChildren,
  childrenOnly,
  childrenFirstThenParent,
  widestRange,
  parentOnly,
};
export type DateCalculations = keyof typeof methods;

export type RollupDateData = Partial<StartData & DueData>;

export type WithDateRollup = {
  rollupDates: RollupDateData;
};

const getStartData = (d: Partial<StartData> | null) => {
  if (!d) return {};

  const { start, startFrom } = d;

  return {
    ...(start && { start }),
    ...(startFrom && { startFrom }),
  };
};
const getDueData = (d: Partial<DueData> | null) => {
  if (!d) return {};

  const { due, dueTo } = d;

  return {
    ...(due && { due }),
    ...(dueTo && { dueTo }),
  };
};

export function addRollupDates(
  issuesOrReleases: IssueOrRelease<WithDateRollup>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation<DateCalculations>[]
) {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );
  const rollupMethods = rollupTimingLevelsAndCalculations
    .map((rollupData) => rollupData.calculation)
    .reverse();
  const rolledUpDates = rollupDates(groupedIssues, rollupMethods);
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, "rollupDates");
  return zipped.flat();
}

/**
 *
 * @param issuesOrReleases Starting from low to high
 * @param methodNames 
 * @return 
 */
export function rollupDates(groupedHierarchy: IssueOrRelease<WithDateRollup>[][], methodNames: DateCalculations[]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children: RollupDateData[], hierarchyLevel) {
      const methodName = methodNames[hierarchyLevel] || "childrenFirstThenParent";
      const method = methods[methodName];
      const result = method(issueOrRelease, children);
      return result;
    },
  });
}

export function mergeStartAndDueData(records: RollupDateData[]) {
  const startDataSortAsc: Partial<StartData>[] = records
    .filter(selectStart)
    .map(getStartData)
    .sort(sortByStart);
  const dueDataSortDesc: Partial<DueData>[] = records
    .filter(selectDue)
    .map(getDueData)
    .sort(descSortByDue);

  const firstStart = startDataSortAsc.length ? startDataSortAsc[0] : {};
  const lastDue = dueDataSortDesc.length ? dueDataSortDesc[0] : {};

  return {
    ...firstStart,
    ...lastDue,
  };
}

export function parentFirstThenChildren(
  parentIssueOrRelease: IssueOrRelease<WithDateRollup>,
  childrenRollups: RollupDateData[]
) {
  if (isDerivedRelease(parentIssueOrRelease)) return {};

  const { derivedTiming: parentDerivedTiming } = parentIssueOrRelease;
  const childData = mergeStartAndDueData(childrenRollups);

  const parentHasStart = parentDerivedTiming?.start;
  const parentHasDue = parentDerivedTiming?.due;

  const combinedData = {
    start: parentHasStart ? parentDerivedTiming?.start : childData?.start,
    startFrom: parentHasStart ? parentDerivedTiming?.startFrom : childData?.startFrom,
    due: parentHasDue ? parentDerivedTiming?.due : childData?.due,
    dueTo: parentHasDue ? parentDerivedTiming?.dueTo : childData?.dueTo,
  };

  return {
    ...getStartData(combinedData),
    ...getDueData(combinedData),
  };
}

export function childrenOnly(
  _parentIssueOrRelease: IssueOrRelease<WithDateRollup>,
  childrenRollups: RollupDateData[]
) {
  return mergeStartAndDueData(childrenRollups);
}

export function parentOnly(
  parentIssueOrRelease: IssueOrRelease<WithDateRollup>,
  _childrenRollups: RollupDateData[]
) {
  if (isDerivedRelease(parentIssueOrRelease)) return {};

  const { derivedTiming: parentDerivedTiming } = parentIssueOrRelease;

  return {
    ...getStartData(parentDerivedTiming),
    ...getDueData(parentDerivedTiming),
  };
}

export function childrenFirstThenParent(
  parentIssueOrRelease: IssueOrRelease<WithDateRollup>,
  childrenRollups: RollupDateData[]
) {
  if (isDerivedRelease(parentIssueOrRelease)) return {};

  const { derivedTiming: parentDerivedTiming } = parentIssueOrRelease;

  if (childrenRollups.length) {
    return mergeStartAndDueData(childrenRollups);
  }
  return mergeStartAndDueData([parentDerivedTiming]);
}

export function widestRange(
  parentIssueOrRelease: IssueOrRelease<WithDateRollup>,
  childrenRollups: RollupDateData[]
) {
  if (isDerivedRelease(parentIssueOrRelease)) return {};

  const { derivedTiming: parentDerivedTiming } = parentIssueOrRelease;

  return mergeStartAndDueData([parentDerivedTiming, ...childrenRollups]);
}

export const calculationKeysToNames = {
  parentFirstThenChildren: function (parent: IssueOrRelease<WithDateRollup>, child: { plural: string }) {
    return `From ${parent.type}, then ${child.plural}`;
  },
  childrenOnly: function (_parent: IssueOrRelease<WithDateRollup>, child: { plural: string }) {
    return `From ${child.plural}`;
  },
  childrenFirstThenParent: function (parent: IssueOrRelease<WithDateRollup>, child: { plural: string }) {
    return `From ${child.plural}, then ${parent.type}`;
  },
  widestRange: function (parent: IssueOrRelease<WithDateRollup>, child: { plural: string }) {
    return `From ${parent.type} or ${child.plural} (earliest to latest)`;
  },
  parentOnly: function (parent: IssueOrRelease<WithDateRollup>, _child: { plural: string }) {
    return `From ${parent.type}`;
  },
};
