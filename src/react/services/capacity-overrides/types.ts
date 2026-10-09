/** A session-only, uncommitted change to one team's scheduling inputs. */
export type TeamCapacityOverride = {
  velocityPerSprint?: number;
  tracks?: number;
  /** Dev Days teams only: their capacity is their headcount. See spec/040-update-team-estimation-settings. */
  teamMembers?: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type CapacityOverrides = Record<string, TeamCapacityOverride>;

/** One team's scheduling inputs as saved — the baseline an override is measured against. */
export type TeamCapacity = {
  velocityPerSprint: number;
  tracks: number;
  /** Only for a Dev Days team. */
  teamMembers?: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type SavedTeamCapacities = Record<string, TeamCapacity>;
