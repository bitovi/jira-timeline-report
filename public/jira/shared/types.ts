export interface Sprint {
  id: string;
  startDate: string;
  endDate: string;
  name: string;
}

type Sprints = null | Array<Sprint>;

export interface Status {
  id: string;
  name: string;
  statusCategory: { name: string };
}

export interface FixVersion {
  self: string;
  id: string;
  description: string;
  name: string;
  archived: boolean;
  released: boolean;
}

export interface Change {
  field: string;
  from?: string;
  to?: string;
  fromString?: string;
  toString?: string;
}

export interface Changelog {
  items: Change[];
  created: string;
}

export interface BaseFields {
  Parent: ParentIssue;
  Confidence?: number;
  "Due date"?: string | null;
  "Project Key"?: string;
  "Start date"?: string | null;
  "Story points"?: number | null;
  "Story points median"?: number;
  "Story points confidence"?: number | null;
  Summary: string;
  Sprint: Sprints;
  Labels: Array<string>;
  Rank?: string;
  [Key: string]: unknown;
}
// TODO: to be removed in ticket https://bitovi.atlassian.net/browse/TR-52
// interface LegacyFields extends BaseFields {
//   "Issue Type": string;
//   "Parent Link"?: string;
//   Status: string;
//   "Fix versions": FixVersion;
// }
export interface IssueFields extends BaseFields {
  "Issue Type": { hierarchyLevel: number; name: string };
  "Parent Link"?: { data: { key: string } };
  Status: Status;
  "Fix versions": Array<FixVersion>;
}

interface BaseIssue {
  id: string;
  key: string;
}

export interface JiraIssue extends BaseIssue {
  fields: IssueFields;
  changelog?: Changelog[];
}

export interface ParentIssue extends BaseIssue {
  fields: ParentFields;
}

export interface ParentFields {
  issuetype: { name: string; hierarchyLevel: number };
  summary: string;
  status: { name: string };
}

interface LegacyFields extends BaseFields {
  "Issue Type": string;
  "Parent Link"?: string;
  Status: string;
  "Fix versions": FixVersion;
}

export interface NormalizedRelease {
  name: string;
  id: string;
  type: "Release";
  key: string;
  summary: string;
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

interface NormalizedSprint {
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface NormalizedTeam {
  name: string;
  velocity: number;
  daysPerSprint: number;
  parallelWorkLimit: number;
  totalPointsPerDay: number;
  pointsPerDayPerTrack: number;
}

export type DefaultsToConfig<T> = {
  [K in keyof T as K extends `${infer FnName}Default` ? FnName : never]: T[K];
};
