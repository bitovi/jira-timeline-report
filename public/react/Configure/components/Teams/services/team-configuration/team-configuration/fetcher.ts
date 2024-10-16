import type { AppStorage } from "../../../../../../../jira/storage/common";
import type { AllTeamData, TeamConfiguration } from "./shared";

import { allTeamDataKey } from "../key-factory";
import { createEmptyAllTeamsData, createEmptyTeamConfiguration } from "./shared";

export const getAllTeamData = async (storage: AppStorage): Promise<AllTeamData> => {
  const data = await storage.get<AllTeamData>(allTeamDataKey);

  if (!data) {
    return createEmptyAllTeamsData();
  }

  if (Object.keys(data).length === 0) {
    return createEmptyAllTeamsData();
  }

  return data;
};

export const getTeamData = (teamName: string, allTeamData: AllTeamData): TeamConfiguration => {
  const teamData = allTeamData[teamName];

  if (!teamData) {
    return createEmptyTeamConfiguration();
  }

  return teamData;
};

export const updateAllTeamData = async (storage: AppStorage, updates: AllTeamData): Promise<void> => {
  return storage.update(allTeamDataKey, updates);
};
