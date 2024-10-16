export type IssueFields = Array<{
  name: string;
  key: string;
  schema: Record<string, string>;
  id: string;
  custom: boolean;
  clauseNames: string[];
  searchable: boolean;
  navigable: boolean;
  orderable: boolean;
}>;

export type Configuration = {
  sprintLength: number | null;
  velocityPerSprint: number | null;
  tracks: number | null;
  estimateField: string | null;
  confidenceField: string | null;
  startDateField: string | null;
  dueDateField: string | null;
  spreadEffortAcrossDates: boolean | null;
};

export interface TeamConfiguration {
  defaults: Configuration;
  outcome: Configuration;
  milestones: Configuration;
  initiatives: Configuration;
  epics: Configuration;
  stories: Configuration;
}

export type AllTeamData = Partial<Record<string, TeamConfiguration>> & {
  __GLOBAL__: TeamConfiguration;
};

import type { AppStorage } from "../../../../../../jira/storage/common";

import { allTeamDataKey } from "./key-factory";

export const createEmptyConfiguration = (): Configuration => {
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

export const createEmptyTeamConfiguration = (): TeamConfiguration => {
  return {
    defaults: createEmptyConfiguration(),
    outcome: createEmptyConfiguration(),
    milestones: createEmptyConfiguration(),
    initiatives: createEmptyConfiguration(),
    epics: createEmptyConfiguration(),
    stories: createEmptyConfiguration(),
  };
};

export const createEmptyAllTeamsData = (): AllTeamData => {
  return { __GLOBAL__: createEmptyTeamConfiguration() };
};

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

const getTeamData = (teamName: string, allTeamData: AllTeamData): TeamConfiguration => {
  const teamData = allTeamData[teamName];

  if (!teamData) {
    return createEmptyTeamConfiguration();
  }

  return teamData;
};

// global field defaults
const createDefaultJiraFieldGetter = <TFormField extends keyof Configuration>(
  formField: TFormField,
  possibleNames: string[],
  nameFragments: string[] = []
) => {
  const findFieldCalled = (name: string, jiraFields: IssueFields): string | undefined => {
    return jiraFields.find((field) => field.name.toLowerCase() === name.toLowerCase())?.name;
  };

  return function (userData: Partial<Configuration>, jiraFields: IssueFields) {
    const userDefinedFieldExists = findFieldCalled((userData[formField] ?? "").toString(), jiraFields);

    if (userData?.[formField] && userDefinedFieldExists) {
      return userData[formField];
    }

    for (const possibleName of possibleNames) {
      const field = jiraFields.find(
        (field) => field.name === possibleName || field.name.toLowerCase() === possibleName.toLowerCase()
      );

      if (field) {
        return field.name;
      }
    }

    for (const fragment of nameFragments) {
      const field = jiraFields.find(({ name }) => name.toLowerCase().includes(fragment.toLowerCase()));

      if (field) {
        return field.name;
      }
    }

    return null;
  };
};

const getEstimateField = createDefaultJiraFieldGetter(
  "estimateField",
  ["story points median", "days median", "story points", "story point estimate"],
  ["median", "estimate"]
);

const getConfidenceField = createDefaultJiraFieldGetter(
  "confidenceField",
  ["Story points confidence", "Estimate confidence", "Days confidence"],
  ["confidence"]
);

const getStartDateField = createDefaultJiraFieldGetter("startDateField", ["start date", "starting date"]);

const getDueDateField = createDefaultJiraFieldGetter("dueDateField", ["due date", "end date", "target date"]);
const nonFieldDefaults: Omit<Configuration, "estimateField" | "confidenceField" | "startDateField" | "dueDateField"> = {
  sprintLength: 10,
  velocityPerSprint: 21,
  tracks: 1,
  spreadEffortAcrossDates: false,
};

export const getGlobalDefaultData = (allTeamData: AllTeamData, jiraFields: IssueFields): Configuration => {
  return {
    sprintLength: allTeamData.__GLOBAL__.defaults.sprintLength ?? nonFieldDefaults.sprintLength,
    velocityPerSprint: allTeamData.__GLOBAL__.defaults.velocityPerSprint ?? nonFieldDefaults.velocityPerSprint,
    tracks: allTeamData.__GLOBAL__.defaults.tracks ?? nonFieldDefaults.tracks,
    spreadEffortAcrossDates:
      allTeamData.__GLOBAL__.defaults.spreadEffortAcrossDates ?? nonFieldDefaults.spreadEffortAcrossDates,
    estimateField: getEstimateField(allTeamData.__GLOBAL__.defaults, jiraFields),
    confidenceField: getConfidenceField(allTeamData.__GLOBAL__.defaults, jiraFields),
    startDateField: getStartDateField(allTeamData.__GLOBAL__.defaults, jiraFields),
    dueDateField: getDueDateField(allTeamData.__GLOBAL__.defaults, jiraFields),
  };
};

export const applyGlobalDefaultData = (allTeamData: AllTeamData, jiraFields: IssueFields): AllTeamData => {
  return {
    ...allTeamData,
    __GLOBAL__: {
      ...allTeamData.__GLOBAL__,
      defaults: getGlobalDefaultData(allTeamData, jiraFields),
    },
  };
};

// Inheritance
export const getInheritedData = (teamName: keyof AllTeamData, allTeamData: AllTeamData): TeamConfiguration => {
  const teamData = getTeamData(teamName, allTeamData);

  const issueKeys = ["outcome", "milestones", "initiatives", "epics", "stories"] as const;
  type IssueType = (typeof issueKeys)[number];

  // Inheritance logic
  const getData = (issueType: IssueType, field: keyof Configuration): Configuration[keyof Configuration] => {
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
        const data = getData(issueType, key);

        return { ...fieldsAcc, [key]: data };
      }, {} as Configuration);

      return { ...config, [issueType]: issueFields };
    },
    { defaults: { ...teamData.defaults } } as TeamConfiguration
  );

  return inheritedConfig;
};

export const applyInheritance = (teamName: keyof AllTeamData, allTeamData: AllTeamData) => {
  return {
    ...allTeamData,
    [teamName]: getInheritedData(teamName, allTeamData),
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

export const updateAllTeamData = async (storage: AppStorage, updates: AllTeamData): Promise<void> => {
  return storage.update(allTeamDataKey, updates);
};
