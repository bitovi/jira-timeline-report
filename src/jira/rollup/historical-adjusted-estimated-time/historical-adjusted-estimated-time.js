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
  // get the average estimated work per day per team
  const teamAverageEstimatedPointsPerDay = getTeamAverageEstimatedPointPerDay(groupedHierarchy[1]);
  const totalDaysPerTeam = {};

  // Then go through and make "adjustment" based on this
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
    // if everything is estimated ...
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
  const isDone = dueDate && dueDate < new Date();
  //const isDone = parentIssueOrRelease.statusCategory === "Done" || parentIssueOrRelease.statusCategory === "In Progress";
  const storyPointsIsNotZero = parentIssueOrRelease.derivedTiming.deterministicTotalDaysOfWork > 0;
  return hasSomeEstimates && hasDates && isDone && storyPointsIsNotZero && startedInThePast;
}

function addEstimatedAndActualOnTeam(teamData, parentIssueOrRelease) {
  if (!metadata[parentIssueOrRelease.team.name]) {
    metadata[parentIssueOrRelease.team.name] = [];
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

// Returns a map of "dateStrings" to total amount of estimated work for that day
// { "2025-05-02": 0.3, "2025-05-02": 0.5 }
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

export function actualVSEstimated(issues) {
  const historicIssues = issues.filter(issueWasEstimatedDatedAndCompleted);
  historicIssues.map((issue) => {
    return {
      startDate: issue.startDate,
      dueDate: epic.dueDate,
      totalDaysOfWork: issue.derivedTiming.totalDaysOfWork,
      deterministicTotalDaysOfWork: issue.derivedTiming.deterministicTotalDaysOfWork,
      key: issue.key,
      issue: issue,
      density: issue.derivedTiming.deterministicTotalDaysOfWork / issue.derivedTiming.totalDaysOfWork,
    };
  });
  // to determine actual amount of work for each epic ...
  // we need to lay out every epic for that team ... and then consume work for that epic based on
  // its density
}

// this returns the amount of estimated points a team gets done per day
export function getTeamHistoricalEpicData(epics) {
  const teamsData = {};
  for (const epic of epics) {
    let teamData;
    if (!teamsData[epic.team.name]) {
      teamData = teamsData[epic.team.name] = {
        historicIssues: [],
        compareData: [],
        ignoredIssues: [],
        theoreticalMean: undefined,
        pointsPerDay: new Map(),
      };
    } else {
      teamData = teamsData[epic.team.name];
    }
    if (issueWasEstimatedDatedAndCompleted(epic)) {
      teamData.historicIssues.push(epic);
      teamData.compareData.push({
        startDate: epic.startDate,
        dueDate: epic.dueDate,
        totalDaysOfWork: epic.derivedTiming.datesDaysOfWork,
        deterministicTotalDaysOfWork: epic.derivedTiming.deterministicTotalDaysOfWork,
        key: epic.key,
        issue: epic,
      });
    } else {
      teamData.ignoredIssues.push(epic);
    }
  }

  Object.keys(teamsData).forEach((teamName) => {
    const data = teamsData[teamName].compareData;
    // for each team, calculate how much "estimated" work it does on every day
    let pointsPerDay = estimatePointsPerDay(data);
    if (pointsPerDay.size >= 1) {
      const values = [...pointsPerDay.values()];
      const confInt = logNormalAverageConfidenceInterval(values);
      // find the log-normal "mean" of how much work it does each day
      teamsData[teamName].theoreticalMean = confInt.theoreticalMean;
      teamsData[teamName].pointsPerDay = pointsPerDay;
    }
  });

  // for each epic, find how much time it would actually take given how much estimated work it does each day
  /*let values = epicsToUseAsBaseline.map((epic) => {
    let value = epic.derivedTiming.deterministicTotalDaysOfWork / teamAverageEstimatedPointsPerDay[epic.team.name];
    return value;
  });*/

  return teamsData;
}

function getTeamAverageEstimatedPointPerDay(epics) {
  // get only completed, estimated and dated work
  const epicsToUseAsBaseline = epics.filter(issueWasEstimatedDatedAndCompleted);

  // will be a mapping of team name to an array of each epic's:
  // startDate, dueDate, totalDaysOfWork, deterministicTotalDaysOfWork, key and issue
  const metadata = {
    completedEstimatedVSActualForTeam: {},
  };

  epicsToUseAsBaseline.forEach((epic) => {
    addEstimatedAndActualForTeam(metadata, epic);
  });

  // a mapping of average mount of estimated work per day for each team
  // {"TEAMFOO": 1.2}
  // we could do this for different types ...
  const teamAverageEstimatedPointsPerDay = {},
    teamDailyValues = {};

  Object.keys(metadata.completedEstimatedVSActualForTeam).forEach((teamName) => {
    const data = metadata.completedEstimatedVSActualForTeam[teamName];
    // for each team, calculate how much "estimated" work it does on every day
    let pointsPerDay = estimatePointsPerDay(data);
    if (pointsPerDay.size >= 1) {
      const values = [...pointsPerDay.values()];
      const confInt = logNormalAverageConfidenceInterval(values);
      // find the log-normal "mean" of how much work it does each day
      teamAverageEstimatedPointsPerDay[teamName] = confInt.theoreticalMean;
      teamDailyValues[teamName] = pointsPerDay;
      //return {team: teamName, count: data.length, moe: confInt.marginOfError, mean: confInt.theoreticalMean}
    }
  });

  // for each epic, find how much time it would actually take given how much estimated work it does each day
  let values = epicsToUseAsBaseline.map((epic) => {
    let value = epic.derivedTiming.deterministicTotalDaysOfWork / teamAverageEstimatedPointsPerDay[epic.team.name];
    return value;
  });

  // across all epics, how much time on average "should" it take to get done
  // I don't understand why I'm calculating this
  const averageEpicDaysOfTeamCapacity = jStat.mean(values);
  console.log('estiamted baseline data', {
    baselineEpics: epicsToUseAsBaseline,
    baselineEpicsCapacities: values,
    averageEpicDaysOfTeamCapacity,
    teamAverageEstimatedPointsPerDay,
    teamDailyValues,
  });

  /// for some default team, we can know how much
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
  // adjust the estimate time
  let estimatedPointsPerDay = teamAverageEstimatedPointsPerDay[parentIssueOrRelease.team.name];
  if (parentIssueOrRelease.derivedTiming.isStoryPointsMedianValid && estimatedPointsPerDay != null) {
    let adjusted = parentIssueOrRelease.derivedTiming.deterministicTotalDaysOfWork / estimatedPointsPerDay;
    return {
      historicalAdjustedEstimatedTime: adjusted,
      userSpecifiedValues: true,
    };
  } else {
    // if we don't have an estimate or "story points", then just use the average points per day ...
    // this doesn't actually make sense ... it should be the average total "adjusted" tie
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
