import type { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, TeamConfiguration } from "../services/team-configuration";

import { getTeamKeyDefault } from "../../../../../jira/normalized/defaults";

const getConfiguration = (allData: AllTeamData, teamKey?: string): Configuration => {
  const key = teamKey || "";

  return allData[key]?.defaults || allData.__GLOBAL__.defaults;
};

const defaults = [
  "Start date",
  "Due date",
  "Story points",
  "Story points median",
  "Confidence",
  "Story points confidence",
  "Days estimate",
];

const getAllFields = (allData?: AllTeamData): string[] => {
  let allFields = [...defaults];

  for (const team in allData) {
    for (const issueType in allData[team]) {
      const config = allData[team][issueType as keyof TeamConfiguration];

      allFields = [
        ...allFields,
        config.estimateField ?? "",
        config.confidenceField ?? "",
        config.startDateField ?? "",
        config.dueDateField ?? "",
      ];
    }
  }

  return [...new Set(allFields)];
};

export const createNormalizeConfiguration = (
  allData?: AllTeamData | undefined
): Partial<NormalizeIssueConfig> & { fields: string[] } => {
  const fields = getAllFields(allData);

  if (!allData) {
    console.warn(
      [
        "`createNormalizedConfiguration (react/normalize.ts):",
        "Tried to create an override config for normalize without allTeamData.",
        "An empty override was returned",
      ].join("\n")
    );

    return { fields };
  }

  return {
    fields,
    getDaysPerSprint: (teamKey) => {
      return Number(getConfiguration(allData, teamKey).sprintLength);
    },
    getVelocity: (teamKey) => {
      return Number(getConfiguration(allData, teamKey).velocityPerSprint);
    },
    getParallelWorkLimit: (teamKey) => {
      return Number(getConfiguration(allData, teamKey).tracks);
    },
    getTeamSpreadsEffortAcrossDates: (teamKey?: string) => {
      return !!getConfiguration(allData, teamKey).spreadEffortAcrossDates;
    },
    getStartDate: ({ fields, key }) => {
      const teamKey = getTeamKeyDefault({ fields, key });
      const config = getConfiguration(allData, teamKey);

      if (!config.startDateField) {
        return null;
      }

      const value = fields[config.startDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getConfidence: ({ fields, key }) => {
      const teamKey = getTeamKeyDefault({ fields, key });
      const config = getConfiguration(allData, teamKey);

      if (!config.confidenceField) {
        return null;
      }

      const value = fields[config.confidenceField];

      if (!value) {
        return null;
      }

      const confidence = Number(value);

      if (isNaN(confidence)) {
        return null;
      }

      return confidence;
    },
    getDueDate: ({ fields, key }) => {
      const teamKey = getTeamKeyDefault({ fields, key });
      const config = getConfiguration(allData, teamKey);

      if (!config.dueDateField) {
        return null;
      }

      const value = fields[config.dueDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getStoryPoints: ({ fields, key }) => {
      const teamKey = getTeamKeyDefault({ fields, key });
      const config = getConfiguration(allData, teamKey);

      if (!config.estimateField) {
        return null;
      }

      const value = fields[config.estimateField];

      if (!value) {
        return null;
      }

      const storyPoints = Number(value);

      if (isNaN(storyPoints)) {
        return null;
      }

      return storyPoints;
    },
    getStoryPointsMedian: ({ fields, key }) => {
      const teamKey = getTeamKeyDefault({ fields, key });
      const config = getConfiguration(allData, teamKey);

      if (!config.estimateField) {
        return null;
      }

      const value = fields[config.estimateField];

      if (!value) {
        return null;
      }

      const storyPoints = Number(value);

      if (isNaN(storyPoints)) {
        return null;
      }

      return storyPoints;
    },
  };
};
