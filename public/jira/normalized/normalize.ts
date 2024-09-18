import { parseDateIntoLocalTimezone } from "../../date-helpers.js";
import { parseDateISOString } from "../../date-helpers.js";

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
  type: "Release";
  key: string;
  summary: string;
}

interface NormalizedSprint {
  name: string;
  startDate: Date;
  endDate: Date;
}

interface IssueFields {
  Parent: JiraIssue;
  Confidence: number;
  "Due date": string;
  "Issue Type": { hierarchyLevel: number; name: string };
  // TODO: ask @Justin about parent link in getParentKey
  "Parent Link": { data: { key: string } | string };
  "Project Key": string;
  "Start date": string;
  Status: { name: string; statusCategory: { name: string } };
  "Story points": number;
  "Story points median": number;
  "Story points confidence": number;
  Summary: string;
  // todo
  Sprint: Array<{ startDate: string; endDate: string; name: string }>;
  // todo
  Labels: Array<string>;
  // todo
  Rank: unknown;
  // todo
  "Fix versions": FixVersion | FixVersion[];
}

interface FixVersion {
  name: string;
  id: string;
}

interface JiraIssue {
  fields: Partial<IssueFields>;
  id: string;
  key: string;
}

function createIssueFieldGetter<TField extends keyof IssueFields>(
  field: TField,
  defaultValue?: IssueFields[TField]
): (issue: Pick<JiraIssue, "fields">) => IssueFields[TField] | null {
  return function ({ fields }) {
    return fields[field] || defaultValue || null;
  };
}

export function getConfidenceDefault({
  fields,
}: Pick<JiraIssue, "fields">): IssueFields["Story points confidence" | "Confidence"] | null {
  return fields["Story points confidence"] || fields?.Confidence || null;
}

function getDaysPerSprintDefault(teamKey: string) {
  return 10;
}

export const getDueDateDefault = createIssueFieldGetter("Due date");

export function getHierarchyLevelDefault({
  fields,
}: Pick<JiraIssue, "fields">): IssueFields["Issue Type"]["hierarchyLevel"] | null {
  return fields["Issue Type"]?.hierarchyLevel || null;
}

export function getIssueKeyDefault({ key }: Pick<JiraIssue, "key">): JiraIssue["key"] {
  return key;
}

export function getParentKeyDefault({ fields }: Pick<JiraIssue, "fields">): string | null {
  if (fields?.Parent?.key) {
    return fields.Parent.key;
  }

  if (typeof fields["Parent Link"]?.data === "string") {
    return fields["Parent Link"].data;
  }

  // this last part is probably a mistake ...
  return fields["Parent Link"]?.data?.key || null;
}

export const getStartDateDefault = createIssueFieldGetter("Start date");

export const getStoryPointsDefault = createIssueFieldGetter("Story points");

export const getStoryPointsMedianDefault = createIssueFieldGetter("Story points median");

export function getUrlDefault({ key }: Pick<JiraIssue, "key">): string {
  return "javascript://";
}

export function getTeamKeyDefault({ key }: Pick<JiraIssue, "key">): string {
  return key.replace(/-.*/, "");
}

export function getTypeDefault({ fields }: Pick<JiraIssue, "fields">): string | null {
  return fields["Issue Type"]?.name || null;
}

export function getVelocityDefault(teamKey: string): number {
  return 21;
}

export function getParallelWorkLimitDefault(teamKey: string): number {
  return 1;
}

export function getSprintsDefault({ fields }: Pick<JiraIssue, "fields">): NormalizedSprint[] | null {
  if (!fields.Sprint) {
    return null;
  }

  return fields.Sprint.map((sprint) => {
    return {
      name: sprint.name,
      // TODO Remove cast after updating `parseDateISOString`
      startDate: parseDateISOString(sprint["startDate"]) as Date,
      endDate: parseDateISOString(sprint["endDate"]) as Date,
    };
  });
}

export function getStatusDefault({ fields }: Pick<JiraIssue, "fields">): string | null {
  return fields?.Status?.name || null;
}

export function getLabelsDefault({ fields }: Pick<JiraIssue, "fields">) {
  return fields?.Labels || [];
}

export function getStatusCategoryDefault({ fields }: Pick<JiraIssue, "fields">): string | null {
  return fields?.Status?.statusCategory?.name || null;
}

export const getRankDefault = createIssueFieldGetter("Rank");

export function getReleasesDefault({ fields }: Pick<JiraIssue, "fields">): NormalizedRelease[] {
  let fixVersions = fields["Fix versions"];

  if (!fixVersions) {
    fixVersions = [];
  }

  if (!Array.isArray(fixVersions)) {
    fixVersions = [fixVersions];
  }

  return fixVersions.map(({ name, id }) => {
    return { name, id, type: "Release", key: "SPECIAL:release-" + name, summary: name };
  });
}

const defaults = {
  getIssueKeyDefault,
  getParentKeyDefault,
  getConfidenceDefault,
  getDueDateDefault,
  getHierarchyLevelDefault,
  getStartDateDefault,
  getStoryPointsDefault,
  getStoryPointsMedianDefault,
  getTypeDefault,
  getTeamKeyDefault,
  getUrlDefault,
  getVelocityDefault,
  getDaysPerSprintDefault,
  getParallelWorkLimitDefault,
  getSprintsDefault,
  getStatusDefault,
  getStatusCategoryDefault,
  getLabelsDefault,
  getReleasesDefault,
  getRankDefault,
};

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
    // @ts-expect-error
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
