import { DueData, StartData } from "../../../shared/issue-data/date-data";
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  RollupResponse,
  ReportingHierarchyIssueOrRelease,
} from "../rollup";
import {
  selectDue,
  selectStart,
  sortByDue,
  sortByStart,
} from "../../shared/helpers";
import { DerivedIssue } from "../../derived/derive";

const methods = {
  parentFirstThenChildren,
  childrenOnly,
  childrenFirstThenParent,
  widestRange,
  parentOnly,
};
export type CalculationName = keyof typeof methods;

export type RollupDateData = Partial<StartData & DueData>;

export type RolledupDatesReleaseOrIssue = IssueOrRelease<DerivedIssue> & {
  rollupDates: RollupDateData;
};

const getStartData = (d: Partial<StartData> | null) => {
  if(!d)return {}
  
  const {start,startFrom}=d

  return ({
    ...(start && { start }),
    ...(startFrom && { startFrom }),
  });
};
const getDueData = (d: Partial<DueData> | null) => {
  if(!d)return {}
  
  const {due,dueTo}=d

  return ({
    ...(due && { due }),
    ...(dueTo && { dueTo }),
  });
};

/**
 *
 * @param {Array<IssueOrRelease>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupDates<_CustomFields, Meta>(
  groupedHierarchy: DerivedIssue[][],
  methodNames: CalculationName[]
): RollupResponse<RollupDateData, Meta> {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(
      issueOrRelease: ReportingHierarchyIssueOrRelease<DerivedIssue>,
      children: RollupDateData[],
      hierarchyLevel
    ) {
      const methodName =
        methodNames[hierarchyLevel] || "childrenFirstThenParent";
      const method = methods[methodName];
      const result = method(issueOrRelease, children);
      return result;
    },
  });
}

/**
 *
 * @param {Array<IssueOrRelease>} issuesOrReleases
 * @param {Array<{type: String, hierarchyLevel: Number, calculation: String}>} rollupTimingLevelsAndCalculations
 * @return {Array<RolledupDatesReleaseOrIssue>}
 */
export function addRollupDates(
  issuesOrReleases: DerivedIssue[],
  rollupTimingLevelsAndCalculations: {
    type: string;
    hierarchyLevel: number;
    calculation: CalculationName;
  }[]
) {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );
  const rollupMethods = rollupTimingLevelsAndCalculations
    .map((rollupData) => rollupData.calculation)
    .reverse();
  const rolledUpDates = rollupDates(groupedIssues, rollupMethods);
  const zipped = zipRollupDataOntoGroupedData(
    groupedIssues,
    rolledUpDates,
    "rollupDates"
  );
  return zipped.flat();
}

export function mergeStartAndDueData<T extends Partial<StartData & DueData>>(
  records: T[]
) {
  const startData = records.filter(selectStart).map(getStartData);
  const dueData = records.filter(selectDue).map(getDueData);

  const sortedStart = startData.sort(sortByStart);
  const sortedDue = dueData.sort(sortByDue);

  const sd = startData.length ? sortedStart[0] : {};
  const ed = dueData.length ? sortedDue[0] : {};

  return {
    ...sd,
    ...ed,
  } as T;
}

/**
 *
 * @param {IssueOrRelease} parentIssueOrRelease
 * @param {*} childrenRollups
 * @returns
 */
export function parentFirstThenChildren(
  { derivedTiming: parentDerivedTiming }: DerivedIssue,
  childrenRollups: RollupDateData[]
): RollupDateData {
  const childData = mergeStartAndDueData(childrenRollups);

  const parentHasStart = parentDerivedTiming?.start;
  const parentHasDue = parentDerivedTiming?.due;

  const combinedData = {
    start: parentHasStart ? parentDerivedTiming?.start : childData?.start,
    startFrom: parentHasStart
      ? parentDerivedTiming?.startFrom
      : childData?.startFrom,
    due: parentHasDue ? parentDerivedTiming?.due : childData?.due,
    dueTo: parentHasDue ? parentDerivedTiming?.dueTo : childData?.dueTo,
  };

  return {
    ...getStartData(combinedData),
    ...getDueData(combinedData),
  };
}

export function childrenOnly(
  _parentIssueOrRelease: DerivedIssue,
  childrenRollups: RollupDateData[]
) {
  return mergeStartAndDueData(childrenRollups);
}

export function parentOnly(
  { derivedTiming: parentDerivedTiming }: DerivedIssue,
  _childrenRollups: RollupDateData[]
) {
  return {
    ...getStartData(parentDerivedTiming),
    ...getDueData(parentDerivedTiming),
  };
}

export function childrenFirstThenParent(
  { derivedTiming: parentDerivedTiming }: DerivedIssue,
  childrenRollups: RollupDateData[]
) {
  if (childrenRollups.length) {
    return mergeStartAndDueData(childrenRollups);
  }
  return mergeStartAndDueData([parentDerivedTiming]);
}

export function widestRange(
  { derivedTiming: parentDerivedTiming }: DerivedIssue,
  childrenRollups: RollupDateData[]
) {
  return mergeStartAndDueData([parentDerivedTiming, ...childrenRollups]);
}

export const calculationKeysToNames = {
  parentFirstThenChildren: function (
    parent: IssueOrRelease,
    child: { plural: string }
  ) {
    return `From ${parent.type}, then ${child.plural}`;
  },
  childrenOnly: function (_parent: IssueOrRelease, child: { plural: string }) {
    return `From ${child.plural}`;
  },
  childrenFirstThenParent: function (
    parent: IssueOrRelease,
    child: { plural: string }
  ) {
    return `From ${child.plural}, then ${parent.type}`;
  },
  widestRange: function (parent: IssueOrRelease, child: { plural: string }) {
    return `From ${parent.type} or ${child.plural} (earliest to latest)`;
  },
  parentOnly: function (parent: IssueOrRelease, _child: { plural: string }) {
    return `From ${parent.type}`;
  },
};
