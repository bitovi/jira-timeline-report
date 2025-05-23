import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedRelease,
} from '../rollup';
import { selectDue, selectStart, descSortByDue, sortByStart } from '../../shared/helpers';
import { CalculationType, RollupLevelAndCalculation } from '../../shared/types';
import { DueData, StartData } from '../../../shared/issue-data/date-data';

const methods = {
  parentFirstThenChildren,
  childrenOnly,
  childrenFirstThenParent,
  widestRange,
  parentOnly,
};

export type RollupDateData = Partial<StartData & DueData>;

export type WithDateRollup = {
  rollupDates: RollupDateData;
};

export const getStartData = (d: Partial<StartData> | null) => {
  if (!d) return {};

  const { start, startFrom } = d;

  return {
    ...(start && { start }),
    ...(startFrom && { startFrom }),
  };
};
export const getDueData = (d: Partial<DueData> | null) => {
  if (!d) return {};

  const { due, dueTo } = d;

  return {
    ...(due && { due }),
    ...(dueTo && { dueTo }),
  };
};
export const getStartAndDueData = (d: RollupDateData | null) => {
  return {
    ...getStartData(d),
    ...getDueData(d),
  };
};

export function addRollupDates<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[],
): IssueOrRelease<T & WithDateRollup>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
  const rollupMethods = rollupTimingLevelsAndCalculations.map((rollupData) => rollupData.calculation).reverse();
  const rolledUpDates = rollupDates(groupedIssues, rollupMethods);
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, (item, values) => ({
    ...item,
    rollupDates: values,
  }));
  return zipped.flat();
}

/**
 *
 * @param issuesOrReleases Starting from low to high
 * @param methodNames
 * @return
 */
export function rollupDates<T>(groupedHierarchy: IssueOrRelease<T>[][], methodNames: CalculationType[]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    createRollupDataFromParentAndChild(issueOrRelease, children: RollupDateData[], hierarchyLevel) {
      const methodName = methodNames[hierarchyLevel] || 'childrenFirstThenParent';
      const method = methods[methodName];
      const result = method(issueOrRelease, children);
      return result;
    },
  });
}

export function mergeStartAndDueData<T extends RollupDateData>(records: T[]) {
  const startDataSortAsc: Partial<StartData>[] = records.filter(selectStart).map(getStartData).sort(sortByStart);
  const dueDataSortDesc: Partial<DueData>[] = records.filter(selectDue).map(getDueData).sort(descSortByDue);

  const firstStart = startDataSortAsc.length ? startDataSortAsc[0] : {};
  const lastDue = dueDataSortDesc.length ? dueDataSortDesc[0] : {};

  return {
    ...firstStart,
    ...lastDue,
  };
}

export function parentFirstThenChildren<T>(parentIssueOrRelease: IssueOrRelease<T>, childrenRollups: RollupDateData[]) {
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

  return getStartAndDueData(combinedData);
}

export function childrenOnly<T>(_parentIssueOrRelease: IssueOrRelease<T>, childrenRollups: RollupDateData[]) {
  return mergeStartAndDueData(childrenRollups);
}

export function parentOnly<T>(parentIssueOrRelease: IssueOrRelease<T>, _childrenRollups: RollupDateData[]) {
  if (isDerivedRelease(parentIssueOrRelease)) return {};

  const { derivedTiming: parentDerivedTiming } = parentIssueOrRelease;

  return getStartAndDueData(parentDerivedTiming);
}

export function childrenFirstThenParent<T>(parentIssueOrRelease: IssueOrRelease<T>, childrenRollups: RollupDateData[]) {
  if (isDerivedRelease(parentIssueOrRelease)) return {};

  const { derivedTiming: parentDerivedTiming } = parentIssueOrRelease;

  if (childrenRollups.length) {
    return mergeStartAndDueData(childrenRollups);
  }
  return mergeStartAndDueData([parentDerivedTiming]);
}

export function widestRange<T>(parentIssueOrRelease: IssueOrRelease<T>, childrenRollups: RollupDateData[]) {
  if (isDerivedRelease(parentIssueOrRelease)) return {};

  const { derivedTiming: parentDerivedTiming } = parentIssueOrRelease;

  return mergeStartAndDueData([parentDerivedTiming, ...childrenRollups]);
}

export const calculationKeysToNames = {
  parentFirstThenChildren: function <T>(parent: IssueOrRelease<T & WithDateRollup>, child: { plural: string }) {
    return `From ${parent.type}, then ${child.plural}`;
  },
  childrenOnly: function <T>(_parent: IssueOrRelease<T & WithDateRollup>, child: { plural: string }) {
    return `From ${child.plural}`;
  },
  childrenFirstThenParent: function <T>(parent: IssueOrRelease<T & WithDateRollup>, child: { plural: string }) {
    return `From ${child.plural}, then ${parent.type}`;
  },
  widestRange: function <T>(parent: IssueOrRelease<T & WithDateRollup>, child: { plural: string }) {
    return `From ${parent.type} or ${child.plural} (earliest to latest)`;
  },
  parentOnly: function <T>(parent: IssueOrRelease<T & WithDateRollup>, _child: { plural: string }) {
    return `From ${parent.type}`;
  },
};
