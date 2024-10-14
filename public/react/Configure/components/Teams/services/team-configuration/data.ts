export type Configuration = {
  sprintLength: number | null;
  velocityPerSprint: number | null;
  tracks: number | null;
  estimateField: null;
  confidenceField: string | null;
  startDateField: string | null;
  dueDateField: string | null;
  spreadEffortAcrossDates: boolean | null;
};

interface TeamConfiguration {
  defaults: Configuration;
  outcome: Configuration;
  milestones: Configuration;
  initiatives: Configuration;
  epics: Configuration;
  stories: Configuration;
}

type AllTeamData = Partial<Record<string, TeamConfiguration>> & {
  __GLOBAL__: TeamConfiguration;
};

import type { AppStorage } from "../../../../../../jira/storage/common";

import { allTeamDataKey, globalTeamConfigurationStorageKey } from "./key-factory";

const createEmptyConfiguration = (): Configuration => {
  return {
    sprintLength: null,
    velocityPerSprint: null,
    tracks: null,
    estimateField: null,
    confidenceField: null,
    startDateField: null,
    dueDateField: null,
    spreadEffortAcrossDates: null,
  };
};

const createEmptyTeamConfiguration = (): TeamConfiguration => {
  return {
    defaults: createEmptyConfiguration(),
    outcome: createEmptyConfiguration(),
    milestones: createEmptyConfiguration(),
    initiatives: createEmptyConfiguration(),
    epics: createEmptyConfiguration(),
    stories: createEmptyConfiguration(),
  };
};

const createEmptyAllTeamsData = (): AllTeamData => {
  return { __GLOBAL__: createEmptyTeamConfiguration() };
};

const getAllTeamData = async (storage: AppStorage): Promise<AllTeamData> => {
  const data = await storage.get<AllTeamData>(allTeamDataKey);

  if (!data) {
    return createEmptyAllTeamsData();
  }

  return data;
};

const getTeamData = (teamName: string, allTeamData: AllTeamData): TeamConfiguration => {
  const teamData = allTeamData[teamName];

  if (!teamData) {
    console.warn(
      [`Could not find team ${teamName} in the app data.`, `The global configuration will be used instead.`].join("\n")
    );

    return allTeamData.__GLOBAL__;
  }

  return teamData;
};

const applyInheritedData = (teamName: string, allTeamData: AllTeamData): TeamConfiguration => {
  const teamData = getTeamData(teamName, allTeamData);

  const issueKeys = ["outcome", "milestones", "initiatives", "epics", "stories"] as const;

  for (const issueType of issueKeys) {
  }

  return createEmptyTeamConfiguration();
};
