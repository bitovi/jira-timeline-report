export type SprintDefaults = {
  sprintLength: number;
  velocityPerSprint: number;
  tracks: number;
};

export const defaultGlobalTeamConfiguration: SprintDefaults = {
  sprintLength: 10,
  velocityPerSprint: 21,
  tracks: 1,
};
