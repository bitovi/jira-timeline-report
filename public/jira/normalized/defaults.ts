import { parseDateISOString } from "../../date-helpers.js";

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

interface FixVersion {
  name: string;
  id: string;
}

export interface IssueFields {
  Parent: JiraIssue;
  Confidence: number;
  "Due date": string;
  // TODO
  "Issue Type": string | { hierarchyLevel: number; name: string };
  // TODO: ask @Justin about parent link in getParentKey
  "Parent Link": string | { data: { key: string } };
  "Project Key": string;
  "Start date": string;
  // TODO
  Status: string | { name: string; statusCategory: { name: string } };
  "Story points": number;
  "Story points median": number;
  "Story points confidence": number;
  Summary: string;
  // todo
  Sprint: null | Array<{ startDate: string; endDate: string; name: string }>;
  // todo
  Labels: Array<string>;
  // todo
  Rank: string;
  // todo
  "Fix versions": FixVersion | FixVersion[];
}

export interface JiraIssue {
  fields: Partial<IssueFields>;
  id: string;
  key: string;
}

type Fields = Pick<JiraIssue, "fields">;

function createIssueFieldGetter<TField extends keyof IssueFields>(
  field: TField,
  defaultValue?: IssueFields[TField]
): (issue: Fields) => IssueFields[TField] | null {
  return function ({ fields }) {
    return fields[field] || defaultValue || null;
  };
}

export const getDueDateDefault = createIssueFieldGetter("Due date");
export const getStartDateDefault = createIssueFieldGetter("Start date");
export const getStoryPointsDefault = createIssueFieldGetter("Story points");
export const getStoryPointsMedianDefault = createIssueFieldGetter("Story points median");
export const getRankDefault = createIssueFieldGetter("Rank");

export function getConfidenceDefault({ fields }: Fields): IssueFields["Story points confidence" | "Confidence"] | null {
  return fields["Story points confidence"] || fields?.Confidence || null;
}

export function getHierarchyLevelDefault({ fields }: Fields): number | null {
  if (typeof fields["Issue Type"] === "string") {
    return null;
  }

  return fields["Issue Type"]?.hierarchyLevel || null;
}

export function getIssueKeyDefault({ key }: Pick<JiraIssue, "key">): JiraIssue["key"] {
  return key;
}

export function getParentKeyDefault({ fields }: Fields): string | null {
  if (fields?.Parent?.key) {
    return fields.Parent.key;
  }

  if (typeof fields["Parent Link"] === "string") {
    return fields["Parent Link"];
  }

  // this last part is probably a mistake ...
  return fields["Parent Link"]?.data?.key || null;
}

export function getUrlDefault({ key }: Pick<JiraIssue, "key">): string {
  return "javascript://";
}

export function getTeamKeyDefault({ key }: Pick<JiraIssue, "key">): string {
  return key.replace(/-.*/, "");
}

export function getTypeDefault({ fields }: Fields): string | null {
  if (typeof fields["Issue Type"] === "string") {
    return fields["Issue Type"];
  }

  return fields["Issue Type"]?.name || null;
}

export function getSprintsDefault({ fields }: Fields): NormalizedSprint[] | null {
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

export function getStatusDefault({ fields }: Fields): string | null {
  if (typeof fields?.Status === "string") {
    return fields.Status;
  }

  return fields?.Status?.name || null;
}

export function getLabelsDefault({ fields }: Fields) {
  return fields?.Labels || [];
}

export function getStatusCategoryDefault({ fields }: Fields): string | null {
  if (typeof fields?.Status === "string") {
    return null;
  }

  return fields?.Status?.statusCategory?.name || null;
}

export function getReleasesDefault({ fields }: Fields): NormalizedRelease[] {
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

export function getVelocityDefault(teamKey: string): number {
  return 21;
}

export function getParallelWorkLimitDefault(teamKey: string): number {
  return 1;
}

export function getDaysPerSprintDefault(teamKey: string) {
  return 10;
}
