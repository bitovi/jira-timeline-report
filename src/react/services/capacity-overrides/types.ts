/** A session-only, uncommitted change to one team's scheduling inputs. */
export type TeamCapacityOverride = {
  velocityPerSprint?: number;
  tracks?: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type CapacityOverrides = Record<string, TeamCapacityOverride>;

/** One team's scheduling inputs as saved — the baseline an override is measured against. */
export type TeamCapacity = {
  velocityPerSprint: number;
  tracks: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type SavedTeamCapacities = Record<string, TeamCapacity>;
