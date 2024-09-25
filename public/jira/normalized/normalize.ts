import { parseDateIntoLocalTimezone } from "../../date-helpers.js";

import * as defaults from "./defaults";

export interface BaseFields {
  Parent: JiraIssue;
  Confidence?: number;
  "Due date"?: string | null;
  "Project Key"?: string;
  "Start date"?: string | null;
  "Story points"?: number | null;
  "Story points median"?: number;
  "Story points confidence"?: number | null;
  Summary: string;
  Sprint: null | Array<{ startDate: string; endDate: string; name: string }>;
  Labels: Array<string>;
  Rank?: string;
  [Key: string]: unknown;
}
type ParentFields = any;

interface LegacyFields extends BaseFields {
  "Issue Type": string;
  "Parent Link"?: string;
  Status: string;
  "Fix versions": FixVersion;
}

interface FixVersion {
  self: string;
  id: string;
  description: string;
  name: string;
  archived: boolean;
  released: boolean;
}

export interface IssueFields extends BaseFields {
  "Issue Type": { hierarchyLevel: number; name: string };
  "Parent Link"?: { data: { key: string } };
  Status: { name: string; statusCategory: { name: string } };
  "Fix versions": Array<FixVersion>;
}

export interface JiraIssue {
  fields: IssueFields | LegacyFields | ParentFields;
  id: string;
  key: string;
}

export interface NormalizedRelease {
  name: string;
  id: string;
  type: "Release";
  key: string;
  summary: string;
}

interface NormalizedSprint {
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface NormalizedIssue {
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

interface NormalizedSprint {
  name: string;
  startDate: Date;
  endDate: Date;
}

type DefaultsToConfig<T> = {
  [K in keyof T as K extends `${infer FnName}Default` ? FnName : never]: T[K];
};

export type NormalizeConfig = DefaultsToConfig<typeof defaults>;

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
    summary: issue.fields.Summary || issue.fields.summary || "",
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
