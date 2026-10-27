/**
 * Implements the inheritance logic and computes the final configurations
 */
import type { AllTeamData, Configuration, TeamConfiguration, IssueFields } from './shared';

import { createEmptyConfiguration, createEmptyTeamConfiguration } from './shared';

import { getTeamData } from './fetcher';
import { applyGlobalDefaultData } from './allTeamDefault';

/**
 * The fields that say what one estimate unit means. A level saving any of them defines its own
 * capacity, so its `pointsPerPersonDay` (X) can't come from a less specific level: X is in the
 * unit's own terms, and a legacy velocity or share on that level is what X has to be derived from.
 */
const CAPACITY_ANCHOR_FIELDS = [
  'pointsPerPersonDay',
  'estimateUnit',
  'velocityPerSprint',
  'estimateTeamShare',
] as const satisfies ReadonlyArray<keyof Configuration>;

export const anchorsCapacity = (config: Partial<Configuration> | undefined) =>
  CAPACITY_ANCHOR_FIELDS.some((field) => config?.[field] != null);

export const getInheritedData = (
  teamData: TeamConfiguration,
  allTeamData: AllTeamData,
  hierarchyLevels: string[],
): TeamConfiguration => {
  const chain = (heirarchyLevel: (typeof hierarchyLevels)[number]) => [
    teamData?.[heirarchyLevel],
    teamData?.defaults,
    allTeamData?.__GLOBAL__[heirarchyLevel],
    allTeamData?.__GLOBAL__?.defaults,
  ];

  // Inheritance logic
  const getInheritance = (
    heirarchyLevel: (typeof hierarchyLevels)[number],
    field: keyof Configuration,
  ): Configuration[keyof Configuration] => {
    // X resolves together with the unit: from the most specific level that defines capacity at all,
    // or not at all (`null`, so it is derived from that level's legacy answers). See spec/042.
    if (field === 'pointsPerPersonDay') {
      return chain(heirarchyLevel).find(anchorsCapacity)?.pointsPerPersonDay ?? null;
    }

    return (
      teamData?.[heirarchyLevel]?.[field] ??
      teamData?.defaults?.[field] ??
      allTeamData?.__GLOBAL__[heirarchyLevel]?.[field] ??
      allTeamData?.__GLOBAL__?.defaults?.[field]
    );
  };

  const inheritedConfig = [...hierarchyLevels, 'defaults'].reduce((config, level) => {
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

export const applyInheritance = (teamName: keyof AllTeamData, allTeamData: AllTeamData, hierarchyLevels: string[]) => {
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
  },
): AllTeamData => {
  const teamData =
    allTeamData[config.teamName] ?? createEmptyTeamConfiguration(Object.keys(allTeamData?.__GLOBAL__ ?? {}));

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
  hierarchyLevels: string[],
) => {
  // global settings need to be setup before the rest of the teams
  const inheritedAllTeamData = applyInheritance(
    '__GLOBAL__',
    applyGlobalDefaultData(userAllTeamData, jiraFields),
    hierarchyLevels,
  );

  return Object.keys(inheritedAllTeamData).reduce((augmented, team) => {
    // already setup the global config
    if (team === '__GLOBAL__') {
      return { ...augmented, [team]: inheritedAllTeamData[team] };
    }

    const teamData = getTeamData(team, inheritedAllTeamData);

    return {
      ...augmented,
      [team]: getInheritedData(teamData, inheritedAllTeamData, hierarchyLevels),
    };
  }, {} as AllTeamData);
};

/**
 * What a level would show if every field on it were un-customized — the value the "inherit" toggle
 * resets to. `inheritedGlobal` must already have inheritance applied, so `inheritedGlobal[level]`
 * carries the fallback to the global defaults.
 *
 * `__GLOBAL__` gets its own rule: running the team chain for it would read back the very
 * `__GLOBAL__[level]` value being cleared. See spec/039-global-defaults-workitems.
 */
export const getParentConfiguration = ({
  teamName,
  hierarchyLevel,
  savedTeamData,
  inheritedGlobal,
}: {
  teamName: string;
  hierarchyLevel: keyof TeamConfiguration;
  savedTeamData: TeamConfiguration | undefined;
  inheritedGlobal: TeamConfiguration;
}): Configuration => {
  if (teamName === '__GLOBAL__' || hierarchyLevel === 'defaults') {
    return { ...createEmptyConfiguration(), ...inheritedGlobal.defaults };
  }

  const globalLevel = {
    ...createEmptyConfiguration(),
    ...inheritedGlobal.defaults,
    ...inheritedGlobal[hierarchyLevel],
  };

  return Object.keys(globalLevel).reduce((config, field) => {
    const key = field as keyof Configuration;

    if (key === 'pointsPerPersonDay' && anchorsCapacity(savedTeamData?.defaults)) {
      return { ...config, [key]: savedTeamData?.defaults?.pointsPerPersonDay ?? null };
    }

    return { ...config, [key]: savedTeamData?.defaults?.[key] ?? globalLevel[key] };
  }, {} as Configuration);
};

/**
 * One team's fully inherited configuration at one level — what normalize schedules it with — straight
 * from saved data. For callers outside the settings forms, like the AutoScheduler's team row.
 */
export const resolveTeamConfiguration = (
  savedAllTeamData: AllTeamData,
  jiraFields: IssueFields,
  teamName: string,
  hierarchyLevel: string,
): Configuration => {
  const levels = [hierarchyLevel];
  const inheritedGlobal = applyInheritance('__GLOBAL__', applyGlobalDefaultData(savedAllTeamData, jiraFields), levels);

  return getInheritedData(getTeamData(teamName, inheritedGlobal), inheritedGlobal, levels)[hierarchyLevel]!;
};

/**
 * Has the team ever entered a headcount? Only a saved `teamMembers` somewhere in its chain counts:
 * the default lives in code, not in saved data. Decides whether a headcount edit re-anchors X
 * (`pointsPerPersonDayForHeadcount`).
 */
export const hasSavedTeamMembers = (
  savedAllTeamData: AllTeamData,
  teamName: string,
  hierarchyLevel: keyof TeamConfiguration,
): boolean => {
  const team = savedAllTeamData[teamName];
  const global = savedAllTeamData.__GLOBAL__;

  return [team?.[hierarchyLevel], team?.defaults, global?.[hierarchyLevel], global?.defaults].some(
    (config) => config?.teamMembers != null,
  );
};

/**
 * Where a team's own X belongs: on the level that anchors its capacity, so a less specific X is
 * never read for a more specific unit — the scheduled level if the team defines capacity there,
 * otherwise its `defaults`.
 */
export const getCapacityLevel = (
  savedTeamData: TeamConfiguration | undefined,
  hierarchyLevel: keyof TeamConfiguration,
): keyof TeamConfiguration => (anchorsCapacity(savedTeamData?.[hierarchyLevel]) ? hierarchyLevel : 'defaults');

export const createTeamFieldLookup = (allTeamData: AllTeamData) => {
  return {
    getFieldFor: ({
      team = '__GLOBAL__',
      issueLevel = 'defaults',
      field,
    }: {
      team?: string;
      issueLevel?: string;
      field: Extract<keyof Configuration, `${string}Field`>;
    }) => {
      const teamData = allTeamData?.[team] ?? allTeamData.__GLOBAL__;
      const configuration = teamData?.[issueLevel] ?? teamData.defaults;
      const matchedField = configuration[field];

      if (!matchedField) {
        throw new Error(`How'd you get here?`);
      }

      return matchedField;
    },
  };
};
