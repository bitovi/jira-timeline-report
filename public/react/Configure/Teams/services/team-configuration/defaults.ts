export type SprintDefaults = {
  sprintLength: number;
  velocityPerSprint: number;
  tracks: number;
  estimateInDays: number;
  estimateField: string;
};

export const defaultGlobalTeamConfiguration: SprintDefaults = {
  sprintLength: 10,
  velocityPerSprint: 21,
  tracks: 1,
  estimateInDays: 10,
  estimateField: "Estimate in Days",
};
