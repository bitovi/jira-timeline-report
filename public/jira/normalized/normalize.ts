import { parseDateIntoLocalTimezone } from "../../date-helpers";
import { JiraIssue, NormalizedIssue, ParentIssue } from "../shared/types";

import * as defaults from "./defaults";

type DefaultsToConfig<T> = {
  [K in keyof T as K extends `${infer FnName}Default` ? FnName : never]: T[K];
};

export type NormalizeIssueConfig = DefaultsToConfig<typeof defaults>;
export type NormalizeParentConfig = DefaultsToConfig<
  Pick<typeof defaults, "getSummaryDefault" | "getHierarchyLevelDefault" | "getTypeDefault">
>;

export function normalizeParent(
  issue: ParentIssue,
  {
    getSummary = defaults.getSummaryDefault,
    getHierarchyLevel = defaults.getHierarchyLevelDefault,
    getType = defaults.getTypeDefault,
  }: Partial<NormalizeParentConfig> = {}
) {
  return {
    summary: getSummary(issue),
    hierarchyLevel: getHierarchyLevel(issue),
    type: getType(issue),
  };
}

export function normalizeIssue(issue: JiraIssue, options: Partial<NormalizeIssueConfig> = {}): NormalizedIssue {
  const optionsWithDefaults = {
    getIssueKey: defaults.getIssueKeyDefault,
    getParentKey: defaults.getParentKeyDefault,
    getConfidence: defaults.getConfidenceDefault,
    getDueDate: defaults.getDueDateDefault,
    getHierarchyLevel: defaults.getHierarchyLevelDefault,
    getStartDate: defaults.getStartDateDefault,
    getStoryPoints: defaults.getStoryPointsDefault,
    getStoryPointsMedian: defaults.getStoryPointsMedianDefault,
    getType: defaults.getTypeDefault,
    getTeamKey: defaults.getTeamKeyDefault,
    getUrl: defaults.getUrlDefault,
    getVelocity: defaults.getVelocityDefault,
    getDaysPerSprint: defaults.getDaysPerSprintDefault,
    getParallelWorkLimit: defaults.getParallelWorkLimitDefault,
    getSprints: defaults.getSprintsDefault,
    getStatus: defaults.getStatusDefault,
    getStatusCategory: defaults.getStatusCategoryDefault,
    getLabels: defaults.getLabelsDefault,
    getReleases: defaults.getReleasesDefault,
    getRank: defaults.getRankDefault,
    getSummary: defaults.getSummaryDefault,
    getTeamSpreadsEffortAcrossDates: defaults.getTeamSpreadsEffortAcrossDatesDefault,
    ...options,
  };

  const teamName = optionsWithDefaults.getTeamKey(issue);

  const velocity = optionsWithDefaults.getVelocity(issue, optionsWithDefaults);
  const daysPerSprint = optionsWithDefaults.getDaysPerSprint(teamName);
  const parallelWorkLimit = optionsWithDefaults.getParallelWorkLimit(teamName);

  const totalPointsPerDay = velocity / daysPerSprint;
  const pointsPerDayPerTrack = totalPointsPerDay / parallelWorkLimit;

  return {
    // .summary can come from a "parent"'s fields
    // TODO check what this was supposed to be flag^v
    summary: optionsWithDefaults.getSummary(issue),
    key: optionsWithDefaults.getIssueKey(issue),
    parentKey: optionsWithDefaults.getParentKey(issue),
    confidence: optionsWithDefaults.getConfidence(issue),
    dueDate: parseDateIntoLocalTimezone(optionsWithDefaults.getDueDate(issue)),
    hierarchyLevel: optionsWithDefaults.getHierarchyLevel(issue),
    startDate: parseDateIntoLocalTimezone(optionsWithDefaults.getStartDate(issue)),
    storyPoints: optionsWithDefaults.getStoryPoints(issue),
    storyPointsMedian: optionsWithDefaults.getStoryPointsMedian(issue),
    type: optionsWithDefaults.getType(issue),
    sprints: optionsWithDefaults.getSprints(issue),
    team: {
      name: teamName,
      velocity,
      daysPerSprint,
      parallelWorkLimit,
      totalPointsPerDay,
      pointsPerDayPerTrack,
      spreadEffortAcrossDates: optionsWithDefaults.getTeamSpreadsEffortAcrossDates(teamName),
    },
    url: optionsWithDefaults.getUrl(issue),
    status: optionsWithDefaults.getStatus(issue),
    statusCategory: optionsWithDefaults.getStatusCategory(issue),
    labels: optionsWithDefaults.getLabels(issue),
    releases: optionsWithDefaults.getReleases(issue),
    rank: optionsWithDefaults.getRank(issue),
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
