import type { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, TeamConfiguration } from "../services/team-configuration";

const getConfiguration = (allData: AllTeamData, teamKey?: string, issueType?: string): Configuration => {
  const key = teamKey || "";
  const issue = (issueType || "") as keyof TeamConfiguration;

  return allData[key]?.[issue] || allData.__GLOBAL__.defaults;
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
      const config = allData[team][issueType];

      allFields = [
        ...allFields,
        config?.estimateField ?? "",
        config?.confidenceField ?? "",
        config?.startDateField ?? "",
        config?.dueDateField ?? "",
      ];
    }
  }

  return [...new Set(allFields)];
};

export const createNormalizeConfiguration = (
  allData?: AllTeamData | undefined
): Partial<NormalizeIssueConfig> & { fields: string[] } => {
  const neededFields = getAllFields(allData);

  if (!allData) {
    console.warn(
      [
        "`createNormalizedConfiguration (react/normalize.ts):",
        "Tried to create an override config for normalize without allTeamData.",
        "An empty override was returned",
      ].join("\n")
    );

    return { fields: neededFields };
  }

  return {
    fields: neededFields,
    getDaysPerSprint: (issue, config) => {
      return Number(getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue)).sprintLength);
    },
    getVelocity: (issue, config) => {
      return Number(getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue)).velocityPerSprint);
    },
    getParallelWorkLimit: (issue, config) => {
      return Number(getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue)).tracks);
    },
    getTeamSpreadsEffortAcrossDates: (issue, config) => {
      return !!getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue)).spreadEffortAcrossDates;
    },
    getStartDate: (issue, config) => {
      const teamIssueConfiguration = getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue));

      if (!teamIssueConfiguration.startDateField) {
        return null;
      }

      const value = issue.fields[teamIssueConfiguration.startDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getConfidence: (issue, config) => {
      const teamIssueConfiguration = getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue));

      if (!teamIssueConfiguration.confidenceField) {
        return null;
      }

      const value = issue.fields[teamIssueConfiguration.confidenceField];

      if (!value) {
        return null;
      }

      const confidence = Number(value);

      if (isNaN(confidence)) {
        return null;
      }

      return confidence;
    },
    getDueDate: (issue, config) => {
      const teamIssueConfiguration = getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue));

      if (!teamIssueConfiguration.dueDateField) {
        return null;
      }

      const value = issue.fields[teamIssueConfiguration.dueDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getStoryPoints: (issue, config) => {
      const teamIssueConfiguration = getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue));

      if (!teamIssueConfiguration.estimateField) {
        return null;
      }

      const value = issue.fields[teamIssueConfiguration.estimateField];

      if (!value) {
        return null;
      }

      const storyPoints = Number(value);

      if (isNaN(storyPoints)) {
        return null;
      }

      return storyPoints;
    },
    getStoryPointsMedian: (issue, config) => {
      const teamIssueConfiguration = getConfiguration(allData, config?.getTeamKey(issue), config?.getType(issue));

      if (!teamIssueConfiguration.estimateField) {
        return null;
      }

      const value = issue.fields[teamIssueConfiguration.estimateField];

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
