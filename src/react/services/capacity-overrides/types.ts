/** A session-only, uncommitted change to one team's scheduling inputs. */
export type TeamCapacityOverride = {
  velocityPerSprint?: number;
  tracks?: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type CapacityOverrides = Record<string, TeamCapacityOverride>;
