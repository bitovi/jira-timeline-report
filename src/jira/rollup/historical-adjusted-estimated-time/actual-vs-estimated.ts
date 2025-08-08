import type { DerivedIssue } from '../../derived/derive';
import { logNormalStats } from '../../../utils/math/log-normal';
import { businessDaysInclusive, toISODateString } from '../../../utils/date/business-days-inclusive';

export function issueWasEstimatedDatedAndCompleted(parentIssueOrRelease: DerivedIssue) {
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

export function derivedIssueToIssueTimingData(issue: DerivedIssue) {
  return {
    startDate: issue.startDate,
    dueDate: issue.dueDate,
    calendarDays: issue.derivedTiming.datesDaysOfWork,
    estimatedTeamDays: issue.derivedTiming.deterministicTotalDaysOfWork,
    key: issue.key,
    issue: issue,
    estimatedTeamDaysPerCalendarDay: issue.derivedTiming.totalDaysOfWork
      ? issue.derivedTiming.deterministicTotalDaysOfWork / (issue.derivedTiming.datesDaysOfWork || 0)
      : 0,
  };
}

export function getHistoricAndIgnored(issues: DerivedIssue[]) {
  const historic = [],
    ignored = [];
  for (const issue of issues) {
    if (issueWasEstimatedDatedAndCompleted(issue)) {
      historic.push(issue);
    } else {
      ignored.push(issue);
    }
  }
  return {
    historic: historic.map(derivedIssueToIssueTimingData),
    ignored: ignored,
  };
}

type IssueTiming = ReturnType<typeof derivedIssueToIssueTimingData>;

export type ComputedIssueTiming = IssueTiming & {
  computedActualTeamDaysOfWork: number;
  computedActualDaysOfWorkPerEstimatedTeamDays: number;
};

// given all data, returns team data
export function getTeamTimingData(issues: DerivedIssue[]) {
  const groupedTeams = groupByTeam(issues);

  return Object.values(groupedTeams).map((issues) => {
    // filter out historic vs ignored
    const { historic, ignored } = getHistoricAndIgnored(issues);

    // {"2001-10-20": [issueTimings...]}
    const businessDaysToIssueTimings = timingDataForEachBusinessDay(historic);

    const computedActualDaysOfWork = computeActualDaysOfWorkForTeam(historic, businessDaysToIssueTimings);

    const computedIssueTimings = historic.map((issueTiming, i) => {
      return {
        ...issueTiming,
        computedActualTeamDaysOfWork: computedActualDaysOfWork[i],
        computedActualDaysOfWorkPerEstimatedTeamDays: computedActualDaysOfWork[i] / issueTiming.estimatedTeamDays,
      };
    });

    return {
      team: issues[0].team.name,
      ignoredIssues: ignored,
      computedIssueTimings,
      businessDaysToIssueTimings,
      issueCount: computedIssueTimings.length,
      ...getTeamActualVsEstimatedStats(computedIssueTimings),
    };
  });
}

export type TeamTimings = ReturnType<typeof getTeamTimingData>;

function getTeamActualVsEstimatedStats(computedIssueTimings: ComputedIssueTiming[]) {
  const ratios = computedIssueTimings.map(
    (computedIssueTiming) => computedIssueTiming.computedActualDaysOfWorkPerEstimatedTeamDays,
  );
  if (ratios.length > 0) {
    const { mean, median, variance } = logNormalStats(ratios);
    return { mean, median, variance };
  } else {
    return { mean: NaN, median: NaN, variance: NaN };
  }
}

export function computeActualDaysOfWorkForTeam(
  issueTimings: IssueTiming[],
  businessDaysToIssueTimings: ReturnType<typeof timingDataForEachBusinessDay> | undefined,
) {
  if (!businessDaysToIssueTimings) {
    businessDaysToIssueTimings = timingDataForEachBusinessDay(issueTimings);
  }

  const issueEfforts: Record<string, number> = {};

  // for each business day, calculate the overall
  for (const [day, issueTimingsForDay] of businessDaysToIssueTimings) {
    // share the density
    const totalDensity = issueTimingsForDay.reduce((sum, issue) => sum + issue.estimatedTeamDaysPerCalendarDay, 0);
    if (totalDensity === 0) continue;

    for (const issue of issueTimingsForDay) {
      const share = issue.estimatedTeamDaysPerCalendarDay / totalDensity;
      if (!issueEfforts[issue.key]) {
        issueEfforts[issue.key] = 0;
      }
      issueEfforts[issue.key] += share;
    }
  }
  return issueTimings.map((issue) => issueEfforts[issue.key] ?? 0);
}

/*
export function computeActualEffort(issues: IssueTiming[]): ComputedIssueTiming[] {
    
    const dateToTeamIssues: Record<string, Record<string, IssueTiming[]>> = {};
    const issueEfforts: Record<string, number> = {};
  
    // group everything by date then by team
    for (const issue of issues) {
      issueEfforts[issue.key] = 0;
      const current = new Date(issue.startDate);
      const end = new Date(issue.dueDate);
  
      while (current <= end) {
        const day = current.getDay();
        const isWeekend = day === 0 || day === 6;
        if (!isWeekend) {
          const dateStr = current.toISOString().split("T")[0];
          const team = issue.issue.team.name;
  
          if (!dateToTeamIssues[dateStr]) {
            dateToTeamIssues[dateStr] = {};
          }
          if (!dateToTeamIssues[dateStr][team]) {
            dateToTeamIssues[dateStr][team] = [];
          }
  
          dateToTeamIssues[dateStr][team].push(issue);
        }
        current.setDate(current.getDate() + 1);
      }
    }
  
    // for each date and the teams for a date ...
    for (const teamMap of Object.values(dateToTeamIssues)) {
      for (const issuesForTeam of Object.values(teamMap)) {
        // share the density
        const totalDensity = issuesForTeam.reduce((sum, issue) => sum + issue.estimatedTeamDaysPerCalendarDay, 0);
        if (totalDensity === 0) continue;
  
        for (const issue of issuesForTeam) {
          const share = issue.estimatedTeamDaysPerCalendarDay / totalDensity;
          issueEfforts[issue.key] += share;
        }
      }
    }
  
    return issues.map((issue) => ({
      ...issue,
      computedActualDaysOfWork: issueEfforts[issue.key] ?? 0,
    }));
}*/

export function groupByTeam<T extends { team: { name: string } }>(issues: T[]): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const item of issues) {
    const teamName = item.team.name;

    if (!grouped[teamName]) {
      grouped[teamName] = [];
    }

    grouped[teamName].push(item);
  }

  return grouped;
}

export function timingDataForEachBusinessDay(issues: IssueTiming[]) {
  const businessDays = new Map<string, IssueTiming[]>();
  // foo
  issues.forEach((issue) => {
    const { startDate, dueDate, estimatedTeamDaysPerCalendarDay: density } = issue;
    const start = new Date(startDate);
    const end = new Date(dueDate);
    for (const current of businessDaysInclusive(startDate, dueDate)) {
      const dateString = toISODateString(current);
      let currentArray = businessDays.get(dateString);
      if (!currentArray) {
        currentArray = [];
        businessDays.set(dateString, currentArray);
      }
      currentArray.push(issue);
    }
  });

  return businessDays;
}
