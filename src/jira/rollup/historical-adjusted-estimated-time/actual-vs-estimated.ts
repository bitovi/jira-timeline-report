
import type { DerivedIssue } from "../../derived/derive";


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


export function derivedToTimingData(issue: DerivedIssue){

    return {
        startDate: issue.startDate,
        dueDate: issue.dueDate,
        totalDaysOfWork: issue.derivedTiming.datesDaysOfWork,
        deterministicTotalDaysOfWork: issue.derivedTiming.deterministicTotalDaysOfWork,
        key: issue.key,
        issue: issue,
        density: issue.derivedTiming.totalDaysOfWork ? 
            issue.derivedTiming.deterministicTotalDaysOfWork / issue.derivedTiming.totalDaysOfWork : 0
    }

}

type TimingData = ReturnType<typeof derivedToTimingData>

export type TimingDataWithComputedDays = TimingData & {
    computedDaysOfWork: number;
  };

export function computeActualEffort(issues: TimingData[]): TimingDataWithComputedDays[] {
    
    const dateToTeamIssues: Record<string, Record<string, TimingData[]>> = {};
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
        const totalDensity = issuesForTeam.reduce((sum, issue) => sum + issue.density, 0);
        if (totalDensity === 0) continue;
  
        for (const issue of issuesForTeam) {
          const share = issue.density / totalDensity;
          issueEfforts[issue.key] += share;
        }
      }
    }
  
    return issues.map((issue) => ({
      ...issue,
      computedDaysOfWork: issueEfforts[issue.key] ?? 0,
    }));
}


export function getComputedActualAndEstimatedEffort(issues: DerivedIssue[]){
    const historic = [], ignored = [];
    for(const issue of issues) {
        if(issueWasEstimatedDatedAndCompleted(issue)) {
            historic.push(issue);
        } else {
            ignored.push(issue);
        }
    }
    return {
        historic: computeActualEffort(historic.map(derivedToTimingData)),
        ignored: ignored
    }
}

