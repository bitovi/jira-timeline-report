import { parseDateISOString } from "../../date-helpers";
import { JiraIssue, NormalizedIssue, ParentIssue } from "../shared/types";
import { NormalizeIssueConfig } from "./normalize";

type ParentField<F extends keyof ParentIssue["fields"]> = {
  fields: Pick<ParentIssue["fields"], F>;
};
type ChildField<F extends keyof JiraIssue["fields"]> = {
  fields: Pick<JiraIssue["fields"], F>;
};

type Fields = Pick<JiraIssue, "fields">;
type Key = Pick<JiraIssue, "key">;

export function getSummaryDefault({ fields }: ParentField<"summary"> | ChildField<"Summary">): string {
  if ("summary" in fields) {
    return fields.summary;
  }

  return fields.Summary;
}

export function getDueDateDefault({ key, fields }: Pick<JiraIssue, "key" | "fields">): string | null {
  return fields["Due date"] || null;
}

export function getStartDateDefault({ key, fields }: Pick<JiraIssue, "key" | "fields">): string | null {
  return fields["Start date"] || null;
}

export function getStoryPointsDefault({
  key,
  fields,
}: Pick<JiraIssue, "key" | "fields">): NormalizedIssue["storyPoints"] {
  return fields["Story points"] || null;
}

export function getStoryPointsMedianDefault({
  key,
  fields,
}: Pick<JiraIssue, "key" | "fields">): NormalizedIssue["storyPointsMedian"] {
  return fields["Story points median"] || null;
}

export function getRankDefault({ fields }: Fields): NormalizedIssue["rank"] {
  return fields?.Rank || null;
}

export function getConfidenceDefault({
  key,
  fields,
}: Pick<JiraIssue, "key" | "fields">): NormalizedIssue["confidence"] {
  return fields["Story points confidence"] || fields?.Confidence || null;
}

export function getHierarchyLevelDefault({
  fields,
}: ChildField<"Issue Type"> | ParentField<"issuetype">): NormalizedIssue["hierarchyLevel"] {
  const issueType = "Issue Type" in fields ? fields["Issue Type"] : fields.issuetype;

  if (typeof issueType === "string") {
    return parseInt(issueType, 10);
  }

  return issueType.hierarchyLevel;
}

export function getIssueKeyDefault({ key }: Key): NormalizedIssue["key"] {
  return key;
}

export function getParentKeyDefault({ fields }: Fields): NormalizedIssue["parentKey"] {
  if (fields?.Parent?.key) {
    return fields.Parent.key;
  }

  return fields["Parent Link"]?.data?.key ?? null;
}

export function getUrlDefault({ key }: Pick<JiraIssue, "key">): NormalizedIssue["url"] {
  return "javascript://";
}

export function getTeamKeyDefault({ key, fields }: Pick<JiraIssue, "key" | "fields">): NormalizedIssue["team"]["name"] {
  if (fields.Team?.name) {
    return fields.Team.name;
  }
  return key.replace(/-.*/, "");
}

export function getTypeDefault({
  fields,
}: ChildField<"Issue Type"> | ParentField<"issuetype">): NormalizedIssue["type"] {
  const issueType = "Issue Type" in fields ? fields["Issue Type"] : fields.issuetype;

  if (typeof issueType === "string") {
    return issueType;
  }

  return issueType.name;
}

export function getSprintsDefault({ fields }: Fields): NormalizedIssue["sprints"] {
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

export function getStatusDefault({ fields }: Fields): NormalizedIssue["status"] {
  return fields?.Status?.name || null;
}

export function getLabelsDefault({ fields }: Fields): NormalizedIssue["labels"] {
  return fields?.Labels || [];
}

export function getStatusCategoryDefault({ fields }: Fields): NormalizedIssue["statusCategory"] {
  return fields?.Status?.statusCategory?.name || null;
}

export function getReleasesDefault({ fields }: Fields): NormalizedIssue["releases"] {
  let fixVersions = fields["Fix versions"];

  if (!fixVersions) {
    return [];
  }
  // Rollback is getting this property wrong and not always making it an array
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
  normalizedIssue: Pick<JiraIssue, "key" | "fields">,
  options: Pick<NormalizeIssueConfig, "getTeamKey" | "getIssueKey">
): NormalizedIssue["team"]["velocity"] {
  return 21;
}

export function getParallelWorkLimitDefault(teamKey: string): NormalizedIssue["team"]["parallelWorkLimit"] {
  return 1;
}

export function getDaysPerSprintDefault(teamKey: string): NormalizedIssue["team"]["daysPerSprint"] {
  return 10;
}

export function getTeamSpreadsEffortAcrossDatesDefault(
  teamKey?: string
): NormalizedIssue["team"]["spreadEffortAcrossDates"] {
  return false;
}
