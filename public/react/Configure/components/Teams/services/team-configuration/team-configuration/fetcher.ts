import type { AppStorage } from "../../../../../../../jira/storage/common";
import type { AllTeamData, TeamConfiguration } from "./shared";

import { allTeamDataKey } from "../key-factory";
import { createEmptyAllTeamsData, createEmptyTeamConfiguration } from "./shared";

export const getAllTeamData = async (storage: AppStorage, issueTypes: string[] = []): Promise<AllTeamData> => {
  const data = await storage.get<AllTeamData>(allTeamDataKey);

  if (!data) {
    return createEmptyAllTeamsData(issueTypes);
  }

  if (Object.keys(data).length === 0) {
    return createEmptyAllTeamsData(issueTypes);
  }

  return data;
};

export const getTeamData = (teamName: string, allTeamData: AllTeamData): TeamConfiguration => {
  const teamData = allTeamData[teamName];

  if (!teamData) {
    return createEmptyTeamConfiguration(Object.keys(allTeamData.__GLOBAL__));
  }

  return teamData;
};

export const updateAllTeamData = async (storage: AppStorage, updates: AllTeamData): Promise<void> => {
  return storage.update(allTeamDataKey, updates);
};
