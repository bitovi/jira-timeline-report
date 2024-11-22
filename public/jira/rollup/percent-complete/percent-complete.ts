import { RollupLevelAndCalculation } from "../../shared/types";
import {
  rollupGroupedHierarchy,
  groupIssuesByHierarchyLevelOrType,
  zipRollupDataOntoGroupedData,
  IssueOrRelease,
  isDerivedIssue,
} from "../rollup";

// const BASE_HIERARCHY_LEVEL = 1;

export type PercentCompleteMeta = {
  /** how many children on average */
  childCounts: number[];
  totalDays: number;
  /** an array of the total of the number of days of work. Used to calculate the average */
  totalDaysOfWorkForAverage: number[];
  /** which items need their average set after the average is calculated */
  needsAverageSet: PercentCompleteRollup[];
  /** this will be set later */
  averageTotalDays: number;
  averageChildCount: number;
};

export type PercentCompleteRollup = {
  userSpecifiedValues: boolean;
  totalWorkingDays: number;
  completedWorkingDays: number;
  readonly remainingWorkingDays: number;
};

export type WithPercentComplete = {
  completionRollup: PercentCompleteRollup;
};

const methods = {
  childrenFirstThenParent,
};
export type PercentCompleteCalculations = keyof typeof methods;

function sum(arr: number[]) {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}
function average(arr: number[]) {
  return arr.length > 0 ? sum(arr) / arr.length : 0;
}

export function addPercentComplete<T>(
  issuesOrReleases: IssueOrRelease<T>[],
  rollupTimingLevelsAndCalculations: RollupLevelAndCalculation[]
): IssueOrRelease<T & WithPercentComplete>[] {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTimingLevelsAndCalculations
  );

  // const rollupMethods = rollupTimingLevelsAndCalculations
  //   .map((rollupData) => rollupData.calculation)
  //   .reverse();
  const rolledUpDates = rollupPercentComplete(groupedIssues);
  const zipped = zipRollupDataOntoGroupedData(groupedIssues, rolledUpDates, (item, values) => ({
    ...item,
    completionRollup: values,
  }));
  return zipped.flat();
}

/**
 *
 * @param issuesOrReleases Starting from low to high
 * @return rollup response for percent complete
 */
export function rollupPercentComplete<T>(groupedHierarchy: IssueOrRelease<T>[][]) {
  return rollupGroupedHierarchy(groupedHierarchy, {
    // have to specify the return type on this func so it knows what type the arrays are
    createMetadataForHierarchyLevel(): PercentCompleteMeta {
      return {
        // how many children on average
        childCounts: [],
        totalDays: 0,

        // an array of the total of the number of days of work. Used to calculate the average
        totalDaysOfWorkForAverage: [],
        // which items need their average set after the average is calculated
        needsAverageSet: [],
        // this will be set later
        averageTotalDays: 0,
        averageChildCount: 0,
        // issues: [],
      };
    },
    createRollupDataFromParentAndChild(
      issueOrRelease,
      children: PercentCompleteRollup[],
      hierarchyLevel,
      metadata
    ) {
      const methodName = /*methodNames[hierarchyLevel] ||*/ "childrenFirstThenParent";
      const method = methods[methodName];
      return method(issueOrRelease, children, hierarchyLevel, metadata);
    },
    finalizeMetadataForHierarchyLevel(metadata) {
      let ave = average(metadata.totalDaysOfWorkForAverage) || 30;
      metadata.averageTotalDays = ave;

      //metadata.averageChildCount = average( metadata.childCounts )
      // set average on children that need it
      metadata.needsAverageSet.forEach((data) => {
        data.totalWorkingDays = ave;
      });
    },
  });
}

function emptyRollup() {
  return {
    completedWorkingDays: 0,
    totalWorkingDays: 0,
    userSpecifiedValues: false,
    get remainingWorkingDays() {
      return this.totalWorkingDays - this.completedWorkingDays;
    },
  };
}

export function childrenFirstThenParent<T>(
  parentIssueOrRelease: IssueOrRelease<T>,
  childrenRollups: PercentCompleteRollup[],
  _hierarchyLevel: number,
  metadata: PercentCompleteMeta
) {
  let data;
  // if there is hard child data, use it
  if (childrenRollups.length && childrenRollups.every((d) => d.userSpecifiedValues)) {
    data = sumChildRollups(childrenRollups);
    metadata.totalDaysOfWorkForAverage.push(data.totalWorkingDays);
    return data;
  }
  // if there is hard parent data, use it
  else if (
    isDerivedIssue(parentIssueOrRelease) &&
    parentIssueOrRelease?.derivedTiming?.totalDaysOfWork
  ) {
    data = {
      completedWorkingDays: parentIssueOrRelease?.derivedTiming.completedDaysOfWork,
      totalWorkingDays: parentIssueOrRelease?.derivedTiming.totalDaysOfWork,
      userSpecifiedValues: true,
      get remainingWorkingDays() {
        return this.totalWorkingDays - this.completedWorkingDays;
      },
    };
    // make sure we can build an average from it
    metadata.totalDaysOfWorkForAverage.push(data.totalWorkingDays);
    return data;
  }

  // if there is weak children data, use it, but don't use it for other averages
  else if (childrenRollups.length) {
    data = sumChildRollups(childrenRollups);
    return data;
  }
  // if there are no children, add to get the uncertainty
  else {
    data = emptyRollup();
    metadata.needsAverageSet.push(data);
    return data;
  }
}

export function sumChildRollups(children: PercentCompleteRollup[]) {
  const userSpecifiedValues = children.every((child) => child.userSpecifiedValues);
  const totalDays = children.map((child) => child.totalWorkingDays);
  const completedDays = children.map((child) => child.completedWorkingDays);

  return {
    completedWorkingDays: sum(completedDays),
    totalWorkingDays: sum(totalDays),
    userSpecifiedValues: userSpecifiedValues,
    get remainingWorkingDays() {
      return this.totalWorkingDays - this.completedWorkingDays;
    },
  };
}
