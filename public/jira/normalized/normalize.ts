import { parseDateIntoLocalTimezone } from "../../date-helpers";
import { JiraIssue, NormalizedIssue, ParentIssue } from "../shared/types";

import * as defaults from "./defaults";

type DefaultsToConfig<T> = {
  [K in keyof T as K extends `${infer FnName}Default` ? FnName : never]: T[K];
};

export type NormalizeIssueConfig = DefaultsToConfig<typeof defaults>;
export type NormalizeParentConfig = DefaultsToConfig<
  Pick<typeof defaults, "getSummaryDefault" | "getHierarchyLevelDefault" | "getTypeDefault" | "getIssueKeyDefault">
>;

export function normalizeParent(
  issue: ParentIssue,
  {
    getSummary = defaults.getSummaryDefault,
    getHierarchyLevel = defaults.getHierarchyLevelDefault,
    getType = defaults.getTypeDefault,
    getIssueKey = defaults.getIssueKeyDefault,
  }: Partial<NormalizeParentConfig> = {}
) {
  return {
    summary: getSummary(issue),
    hierarchyLevel: getHierarchyLevel(issue),
    type: getType(issue),
    key: getIssueKey(issue),
  };
}

export function normalizeIssue(
  issue: JiraIssue,
  {
    getIssueKey = defaults.getIssueKeyDefault,
    getParentKey = defaults.getParentKeyDefault,
    getConfidence = defaults.getConfidenceDefault,
    getDueDate = defaults.getDueDateDefault,
    getHierarchyLevel = defaults.getHierarchyLevelDefault,
    getStartDate = defaults.getStartDateDefault,
    getStoryPoints = defaults.getStoryPointsDefault,
    getStoryPointsMedian = defaults.getStoryPointsMedianDefault,
    getType = defaults.getTypeDefault,
    getTeamKey = defaults.getTeamKeyDefault,
    getUrl = defaults.getUrlDefault,
    getVelocity = defaults.getVelocityDefault,
    getDaysPerSprint = defaults.getDaysPerSprintDefault,
    getParallelWorkLimit = defaults.getParallelWorkLimitDefault,
    getSprints = defaults.getSprintsDefault,
    getStatus = defaults.getStatusDefault,
    getStatusCategory = defaults.getStatusCategoryDefault,
    getLabels = defaults.getLabelsDefault,
    getReleases = defaults.getReleasesDefault,
    getRank = defaults.getRankDefault,
    getSummary = defaults.getSummaryDefault,
    getTeamSpreadsEffortAcrossDates = defaults.getTeamSpreadsEffortAcrossDatesDefault,
  }: Partial<NormalizeIssueConfig> = {}
): NormalizedIssue {
  const teamName = getTeamKey(issue);

  const velocity = getVelocity(teamName);
  const daysPerSprint = getDaysPerSprint(teamName);
  const parallelWorkLimit = getParallelWorkLimit(teamName);

  const totalPointsPerDay = velocity / daysPerSprint;
  const pointsPerDayPerTrack = totalPointsPerDay / parallelWorkLimit;

  return {
    // .summary can come from a "parent"'s fields
    // TODO check what this was supposed to be flag^v
    summary: getSummary(issue),
    key: getIssueKey(issue),
    parentKey: getParentKey(issue),
    confidence: getConfidence(issue),
    dueDate: parseDateIntoLocalTimezone(getDueDate(issue)),
    hierarchyLevel: getHierarchyLevel(issue),
    startDate: parseDateIntoLocalTimezone(getStartDate(issue)),
    storyPoints: getStoryPoints(issue),
    storyPointsMedian: getStoryPointsMedian(issue),
    type: getType(issue),
    sprints: getSprints(issue),
    team: {
      name: teamName,
      velocity,
      daysPerSprint,
      parallelWorkLimit,
      totalPointsPerDay,
      pointsPerDayPerTrack,
      spreadEffortAcrossDates: getTeamSpreadsEffortAcrossDates(teamName),
    },
    url: getUrl(issue),
    status: getStatus(issue),
    statusCategory: getStatusCategory(issue),
    labels: getLabels(issue),
    releases: getReleases(issue),
    rank: getRank(issue),
    issue,
  };
}

export function allStatusesSorted(issues: { status: string }[]): string[] {
  const statuses = issues.map((issue) => issue.status);

  return [...new Set(statuses)].sort();
}

export function allReleasesSorted(issues: NormalizedIssue[]): string[] {
  const releases = issues.map((issue) => issue.releases.map((r) => r.name)).flat(1);

  return [...new Set(releases)].sort();
}
