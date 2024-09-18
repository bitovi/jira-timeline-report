import { parseDateISOString } from "../../date-helpers.js";

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
  Sprint: Array<{ startDate: string; endDate: string; name: string }>;
}

interface JiraIssue {
  fields: Partial<IssueFields>;
  id: string;
  key: string;
}

function createIssueFieldGetter<TField extends keyof IssueFields>(
  field: TField,
  defaultValue?: IssueFields[TField]
): (issue: Pick<JiraIssue, "fields">) => IssueFields[TField] | undefined {
  return function ({ fields }) {
    return fields[field] || defaultValue;
  };
}

export function getConfidenceDefault({
  fields,
}: Pick<JiraIssue, "fields">): IssueFields["Story points confidence" | "Confidence"] | undefined {
  return fields["Story points confidence"] || fields.Confidence;
}

function getDaysPerSprintDefault(teamKey: string) {
  return 10;
}

export const getDueDateDefault = createIssueFieldGetter("Due date");

export function getHierarchyLevelDefault({
  fields,
}: Pick<JiraIssue, "fields">): IssueFields["Issue Type"]["hierarchyLevel"] | undefined {
  return fields["Issue Type"]?.hierarchyLevel;
}

export function getIssueKeyDefault({ key }: Pick<JiraIssue, "key">): JiraIssue["key"] {
  return key;
}

export function getParentKeyDefault({ fields }: Pick<JiraIssue, "fields">): string | undefined {
  if (fields?.Parent?.key) {
    return fields.Parent.key;
  }

  if (typeof fields["Parent Link"]?.data === "string") {
    return fields["Parent Link"].data;
  }

  // this last part is probably a mistake ...
  return fields["Parent Link"]?.data?.key;
}

export const getStartDateDefault = createIssueFieldGetter("Start date");

export const getStoryPointsDefault = createIssueFieldGetter("Story points");

export const getStoryPointsMedianDefault = createIssueFieldGetter("Story points median");

export function getUrlDefault({ key }: Pick<JiraIssue, "key">): string {
  return "javascript://";
}

export function getTeamKeyDefault({ key }: Pick<JiraIssue, "key">) {
  return key.replace(/-.*/, "");
}

export function getTypeDefault({ fields }: Pick<JiraIssue, "fields">) {
  return fields["Issue Type"]?.name;
}

export function getVelocityDefault(teamKey: string): number {
  return 21;
}

export function getParallelWorkLimitDefault(teamKey: string): number {
  return 1;
}

export function getSprintsDefault({
  fields,
}: Pick<JiraIssue, "fields">): Array<{ name: string; startDate: Date; endDate: Date }> | null {
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
