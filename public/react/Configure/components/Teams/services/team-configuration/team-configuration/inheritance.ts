import type { AllTeamData, Configuration, TeamConfiguration, IssueFields } from "./shared";

import { createEmptyTeamConfiguration } from "./shared";

import { getTeamData } from "./fetcher";
import { applyGlobalDefaultData } from "./allTeamDefault";

export const getInheritedData = (teamData: TeamConfiguration, allTeamData: AllTeamData): TeamConfiguration => {
  const issueKeys = ["defaults", "outcome", "milestones", "initiatives", "epics", "stories"] as const;

  // Inheritance logic
  const getInheritance = (
    issueType: (typeof issueKeys)[number],
    field: keyof Configuration
  ): Configuration[keyof Configuration] => {
    return (
      teamData[issueType][field] ??
      teamData.defaults[field] ??
      allTeamData.__GLOBAL__[issueType][field] ??
      allTeamData.__GLOBAL__.defaults[field]
    );
  };

  const inheritedConfig = issueKeys.reduce(
    (config, issueType) => {
      const issueFields = Object.keys(teamData[issueType]).reduce((fieldsAcc, field) => {
        const key = field as keyof Configuration;
        const data = getInheritance(issueType, key);

        return { ...fieldsAcc, [key]: data };
      }, {} as Configuration);

      return { ...config, [issueType]: issueFields };
    },
    { defaults: { ...teamData.defaults } } as TeamConfiguration
  );

  return inheritedConfig;
};

export const applyInheritance = (teamName: keyof AllTeamData, allTeamData: AllTeamData) => {
  const teamData = getTeamData(teamName, allTeamData);

  return {
    ...allTeamData,
    [teamName]: getInheritedData(teamData, allTeamData),
  };
};

export const createUpdatedTeamData = (
  allTeamData: AllTeamData,
  config: {
    teamName: keyof AllTeamData;
    issueType: keyof TeamConfiguration;
    configuration: Configuration;
  }
): AllTeamData => {
  const teamData = allTeamData[config.teamName] ?? createEmptyTeamConfiguration();

  return {
    ...allTeamData,
    [config.teamName]: {
      ...teamData,
      [config.issueType]: { ...config.configuration },
    },
  };
};

export const createFullyInheritedConfig = (userAllTeamData: AllTeamData, jiraFields: IssueFields) => {
  // global settings need to be setup before the rest of the teams
  const augmentedAllTeam = applyInheritance("__GLOBAL__", applyGlobalDefaultData(userAllTeamData, jiraFields));

  return Object.keys(augmentedAllTeam).reduce((augmented, team) => {
    // already setup the global config
    if (team === "__GLOBAL__") {
      return { ...augmented, [team]: augmentedAllTeam[team] };
    }

    const teamData = getTeamData(team, augmentedAllTeam);

    return {
      ...augmented,
      [team]: getInheritedData(teamData, augmentedAllTeam),
    };
  }, {} as AllTeamData);
};
