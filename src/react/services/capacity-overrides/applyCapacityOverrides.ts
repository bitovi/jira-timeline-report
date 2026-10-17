import type { NormalizeIssueConfig } from '../../../jira/normalized/normalize';
import type { CapacityOverrides } from './types';

import {
  getDaysPerSprintDefault,
  getPointsPerPersonDayDefault,
  getTeamMembersDefault,
} from '../../../jira/normalized/defaults';

/**
 * Wraps the normalize getters the Auto-Scheduler's team row can change. Everything downstream
 * (`totalPointsPerDay`, `pointsPerDayPerTrack`, every derived duration) recomputes from these, so
 * this is the whole override mechanism.
 *
 * Velocity is `X × N × P` for every unit, with X and N taken from the override where it has them.
 */
export function applyCapacityOverrides(
  base: Partial<NormalizeIssueConfig>,
  overrides: CapacityOverrides,
): Partial<NormalizeIssueConfig> {
  // Identity when nothing is overridden, so the shell can assign unconditionally without forcing a
  // re-derive on every render.
  if (Object.keys(overrides).length === 0) return base;

  const getPointsPerPersonDay = base.getPointsPerPersonDay ?? getPointsPerPersonDayDefault;
  const getTeamMembers = base.getTeamMembers ?? getTeamMembersDefault;
  const getDaysPerSprint = base.getDaysPerSprint ?? getDaysPerSprintDefault;

  return {
    ...base,
    getVelocity: (issue, config) => {
      const override = overrides[config!.getTeamKey(issue)];

      if (override?.pointsPerPersonDay === undefined && override?.teamMembers === undefined) {
        return base.getVelocity!(issue, config);
      }

      return (
        (override.pointsPerPersonDay ?? getPointsPerPersonDay(issue, config)) *
        (override.teamMembers ?? getTeamMembers(issue, config)) *
        getDaysPerSprint(issue, config)
      );
    },
    getPointsPerPersonDay: (issue, config) => {
      return overrides[config!.getTeamKey(issue)]?.pointsPerPersonDay ?? getPointsPerPersonDay(issue, config);
    },
    getTeamMembers: (issue, config) => {
      return overrides[config!.getTeamKey(issue)]?.teamMembers ?? getTeamMembers(issue, config);
    },
    getParallelWorkLimit: (issue, config) => {
      const override = overrides[config!.getTeamKey(issue)]?.tracks;
      return override ?? base.getParallelWorkLimit!(issue, config);
    },
  };
}
