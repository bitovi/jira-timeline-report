import type { AppStorage } from "../../../../../../../jira/storage/common";
import type { AllTeamData, TeamConfiguration } from "./shared";

import { allTeamDataKey } from "../key-factory";
import { createEmptyAllTeamsData, createEmptyTeamConfiguration } from "./shared";

export const getAllTeamData = async (
  storage: AppStorage,
  issueTypes: string[] = []
): Promise<AllTeamData> => {
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

export const updateAllTeamData = async (
  storage: AppStorage,
  updates: AllTeamData
): Promise<void> => {
  const sanitized = entriesFlatMap(updates, ([teamKey, teamConfig]) => {
    if (!teamConfig) return [];

    const configs = entriesFlatMap(teamConfig, ([configKey, config]) => {
      if (!config) return [];

      const sanitizedConfig = filterNullValues(config);
      return notEmpty(sanitizedConfig, [configKey, sanitizedConfig]);
    });

    return notEmpty(configs, [teamKey, configs]);
  });

  await storage.update(allTeamDataKey, sanitized);
};

function entriesFlatMap<T, R extends readonly [string, any]>(
  obj: Record<string, T>,
  fn: (entry: [string, T]) => R[]
): T {
  return Object.fromEntries(Object.entries(obj).flatMap(fn)) as T;
}

function filterNullValues<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value != null)
  ) as Partial<T>;
}

function notEmpty<T extends object | undefined>(value: T, result: [string, T]) {
  if (!value) {
    return [];
  }

  return Object.keys(value).length > 0 ? [result] : [];
}
