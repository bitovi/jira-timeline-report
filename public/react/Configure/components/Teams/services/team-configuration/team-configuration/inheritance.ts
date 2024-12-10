import type { AllTeamData, Configuration, TeamConfiguration, IssueFields } from "./shared";

import { createEmptyConfiguration, createEmptyTeamConfiguration } from "./shared";

import { getTeamData } from "./fetcher";
import { applyGlobalDefaultData } from "./allTeamDefault";

export const getInheritedData = (
  teamData: TeamConfiguration,
  allTeamData: AllTeamData,
  hierarchyLevels: string[]
): TeamConfiguration => {
  // Inheritance logic
  const getInheritance = (
    heirarchyLevel: (typeof hierarchyLevels)[number],
    field: keyof Configuration
  ): Configuration[keyof Configuration] => {
    return (
      teamData?.[heirarchyLevel]?.[field] ??
      teamData?.defaults?.[field] ??
      allTeamData?.__GLOBAL__[heirarchyLevel]?.[field] ??
      allTeamData?.__GLOBAL__?.defaults?.[field]
    );
  };

  const inheritedConfig = [...hierarchyLevels, "defaults"].reduce((config, level) => {
    const levelConfig = { ...createEmptyConfiguration(), ...(teamData?.[level] ?? {}) };

    const levelFields = Object.keys(levelConfig).reduce((fieldsAcc, field) => {
      const key = field as keyof Configuration;

      const data = getInheritance(level, key);

      return { ...fieldsAcc, [key]: data };
    }, {} as Configuration);

    return { ...config, [level]: levelFields };
  }, {} as TeamConfiguration);

  return inheritedConfig;
};

export const applyInheritance = (
  teamName: keyof AllTeamData,
  allTeamData: AllTeamData,
  hierarchyLevels: string[]
) => {
  const teamData = getTeamData(teamName, allTeamData);

  return {
    ...allTeamData,
    [teamName]: getInheritedData(teamData, allTeamData, hierarchyLevels),
  };
};

export const createUpdatedTeamData = (
  allTeamData: AllTeamData,
  config: {
    teamName: keyof AllTeamData;
    hierarchyLevel: keyof TeamConfiguration;
    configuration: Configuration;
  }
): AllTeamData => {
  const teamData =
    allTeamData[config.teamName] ??
    createEmptyTeamConfiguration(Object.keys(allTeamData?.__GLOBAL__ ?? {}));

  return {
    ...allTeamData,
    [config.teamName]: {
      ...teamData,
      [config.hierarchyLevel]: { ...config.configuration },
    },
  };
};

export const createFullyInheritedConfig = (
  userAllTeamData: AllTeamData,
  jiraFields: IssueFields,
  hierarchyLevels: string[]
) => {
  // global settings need to be setup before the rest of the teams
  const augmentedAllTeam = applyInheritance(
    "__GLOBAL__",
    applyGlobalDefaultData(userAllTeamData, jiraFields),
    hierarchyLevels
  );

  return Object.keys(augmentedAllTeam).reduce((augmented, team) => {
    // already setup the global config
    if (team === "__GLOBAL__") {
      return { ...augmented, [team]: augmentedAllTeam[team] };
    }

    const teamData = getTeamData(team, augmentedAllTeam);

    return {
      ...augmented,
      [team]: getInheritedData(teamData, augmentedAllTeam, hierarchyLevels),
    };
  }, {} as AllTeamData);
};
