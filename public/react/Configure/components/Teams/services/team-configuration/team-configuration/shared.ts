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
