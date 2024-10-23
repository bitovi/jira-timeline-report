import type { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, TeamConfiguration } from "../services/team-configuration";

import { getTeamKeyDefault } from "../../../../../jira/normalized/defaults";

const getConfiguration = (allData: AllTeamData, teamKey?: string, issueType?: string): Configuration => {
  const key = teamKey || "";
  const issue = (issueType || "") as keyof TeamConfiguration;

  return allData[key]?.[issue] || allData.__GLOBAL__.defaults;
};

export const createNormalizeConfiguration = (allData?: AllTeamData | undefined): Partial<NormalizeIssueConfig> => {
  if (!allData) {
    console.warn(
      [
        "`createNormalizedConfiguration (react/normalize.ts):",
        "Tried to create an override config for normalize without allTeamData.",
        "An empty override was returned",
      ].join("\n")
    );

    return {};
  }

  return {
    getDaysPerSprint: (teamKey) => {
      return Number(getConfiguration(allData, teamKey).sprintLength);
    },
    getVelocity: (issue, { getIssueKey, getTeamKey }) => {
      return Number(getConfiguration(allData, getTeamKey(issue), getIssueKey(issue)).velocityPerSprint);
    },
    getParallelWorkLimit: (teamKey) => {
      return Number(getConfiguration(allData, teamKey).tracks);
    },
    getTeamSpreadsEffortAcrossDates: (teamKey?: string) => {
      return !!getConfiguration(allData, teamKey).spreadEffortAcrossDates;
    },
    getStartDate: ({ fields }) => {
      const teamKey = getTeamKeyDefault({ fields, key: "" });
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
    getConfidence: ({ fields }) => {
      const teamKey = getTeamKeyDefault({ fields, key: "" });
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
    getDueDate: ({ fields }) => {
      const teamKey = getTeamKeyDefault({ fields, key: "" });
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
    getStoryPoints: ({ fields }) => {
      const teamKey = getTeamKeyDefault({ fields, key: "" });
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
    getStoryPointsMedian: ({ fields }) => {
      const teamKey = getTeamKeyDefault({ fields, key: "" });
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
