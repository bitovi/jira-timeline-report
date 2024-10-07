import { parseDateISOString } from "../../date-helpers";
import { JiraIssue, NormalizedIssue, ParentIssue } from "../shared/types";

type ParentField<F extends keyof ParentIssue["fields"]> = {
  fields: Pick<ParentIssue["fields"], F>;
};
type ChildField<F extends keyof JiraIssue["fields"]> = {
  fields: Pick<JiraIssue["fields"], F>;
};

type Fields = Pick<JiraIssue, "fields">;
type Key = Pick<JiraIssue, "key">;

export function getSummaryDefault({
  fields,
}: ParentField<"summary"> | ChildField<"Summary">): string {
  if ("summary" in fields) {
    return fields.summary;
  }

  return fields.Summary;
}

export function getDueDateDefault({ fields }: Fields): string | null {
  return fields["Due date"] || null;
}

export function getStartDateDefault({ fields }: Fields): string | null {
  return fields["Start date"] || null;
}

export function getStoryPointsDefault({
  fields,
}: Fields): NormalizedIssue["storyPoints"] {
  return fields["Story points"] || null;
}

export function getStoryPointsMedianDefault({
  fields,
}: Fields): NormalizedIssue["storyPointsMedian"] {
  return fields["Story points median"] || null;
}

export function getRankDefault({ fields }: Fields): NormalizedIssue["rank"] {
  return fields?.Rank || null;
}

export function getConfidenceDefault({
  fields,
}: Fields): NormalizedIssue["confidence"] {
  return fields["Story points confidence"] || fields?.Confidence || null;
}

export function getHierarchyLevelDefault({
  fields,
}:
  | ChildField<"Issue Type">
  | ParentField<"issuetype">): NormalizedIssue["hierarchyLevel"] {
  const issueType =
    "Issue Type" in fields ? fields["Issue Type"] : fields.issuetype;

  if (typeof issueType === "string") {
    return parseInt(issueType, 10);
  }

  return issueType.hierarchyLevel;
}

export function getIssueKeyDefault({ key }: Key): NormalizedIssue["key"] {
  return key;
}

export function getParentKeyDefault({
  fields,
}: Fields): NormalizedIssue["parentKey"] {
  if (fields?.Parent?.key) {
    return fields.Parent.key;
  }

  if (typeof fields["Parent Link"] === "string") {
    return fields["Parent Link"];
  }

  // this last part is probably a mistake ...
  return fields["Parent Link"]?.data?.key || null;
}

export function getUrlDefault({
  key,
}: Pick<JiraIssue, "key">): NormalizedIssue["url"] {
  return "javascript://";
}

export function getTeamKeyDefault({
  key,
}: Pick<JiraIssue, "key">): NormalizedIssue["team"]["name"] {
  return key.replace(/-.*/, "");
}

export function getTypeDefault({
  fields,
}:
  | ChildField<"Issue Type">
  | ParentField<"issuetype">): NormalizedIssue["type"] {
  const issueType =
    "Issue Type" in fields ? fields["Issue Type"] : fields.issuetype;

  if (typeof issueType === "string") {
    return issueType;
  }

  return issueType.name;
}

export function getSprintsDefault({
  fields,
}: Fields): NormalizedIssue["sprints"] {
  if (!fields.Sprint) {
    return null;
  }
  return fields.Sprint.map((sprint) => {
    return {
      name: sprint.name,
      startDate: parseDateISOString(sprint["startDate"]),
      endDate: parseDateISOString(sprint["endDate"]),
    };
  });
}

export function getStatusDefault({
  fields,
}: Fields): NormalizedIssue["status"] {
  if (typeof fields?.Status === "string") {
    return fields.Status;
  }

  return fields?.Status?.name || null;
}

export function getLabelsDefault({
  fields,
}: Fields): NormalizedIssue["labels"] {
  return fields?.Labels || [];
}

export function getStatusCategoryDefault({
  fields,
}: Fields): NormalizedIssue["statusCategory"] {
  if (typeof fields?.Status === "string") {
    return null;
  }

  return fields?.Status?.statusCategory?.name || null;
}

export function getReleasesDefault({
  fields,
}: Fields): NormalizedIssue["releases"] {
  let fixVersions = fields["Fix versions"];

  if (!fixVersions) {
    return [];
  }

  if (!Array.isArray(fixVersions)) {
    fixVersions = [fixVersions];
  }
  return fixVersions.map(({ name, id }) => {
    return {
      name,
      id,
      type: "Release",
      key: "SPECIAL:release-" + name,
      summary: name,
    };
  });
}

export function getVelocityDefault(
  teamKey: string
): NormalizedIssue["team"]["velocity"] {
  return 21;
}

export function getParallelWorkLimitDefault(
  teamKey: string
): NormalizedIssue["team"]["parallelWorkLimit"] {
  return 1;
}

export function getDaysPerSprintDefault(
  teamKey: string
): NormalizedIssue["team"]["daysPerSprint"] {
  return 10;
}
