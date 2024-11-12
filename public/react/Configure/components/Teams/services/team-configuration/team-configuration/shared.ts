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

export type TeamConfiguration = Partial<Record<string, Configuration>> & {
  defaults: Configuration;
};

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

export const createEmptyTeamConfiguration = (issueTypes: string[]): TeamConfiguration => {
  return issueTypes.reduce(
    (config, issueType) => {
      return { ...config, [issueType]: createEmptyConfiguration() };
    },
    { defaults: createEmptyConfiguration() }
  );
};

export const createEmptyAllTeamsData = (issueTypes: string[] = []): AllTeamData => {
  return { __GLOBAL__: createEmptyTeamConfiguration(issueTypes) };
};
