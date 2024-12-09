import type { AppStorage } from "../../../../../../../jira/storage/common";
import type { AllTeamData, Configuration, TeamConfiguration } from "./shared";

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
  const sanitized = entriesFlatMap(
    updates,
    ([teamConfigKey, updatedTeamConfig]: [string, TeamConfiguration | undefined]) => {
      if (!updatedTeamConfig) return [];

      const value = entriesFlatMap(
        updatedTeamConfig,
        ([configKey, updatedConfig]: [string, Configuration | undefined]) => {
          if (!updatedConfig) return [];

          const configNoNulls = filterNullValues(updatedConfig);
          
          return notEmpty(configNoNulls, [configKey, configNoNulls]);
        }
      );
      return notEmpty(value, [teamConfigKey, value]);
    }
  );
  return storage.update(allTeamDataKey, sanitized);
};

const entriesFlatMap = <TItem, TMap extends Record<string, TItem>>(
  updates: TMap,
  fn: ([key, update]: [string, TItem]) => (string | { [k: string]: any })[][]
) => Object.fromEntries(Object.entries(updates).flatMap(fn));

const filterNullValues = (obj: Record<string, any>) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => !!value));
};

const notEmpty = <TObj extends {}, TResult>(obj: TObj, result: TResult) => (Object.keys(obj).length ? [result] : []);
