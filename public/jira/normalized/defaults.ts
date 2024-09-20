import type { NormalizedIssue, JiraIssue } from "./normalize";
import { parseDateISOString } from "../../date-helpers.js";

type Fields = Pick<JiraIssue, "fields">;
type Key = Pick<JiraIssue, "key">;

export function getDueDateDefault({ fields }: Fields): string | null {
  return fields["Due date"] || null;
}

export function getStartDateDefault({ fields }: Fields): string | null {
  return fields["Start date"] || null;
}

export function getStoryPointsDefault({ fields }: Fields): NormalizedIssue["storyPoints"] {
  return fields["Story points"] || null;
}

export function getStoryPointsMedianDefault({ fields }: Fields): NormalizedIssue["storyPointsMedian"] {
  return fields["Story points median"] || null;
}

export function getRankDefault({ fields }: Fields): NormalizedIssue["rank"] {
  return fields?.Rank || null;
}

export function getConfidenceDefault({ fields }: Fields): NormalizedIssue["confidence"] {
  return fields["Story points confidence"] || fields?.Confidence || null;
}

export function getHierarchyLevelDefault({ fields }: Fields): NormalizedIssue["hierarchyLevel"] {
  if (typeof fields["Issue Type"] === "string") {
    return parseInt(fields["Issue Type"], 10);
  }

  return fields["Issue Type"].hierarchyLevel;
}

export function getIssueKeyDefault({ key }: Key): NormalizedIssue["key"] {
  return key;
}

export function getParentKeyDefault({ fields }: Fields): NormalizedIssue["parentKey"] {
  if (fields?.Parent?.key) {
    return fields.Parent.key;
  }

  if (typeof fields["Parent Link"] === "string") {
    return fields["Parent Link"];
  }

  // this last part is probably a mistake ...
  return fields["Parent Link"]?.data?.key || null;
}

export function getUrlDefault({ key }: Pick<JiraIssue, "key">): NormalizedIssue["url"] {
  return "javascript://";
}

export function getTeamKeyDefault({ key }: Pick<JiraIssue, "key">): NormalizedIssue["team"]["name"] {
  return key.replace(/-.*/, "");
}

export function getTypeDefault({ fields }: Fields): NormalizedIssue["type"] {
  if (typeof fields["Issue Type"] === "string") {
    return fields["Issue Type"];
  }

  return fields["Issue Type"].name;
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
  if (typeof fields?.Status === "string") {
    return fields.Status;
  }

  return fields?.Status?.name || null;
}

export function getLabelsDefault({ fields }: Fields): NormalizedIssue["labels"] {
  return fields?.Labels || [];
}

export function getStatusCategoryDefault({ fields }: Fields): NormalizedIssue["statusCategory"] {
  if (typeof fields?.Status === "string") {
    return null;
  }

  return fields?.Status?.statusCategory?.name || null;
}

export function getReleasesDefault({ fields }: Fields): NormalizedIssue["releases"] {
  let fixVersions = fields["Fix versions"];

  if (!fixVersions) {
    return [];
  }

  if (!Array.isArray(fixVersions)) {
    fixVersions = [fixVersions];
  }

  return fixVersions.map(({ name, id }) => {
    return { name, id, type: "Release", key: "SPECIAL:release-" + name, summary: name };
  });
}

export function getVelocityDefault(teamKey: string): NormalizedIssue["team"]["velocity"] {
  return 21;
}

export function getParallelWorkLimitDefault(teamKey: string): NormalizedIssue["team"]["parallelWorkLimit"] {
  return 1;
}

export function getDaysPerSprintDefault(teamKey: string): NormalizedIssue["team"]["daysPerSprint"] {
  return 10;
}
