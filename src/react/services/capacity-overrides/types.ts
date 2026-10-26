/**
 * A session-only, uncommitted change to one team's scheduling inputs. Capacity is
 * `pointsPerPersonDay × teamMembers`, so headcount scales it for every unit. See
 * spec/040-update-team-estimation-settings/plan.md.
 */
export type TeamCapacityOverride = {
  /** X, estimate units per person per working day — set by a Story Points velocity edit or a re-anchor. */
  pointsPerPersonDay?: number;
  tracks?: number;
  teamMembers?: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type CapacityOverrides = Record<string, TeamCapacityOverride>;

/** One team's scheduling inputs as saved — the baseline an override is measured against. */
export type TeamCapacity = {
  pointsPerPersonDay: number;
  tracks: number;
  teamMembers: number;
};

/** Keyed by the team key `getTeamKey` returns for an issue. */
export type SavedTeamCapacities = Record<string, TeamCapacity>;
