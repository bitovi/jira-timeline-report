import type { NormalizeIssueConfig } from '../../../jira/normalized/normalize';
import type { CapacityOverrides } from './types';

/**
 * Wraps the two normalize getters the Auto-Scheduler's team row can change. Everything downstream
 * (`totalPointsPerDay`, `pointsPerDayPerTrack`, every derived duration) recomputes from these, so
 * this is the whole override mechanism.
 */
export function applyCapacityOverrides(
  base: Partial<NormalizeIssueConfig>,
  overrides: CapacityOverrides,
): Partial<NormalizeIssueConfig> {
  // Identity when nothing is overridden, so the shell can assign unconditionally without forcing a
  // re-derive on every render.
  if (Object.keys(overrides).length === 0) return base;

  return {
    ...base,
    getVelocity: (issue, config) => {
      const override = overrides[config!.getTeamKey(issue)]?.velocityPerSprint;
      return override ?? base.getVelocity!(issue, config);
    },
    getParallelWorkLimit: (issue, config) => {
      const override = overrides[config!.getTeamKey(issue)]?.tracks;
      return override ?? base.getParallelWorkLimit!(issue, config);
    },
  };
}
