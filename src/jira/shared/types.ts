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
  'Due date'?: string | null;
  'Project Key'?: string;
  'Start date'?: string | null;
  'Story points'?: number | null;
  'Story points median'?: number;
  'Story points confidence'?: number | null;
  Summary: string;
  Sprint: Sprints;
  Labels: Array<string>;
  Rank?: string;
  [Key: string]: unknown;
}

export interface IssueFields extends BaseFields {
  'Issue Type': { hierarchyLevel: number; name: string; iconUrl?: string };
  'Parent Link'?: { data: { key: string } };
  Status: Status;
  'Fix versions': Array<FixVersion>;
  Team: null | { name: string; id: string; avatarUrl?: string };
  'Linked Issues'?: IssueLink[];
}

export interface IssueLink {
  id: string;
  outwardIssue: { id: string; key: string };
  type: { id: string; inward: string; name: string; outward: string };
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

export type FetchJiraIssuesParams = {
  accessToken?: string;
  jql?: string;
  fields?: string[];
  startAt?: number;
  maxResults?: number;
  limit?: number;
};

export interface NormalizedRelease {
  key: string;
  type: 'Release';
  summary: string;

  name: string;
  id: string;
}

export interface NormalizedIssue {
  key: string;
  type: string;
  summary: string;
  projectKey: string;

  parentKey: string | null;
  confidence: number | null;
  dueDate: Date;
  hierarchyLevel: number;
  startDate: Date;
  storyPoints: number | null;
  storyPointsMedian: number | null;
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
  spreadEffortAcrossDates: boolean;
}

export type DefaultsToConfig<T> = {
  [K in keyof T as K extends `${infer FnName}Default` ? FnName : never]: T[K];
};

export type CalculationType =
  | 'parentFirstThenChildren'
  | 'childrenOnly'
  | 'childrenFirstThenParent'
  | 'widestRange'
  | 'parentOnly';

export type RollupLevelAndCalculation = {
  type: string;
  hierarchyLevel: number;
  calculation: CalculationType;
};
