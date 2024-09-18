import type { JiraIssue } from "./defaults";

import { parseDateIntoLocalTimezone } from "../../date-helpers.js";

import * as defaults from "./defaults";

interface NormalizedIssue {
  key: string;
  summary: string;
  parentKey: string | null;
  confidence: number | null;
  dueDate: Date;
  hierarchyLevel: number;
  startDate: Date;
  storyPoints: number | null;
  storyPointsMedian: number | null;
  type: string;
  team: NormalizedTeam;
  url: string;
  sprints: Array<NormalizedSprint> | null;
  status: string | null;
  statusCategory: string | null;
  issue: JiraIssue;
  labels: Array<string>;
  releases: Array<NormalizedRelease>;
  rank: string | null;
}

interface NormalizedTeam {
  name: string;
  velocity: number;
  daysPerSprint: number;
  parallelWorkLimit: number;
  totalPointsPerDay: number;
  pointsPerDayPerTrack: number;
}

interface NormalizedRelease {
  name: string;
  id: string;
  // todo
  type: "Release";
  key: string;
  summary: string;
}

interface NormalizedSprint {
  name: string;
  startDate: Date;
  endDate: Date;
}

type DefaultsToConfig<T> = {
  [K in keyof T as K extends `${infer FnName}Default` ? FnName : never]: T[K];
};

type NormalizeConfig = DefaultsToConfig<typeof defaults>;

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
  }: Partial<NormalizeConfig> = {}
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
    summary: issue.fields.Summary || "",
    key: getIssueKey(issue),
    parentKey: getParentKey(issue),
    confidence: getConfidence(issue),
    dueDate: parseDateIntoLocalTimezone(getDueDate(issue)),
    // @ts-expect-error
    hierarchyLevel: getHierarchyLevel(issue),
    startDate: parseDateIntoLocalTimezone(getStartDate(issue)),
    storyPoints: getStoryPoints(issue),
    storyPointsMedian: getStoryPointsMedian(issue),
    // @ts-expect-error
    type: getType(issue),
    sprints: getSprints(issue),
    team: {
      name: teamName,
      velocity,
      daysPerSprint,
      parallelWorkLimit,
      totalPointsPerDay,
      pointsPerDayPerTrack,
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

/**
 * For Justin
 * - todo types
 * - mapped types
 * - Ryans PR
 */
