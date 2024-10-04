export type TeamConfiguration = {
  sprintLength: number;
  velocityPerSprint: number;
  tracks: number;
  estimateField: string;
  confidenceField: string; //
  startDateField: string; //
  dueDateField: string; //
};

export const defaultGlobalTeamConfiguration: TeamConfiguration = {
  sprintLength: 10, //
  velocityPerSprint: 21, //
  tracks: 1,
  estimateField: "Estimate in Days",
  confidenceField: "Confidence",
  startDateField: "Start Date",
  dueDateField: "End Date",
};

export function isFieldUpdate(event: { name: string }): event is { name: keyof TeamConfiguration } {
  return [
    "sprintLength",
    "velocityPerSprint",
    "tracks",
    "estimateField",
    "confidenceField",
    "startDateField",
    "dueDateField",
  ].includes(event.name);
}
