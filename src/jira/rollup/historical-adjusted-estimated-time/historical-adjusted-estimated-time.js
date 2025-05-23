import { rollupGroupedHierarchy, groupIssuesByHierarchyLevelOrType, zipRollupDataOntoGroupedData } from '../rollup';
import { jStat } from 'jstat';
import { defineFeatureFlag } from '../../../shared/feature-flag';

export const FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES = defineFeatureFlag(
  'historicallyAdjustedEstimates',
  `

    Log historically adjusted estimates and other data
    
`,
  false,
);

export function addHistoricalAdjustedEstimatedTime(issuesOrReleases, rollupTimingLevelsAndCalculations) {
  const groupedIssues = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTimingLevelsAndCalculations);
  const rollupMethods = rollupTimingLevelsAndCalculations.map((rollupData) => rollupData.calculation).reverse();
  const rolledUpHistoricalAdjustedEstimates = rollupHistoricalAdjustedEstimatedTime(groupedIssues, rollupMethods);
  const zipped = zipRollupDataOntoGroupedData(
    groupedIssues,
    rolledUpHistoricalAdjustedEstimates,
    'historicalAdjustedEstimatedTime',
  );
  return zipped.flat();
}

/**
 *
 * @param {Array<import("../rollup").IssuesOrReleases>} issuesOrReleases Starting from low to high
 * @param {Array<String>} methodNames Starting from low to high
 * @return {Array<Object>}
 */
export function rollupHistoricalAdjustedEstimatedTime(groupedHierarchy, methodNames, { getChildren } = {}) {
  const teamAverageEstimatedPointsPerDay = getTeamAverageEstimatedPointPerDay(groupedHierarchy[1]);
  const totalDaysPerTeam = {};

  return rollupGroupedHierarchy(groupedHierarchy, {
    createMetadataForHierarchyLevel(hierarchyLevel) {
      return {
        hierarchyLevel,
        // how long stuff actually took
        // {TEAM: [{start, due, estimatedDays, timedDays}]
        baselineMockData: [],
        needsMockData: [],
      };
    },
    finalizeMetadataForHierarchyLevel(metadata, rollupData) {
      const mockData = createMockDataFromBaseline(metadata.baselineMockData);
      metadata.needsMockData.forEach((needsMock) => {
        needsMock.splice(0, 0, ...mockData);
      });
    },
    createRollupDataFromParentAndChild(issueOrRelease, children, hierarchyLevel, metadata) {
      return childrenFirstThenParentTeamAdjustment(
        issueOrRelease,
        children,
        hierarchyLevel,
        metadata,
        teamAverageEstimatedPointsPerDay,
        totalDaysPerTeam,
      );
    },
  });
}

function emptyRollup(teamName) {
  return {
    teamName,
    completedWorkingDays: 0,
    totalWorkingDays: 0,
    userSpecifiedValues: false,
    get remainingWorkingDays() {
      return this.totalWorkingDays - this.completedWorkingDays;
    },
  };
}

function sumChildRollups(children) {
  const userSpecifiedValues = children.every((d) => d.userSpecifiedValues);
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

export function childrenOnly(parentIssueOrRelease, childrenRollups) {
  return mergeStartAndDueData(childrenRollups);
}

export function parentOnly(parentIssueOrRelease, childrenRollups) {
  return {
    ...getStartData(parentIssueOrRelease.derivedTiming),
    ...getDueData(parentIssueOrRelease.derivedTiming),
  };
}

// {}

export function childrenFirstThenParentTeamAdjustment(
  parentIssueOrRelease,
  childrenRollups,
  hierarchyLevel,
  metadata,
  teamAverageEstimatedPointsPerDay,
  totalDaysPerTeam,
) {
  let data = [];
  if (hierarchyLevel === 0) {
    return {};
  } else if (hierarchyLevel === 1) {
    return [
      {
        teamName: parentIssueOrRelease.team.name,
        ...calculateHistoricalAdjustedEstimatedTimeForEpic(parentIssueOrRelease, teamAverageEstimatedPointsPerDay),
      },
    ];
  } else {
    // if everything is estiamted ...
    if (childrenRollups.length) {
      let allChildren = childrenRollups.flat();

      data = mergeTeamData(allChildren);

      if (allChildren.every((d) => d.userSpecifiedValues)) {
        metadata.baselineMockData.push(data);
      }
      data.url = parentIssueOrRelease.url;
      return data;
    } else {
      metadata.needsMockData.push(data);
      data.url = parentIssueOrRelease.url;
      return data;
    }
  }
}

function sum(arr) {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}
function average(arr) {
  return arr.length > 0 ? sum(arr) / arr.length : undefined;
}

function issueWasEstimatedDatedAndCompleted(parentIssueOrRelease) {
  const hasSomeEstimates =
    parentIssueOrRelease.derivedTiming.isStoryPointsMedianValid ||
    parentIssueOrRelease.derivedTiming.isStoryPointsValid;
  const startDate = parentIssueOrRelease.startDate,
    dueDate = parentIssueOrRelease.dueDate;
  const hasDates = startDate && dueDate;
  const startedInThePast = startDate && startDate < new Date();
  const isDone =
    parentIssueOrRelease.statusCategory === 'Done' || parentIssueOrRelease.statusCategory === 'In Progress';
  const storyPointsIsNotZero = parentIssueOrRelease.derivedTiming.deterministicTotalDaysOfWork > 0;
  return hasSomeEstimates && hasDates && isDone & storyPointsIsNotZero && startedInThePast;
}

function addEstimatedAndActualForTeam(metadata, parentIssueOrRelease) {
  if (!metadata.completedEstimatedVSActualForTeam[parentIssueOrRelease.team.name]) {
    metadata.completedEstimatedVSActualForTeam[parentIssueOrRelease.team.name] = [];
  }
  const compareDataForTeam = metadata.completedEstimatedVSActualForTeam[parentIssueOrRelease.team.name];
  const startDate = parentIssueOrRelease.startDate,
    dueDate = parentIssueOrRelease.dueDate;

  compareDataForTeam.push({
    startDate,
    dueDate,
    totalDaysOfWork: parentIssueOrRelease.derivedTiming.totalDaysOfWork,
    deterministicTotalDaysOfWork: parentIssueOrRelease.derivedTiming.deterministicTotalDaysOfWork,
    key: parentIssueOrRelease.key,
    issue: parentIssueOrRelease,
  });
}

function toISODateString(date) {
  return date.toISOString().slice(0, 10);
}

function estimatePointsPerDay(ranges) {
  const businessDays = new Map(); // Use a Set to ensure unique business days

  ranges.forEach(({ startDate, dueDate, deterministicTotalDaysOfWork, totalDaysOfWork }) => {
    if (!startDate || !dueDate) {
      return;
    }
    let estimatePointsPerDay = deterministicTotalDaysOfWork / totalDaysOfWork;
    let current = new Date(startDate);

    while (current <= dueDate) {
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday

      // Only add weekdays (Monday to Friday)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        let dateString = toISODateString(current),
          currentPoints = businessDays.get(dateString);

        businessDays.set(
          dateString,
          typeof currentPoints === 'number' ? currentPoints + estimatePointsPerDay : estimatePointsPerDay,
        );
      }

      // Move to the next day
      current.setDate(current.getDate() + 1);
    }
  });

  return businessDays; // Return the total number of unique business days
}

function logNormalMedianConfidenceInterval(values) {
  const logValues = values.map(Math.log);

  // 4. Calculate mean and standard deviation of log-transformed data
  const meanLog = jStat.mean(logValues);
  const stdDevLog = jStat.stdev(logValues, true); // Use `true` for sample std deviation
  const n = values.length;

  // 5. Define the Z-score for a 90% confidence level
  const zScore = jStat.normal.inv(0.95, 0, 1); // 1.645 for 90% CI

  // 6. Calculate the margin of error
  const marginOfError = zScore * (stdDevLog / Math.sqrt(n));

  // 7. Calculate the confidence interval in the log-space
  const lowerLog = meanLog - marginOfError;
  const upperLog = meanLog + marginOfError;

  // 8. Convert the confidence interval back to the original scale
  const lowerBound = Math.exp(lowerLog);
  const upperBound = Math.exp(upperLog);
  return {
    stdDevLog,
    meanLog,
    lowerBound,
    upperBound,
  };
}

function logNormalAverageConfidenceInterval(values) {
  const logValues = values.map(Math.log);

  // 4. Calculate mean and standard deviation of log-transformed data
  const meanLog = jStat.mean(logValues);
  const stdDevLog = jStat.stdev(logValues, true); // Use `true` for sample std deviation
  const n = values.length;
  const varianceLog = stdDevLog ** 2;

  // 5. Define the Z-score for a 90% confidence level
  const zScore = jStat.normal.inv(0.95, 0, 1); // 1.645 for 90% CI

  // 6. Calculate the mean of the original (untransformed) data
  const meanOriginal = Math.exp(meanLog + varianceLog / 2);

  // 7. Calculate the confidence interval for the mean on the original scale
  const lowerBound = Math.exp(meanLog + varianceLog / 2 - zScore * (stdDevLog / Math.sqrt(n)));
  const upperBound = Math.exp(meanLog + varianceLog / 2 + zScore * (stdDevLog / Math.sqrt(n)));

  return {
    stdDevLog,
    meanLog,
    lowerBound,
    upperBound,
    theoreticalMean: meanOriginal,
    marginOfError: upperBound - meanOriginal,
  };
}

function getTeamAverageEstimatedPointPerDay(epics) {
  const epicsToUseAsBaseline = epics.filter(issueWasEstimatedDatedAndCompleted);
  const metadata = { completedEstimatedVSActualForTeam: {} };
  epicsToUseAsBaseline.forEach((epic) => {
    addEstimatedAndActualForTeam(metadata, epic);
  });
  const teamAverageEstimatedPointsPerDay = {};
  Object.keys(metadata.completedEstimatedVSActualForTeam).forEach((teamName) => {
    const data = metadata.completedEstimatedVSActualForTeam[teamName];
    let pointsPerDay = estimatePointsPerDay(data);
    if (pointsPerDay.size >= 1) {
      const values = [...pointsPerDay.values()];
      const confInt = logNormalAverageConfidenceInterval(values);
      teamAverageEstimatedPointsPerDay[teamName] = confInt.theoreticalMean;
      //return {team: teamName, count: data.length, moe: confInt.marginOfError, mean: confInt.theoreticalMean}
    }
  });

  let values = epicsToUseAsBaseline.map((epic) => {
    let value = epic.derivedTiming.deterministicTotalDaysOfWork / teamAverageEstimatedPointsPerDay[epic.team.name];
    return value;
  });
  const averageEpicDaysOfTeamCapacity = jStat.mean(values);
  console.log({
    baselineEpics: epicsToUseAsBaseline,
    baselineEpicsCapacities: values,
    averageEpicDaysOfTeamCapacity,
    teamAverageEstimatedPointsPerDay,
  });

  teamAverageEstimatedPointsPerDay.DEFAULT = averageEpicDaysOfTeamCapacity;
  // calculate the average amount of work for an epic ...
  // When all teams estimate, how much of total team time does the average epic take?
  return teamAverageEstimatedPointsPerDay;
}
/**
 *
 * HistoricalAdjustedEstimatedTime is what the estimates should be to account for how many "epic points" of work the
 * team actually gets done on average.
 *
 * For example, if a team actually gets twices as many epic points done per day as they estimate, we will take an estimate
 * and divide that by 2.  This is how much team capacity in time it will actually take up.
 */
function calculateHistoricalAdjustedEstimatedTimeForEpic(parentIssueOrRelease, teamAverageEstimatedPointsPerDay) {
  let estimatedPointsPerDay = teamAverageEstimatedPointsPerDay[parentIssueOrRelease.team.name];
  if (parentIssueOrRelease.derivedTiming.isStoryPointsMedianValid && estimatedPointsPerDay != null) {
    let adjusted = parentIssueOrRelease.derivedTiming.deterministicTotalDaysOfWork / estimatedPointsPerDay;
    return {
      historicalAdjustedEstimatedTime: adjusted,
      userSpecifiedValues: true,
    };
  } else {
    return {
      historicalAdjustedEstimatedTime: teamAverageEstimatedPointsPerDay.DEFAULT,
      userSpecifiedValues: false,
    };
  }
}

// Takes all initiatives and creates an "average" weight of each team's need
function createMockDataFromBaseline(baselineInitiatives) {
  // some have HUGE
  let allChildren = baselineInitiatives.flat();
  const allMerged = mergeTeamData(allChildren);
  return allMerged.map((teamData) => {
    const copy = { ...teamData, userSpecifiedValues: false };
    copy.historicalAdjustedEstimatedTime = copy.historicalAdjustedEstimatedTime / baselineInitiatives.length;
    return copy;
  });
}

function mergeTeamData(epics) {
  let teamData = {};

  for (let epic of epics) {
    if (!teamData[epic.teamName]) {
      teamData[epic.teamName] = {
        userSpecifiedValues: true,
        historicalAdjustedEstimatedTime: 0,
        teamName: epic.teamName,
      };
    }
    teamData[epic.teamName].historicalAdjustedEstimatedTime += epic.historicalAdjustedEstimatedTime;
    teamData[epic.teamName].userSpecifiedValues =
      teamData[epic.teamName].userSpecifiedValues && epic.userSpecifiedValues;
  }

  return Object.values(teamData);
}
