import { parseDateISOString } from "../../date-helpers";
import { JiraIssue, NormalizedIssue, ParentIssue } from "../shared/types";
import { NormalizeIssueConfig } from "./normalize";

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

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

type DueDateMinimalIssue = {
  fields: {
    "Due date"?: JiraIssue["fields"]["Due date"];
    [key: string]: unknown;
  };
} & MinimalIssueTypeIssue &
  MinimalHierarchyLevelIssue &
  MinimalTeamKeyIssue;

export function getDueDateDefault(
  { fields }: DueDateMinimalIssue,
  otpions?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): string | null {
  return fields["Due date"] || null;
}

type StartDateMinimalIssue = {
  fields: {
    "Start date"?: JiraIssue["fields"]["Start date"];
    [key: string]: unknown;
  };
} & MinimalIssueTypeIssue &
  MinimalHierarchyLevelIssue &
  MinimalTeamKeyIssue;

export function getStartDateDefault(
  { fields }: StartDateMinimalIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): string | null {
  return fields["Start date"] || null;
}

type StoryPointsMinimalIssue = {
  fields: {
    "Story points"?: JiraIssue["fields"]["Story points"];
    [key: string]: unknown;
  };
} & MinimalIssueTypeIssue &
  MinimalHierarchyLevelIssue &
  MinimalTeamKeyIssue;

export function getStoryPointsDefault(
  { key, fields }: StoryPointsMinimalIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): NormalizedIssue["storyPoints"] {
  return fields["Story points"] || null;
}

type StoryPointsMedianMinimalIssue = {
  fields: {
    "Story points median"?: JiraIssue["fields"]["Story points median"];
    [key: string]: unknown;
  };
} & MinimalIssueTypeIssue &
  MinimalHierarchyLevelIssue &
  MinimalTeamKeyIssue;

export function getStoryPointsMedianDefault(
  { key, fields }: StoryPointsMedianMinimalIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): NormalizedIssue["storyPointsMedian"] {
  return fields["Story points median"] || null;
}

export function getRankDefault({ fields }: Fields): NormalizedIssue["rank"] {
  return fields?.Rank || null;
}

type ConfidenceMinimalIssue = {
  fields: {
    "Story points confidence"?: JiraIssue["fields"]["Story points confidence"];
    Confidence?: JiraIssue["fields"]["Confidence"];
    [key: string]: unknown;
  };
} & MinimalIssueTypeIssue &
  MinimalHierarchyLevelIssue &
  MinimalTeamKeyIssue;

export function getConfidenceDefault(
  { fields }: ConfidenceMinimalIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): NormalizedIssue["confidence"] {
  return fields["Story points confidence"] || fields?.Confidence || null;
}

type MinimalHierarchyLevelIssue = {
  fields:
    | {
        issuetype: ParentIssue["fields"]["issuetype"];
      }
    | { "Issue Type": JiraIssue["fields"]["Issue Type"] };
};

export function getHierarchyLevelDefault({ fields }: MinimalHierarchyLevelIssue): NormalizedIssue["hierarchyLevel"] {
  const issueType = "Issue Type" in fields ? fields["Issue Type"] : fields.issuetype;

  console.log({ fields, issueType, level: issueType.hierarchyLevel });

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

interface MinimalTeamKeyIssue {
  key: JiraIssue["key"];
  fields: { Team: JiraIssue["fields"]["Team"] };
}

export function getTeamKeyDefault({ key, fields }: MinimalTeamKeyIssue): NormalizedIssue["team"]["name"] {
  if (fields.Team?.name) {
    return fields.Team.name;
  }

  return key.replace(/-.*/, "");
}

type MinimalIssueTypeIssue = {
  fields:
    | {
        issuetype: ParentIssue["fields"]["issuetype"];
      }
    | { "Issue Type": JiraIssue["fields"]["Issue Type"] };
};

export function getTypeDefault({ fields }: MinimalIssueTypeIssue): NormalizedIssue["type"] {
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

type MinimalVelocityIssue = Prettify<MinimalTeamKeyIssue & MinimalIssueTypeIssue & MinimalHierarchyLevelIssue>;

export function getVelocityDefault(
  issue: MinimalVelocityIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): NormalizedIssue["team"]["velocity"] {
  return 21;
}

type MinimalParallelWorkLimitIssue = Prettify<MinimalTeamKeyIssue & MinimalIssueTypeIssue & MinimalHierarchyLevelIssue>;

export function getParallelWorkLimitDefault(
  issue: MinimalParallelWorkLimitIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): NormalizedIssue["team"]["parallelWorkLimit"] {
  return 1;
}

type MinimalDaysPerSprintIssue = Prettify<MinimalTeamKeyIssue & MinimalIssueTypeIssue & MinimalHierarchyLevelIssue>;

export function getDaysPerSprintDefault(
  issue: MinimalDaysPerSprintIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): NormalizedIssue["team"]["daysPerSprint"] {
  return 10;
}

type MinimalTeamSpreadEffortIssue = Prettify<MinimalTeamKeyIssue & MinimalIssueTypeIssue & MinimalHierarchyLevelIssue>;

export function getTeamSpreadsEffortAcrossDatesDefault(
  issue: MinimalTeamSpreadEffortIssue,
  options?: Pick<NormalizeIssueConfig, "getTeamKey" | "getType" | "getHierarchyLevel">
): NormalizedIssue["team"]["spreadEffortAcrossDates"] {
  return false;
}
