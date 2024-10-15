import { DerivedIssue } from "../../derived/derive";
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
} from "../rollup";

const methods = {
  parentFirstThenChildren,
  childrenOnly,
  childrenFirstThenParent,
  widestRange,
  parentOnly,
};
export type CalculationName = keyof typeof methods; // <-- bonkers

/**
 *
 * @param {Array<IssueOrRelease>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<RollupDateData>}
 */
export function rollupDates(
  groupedHierarchy: IssueOrRelease[][],
  methodNames: CalculationName[]
) {
  return rollupGroupedHierarchy<{}, RollupDateData>(groupedHierarchy, {
    createRollupDataFromParentAndChild(
      issueOrRelease,
      children,
      hierarchyLevel,
      metadata
    ) {
      const methodName =
        methodNames[hierarchyLevel] || "childrenFirstThenParent";
      const method = methods[methodName];
      return method(issueOrRelease, children);
    },
  });
}

export type RollupDateData = {
  due: Date;
  dueTo: { message: string; reference: Object };
  start: Date;
  startFrom: { message: string; reference: Object };
};

export type RolledupDatesReleaseOrIssue = IssueOrRelease & {
  rollupDates: RollupDateData;
};

/**
 *
 * @param {Array<IssueOrRelease>} issuesOrReleases
 * @param {Array<{type: String, hierarchyLevel: Number, calculation: String}>} rollupTimingLevelsAndCalculations
 * @return {Array<RolledupDatesReleaseOrIssue>}
 */
export function addRollupDates(
  issuesOrReleases: IssueOrRelease[],
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

function makeQuickCopyDefinedProperties<
  TDest,
  TSrc extends { [K: string]: unknown } = {}
>(keys: string[]) {
  return function copy(source: TSrc) {
    const obj: { [K: string]: unknown } = {};
    for (let key of keys) {
      if (source[key] !== undefined) {
        obj[key] = source[key];
      }
    }
    return obj as TDest;
  };
}
// makes testing easier if we don't create a bunch of "undefined" properties
const getStartData = makeQuickCopyDefinedProperties<RollupDateData>([
  "start",
  "startFrom",
]);
const getDueData = makeQuickCopyDefinedProperties<RollupDateData>([
  "due",
  "dueTo",
]);

export function mergeStartAndDueData(records: RollupDateData[]) {
  const startData = records.filter((record) => record?.start).map(getStartData);
  const dueData = records.filter((record) => record?.due).map(getDueData);

  return {
    ...(startData.length
      ? startData.sort((d1, d2) => d1.start.getTime() - d2.start.getTime())[0]
      : {}),
    ...(dueData.length
      ? dueData.sort((d1, d2) => d2.due.getTime() - d1.due.getTime())[0]
      : {}),
  } as RollupDateData;
}

/**
 *
 * @param {IssueOrRelease} parentIssueOrRelease
 * @param {*} childrenRollups
 * @returns
 */
export function parentFirstThenChildren(
  parentIssueOrRelease: IssueOrRelease,
  childrenRollups: RollupDateData[]
) {
  const childData = mergeStartAndDueData(childrenRollups);
  const parentData = (parentIssueOrRelease as DerivedIssue).derivedTiming;

  const parentHasStart = parentData?.start;
  const parentHasDue = parentData?.due;

  const combinedData = {
    start: parentHasStart ? parentData?.start : childData?.start,
    startFrom: parentHasStart ? parentData?.startFrom : childData?.startFrom,
    due: parentHasDue ? parentData?.due : childData?.due,
    dueTo: parentHasDue ? parentData?.dueTo : childData?.dueTo,
  };

  return {
    ...getStartData(combinedData),
    ...getDueData(combinedData),
  } as RollupDateData;
}

export function childrenOnly(
  _parentIssueOrRelease: IssueOrRelease,
  childrenRollups: RollupDateData[]
) {
  return mergeStartAndDueData(childrenRollups);
}

export function parentOnly(
  parentIssueOrRelease: IssueOrRelease,
  childrenRollups: RollupDateData[]
) {
  const derived = parentIssueOrRelease as DerivedIssue;
  return {
    ...getStartData(derived.derivedTiming),
    ...getDueData(derived.derivedTiming),
  };
}

export function childrenFirstThenParent(
  parentIssueOrRelease: IssueOrRelease,
  childrenRollups: RollupDateData[]
) {
  if (childrenRollups.length) {
    return mergeStartAndDueData(childrenRollups);
  }
  return mergeStartAndDueData([
    (parentIssueOrRelease as DerivedIssue).derivedTiming as RollupDateData,
  ]);
}

export function widestRange(
  parentIssueOrRelease: IssueOrRelease,
  childrenRollups: RollupDateData[]
) {
  return mergeStartAndDueData([
    (parentIssueOrRelease as DerivedIssue).derivedTiming as RollupDateData,
    ...childrenRollups,
  ]);
}

export const calculationKeysToNames = {
  parentFirstThenChildren: function (
    parent: IssueOrRelease,
    child: { plural: string }
  ) {
    return `From ${parent.type}, then ${child.plural}`;
  },
  childrenOnly: function (parent: IssueOrRelease, child: { plural: string }) {
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
  parentOnly: function (parent: IssueOrRelease, child: { plural: string }) {
    return `From ${parent.type}`;
  },
};
