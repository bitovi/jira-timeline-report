import type { NormalizeIssueConfig } from "../../../../../jira/normalized/normalize";
import type { AllTeamData, Configuration, TeamConfiguration } from "../services/team-configuration";

const getConfiguration = (allData: AllTeamData, teamKey?: string, heirarchyLevel?: number): Configuration => {
  const key = teamKey || "";
  const level = typeof heirarchyLevel === "undefined" ? 0 : heirarchyLevel;

  return allData[key]?.[level] || allData.__GLOBAL__.defaults;
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
    for (const heirarchyLevel in allData[team]) {
      const config = allData[team][heirarchyLevel];

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
      return Number(
        getConfiguration(allData, config?.getTeamKey(issue), config?.getHierarchyLevel(issue)).sprintLength
      );
    },
    getVelocity: (issue, config) => {
      return Number(
        getConfiguration(allData, config?.getTeamKey(issue), config?.getHierarchyLevel(issue)).velocityPerSprint
      );
    },
    getParallelWorkLimit: (issue, config) => {
      return Number(getConfiguration(allData, config?.getTeamKey(issue), config?.getHierarchyLevel(issue)).tracks);
    },
    getTeamSpreadsEffortAcrossDates: (issue, config) => {
      return !!getConfiguration(allData, config?.getTeamKey(issue), config?.getHierarchyLevel(issue))
        .spreadEffortAcrossDates;
    },
    getStartDate: (issue, config) => {
      const teamHierarchyConfiguration = getConfiguration(
        allData,
        config?.getTeamKey(issue),
        config?.getHierarchyLevel(issue)
      );

      if (!teamHierarchyConfiguration.startDateField) {
        return null;
      }

      const value = issue.fields[teamHierarchyConfiguration.startDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getConfidence: (issue, config) => {
      const teamHierarchyConfiguration = getConfiguration(
        allData,
        config?.getTeamKey(issue),
        config?.getHierarchyLevel(issue)
      );

      if (!teamHierarchyConfiguration.confidenceField) {
        return null;
      }

      if (
        typeof teamHierarchyConfiguration.confidenceField === "string" &&
        teamHierarchyConfiguration.confidenceField === "confidence-not-used"
      ) {
        return 100;
      }

      const value = issue.fields[teamHierarchyConfiguration.confidenceField];

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
      const teamHierarchyConfiguration = getConfiguration(
        allData,
        config?.getTeamKey(issue),
        config?.getHierarchyLevel(issue)
      );

      if (!teamHierarchyConfiguration.dueDateField) {
        return null;
      }

      const value = issue.fields[teamHierarchyConfiguration.dueDateField];

      if (!value || typeof value !== "string") {
        return null;
      }

      return value;
    },
    getStoryPoints: (issue, config) => {
      const teamHierarchyConfiguration = getConfiguration(
        allData,
        config?.getTeamKey(issue),
        config?.getHierarchyLevel(issue)
      );

      if (!teamHierarchyConfiguration.estimateField) {
        return null;
      }

      const value = issue.fields[teamHierarchyConfiguration.estimateField];

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
      const teamHierarchyConfiguration = getConfiguration(
        allData,
        config?.getTeamKey(issue),
        config?.getHierarchyLevel(issue)
      );

      if (!teamHierarchyConfiguration.estimateField) {
        return null;
      }

      const value = issue.fields[teamHierarchyConfiguration.estimateField];

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
