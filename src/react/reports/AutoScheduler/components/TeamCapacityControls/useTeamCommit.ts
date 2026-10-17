import type { TeamCapacityOverride } from '../../../../services/capacity-overrides';
import type { NormalizeIssueConfig } from '../../../../../jira/normalized/normalize';
import type {
  AllTeamData,
  Configuration,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';

import { useCallback, useRef } from 'react';
import { useIsMutating } from '@tanstack/react-query';

import { useCapacityOverrides } from '../../../../services/capacity-overrides';
import { useJiraIssueFields } from '../../../../services/jira';
import {
  createEmptyConfiguration,
  getCapacityLevel,
  resolveTeamConfiguration,
  useAllTeamData,
  useSaveAllTeamData,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';
import { pointsPerPersonDayForHeadcount } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';
import { sanitizeAllTeamData } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/hooks/sanitizeAllTeamData';
import { updateTeamConfigurationKeys } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/key-factory';

const CAPACITY_FIELDS = ['pointsPerPersonDay', 'tracks', 'teamMembers'] as const;

type CapacityField = (typeof CAPACITY_FIELDS)[number];

/**
 * Writes a team's what-if capacity (points per person per day, headcount) and tracks through to saved
 * team settings, using the same mutation the Teams sidebar uses.
 *
 * Headcount and tracks go wherever the team's own saved data already holds them: the scheduled
 * hierarchy level if the team set it there, otherwise the team's `defaults` — which is also where a
 * value inherited from `__GLOBAL__` lands, so one team's commit never changes another team's
 * capacity. X goes to the level that anchors the team's unit (`getCapacityLevel`), so it is never
 * read for a unit it wasn't written in. The fields can target different levels, so a commit may touch
 * both; nothing is ever removed from a level it is not targeting.
 *
 * A headcount committed while X is still derived also pins X at its current value, or the derived X
 * would follow the new headcount and the change would vanish on save. The AutoScheduler never
 * re-anchors: what was previewed — the same per-developer rate, a bigger team — is what gets saved.
 *
 * Uses `useSaveAllTeamData` rather than `useSaveTeamData`: the latter closes over its `teamName` at
 * render time, so a row that names its team and commits in the same tick would save the team named
 * by the previous render.
 */
export const useTeamCommit = () => {
  const jiraFields = useJiraIssueFields();
  const { savedUserAllTeamData } = useAllTeamData(jiraFields);
  const { onTeamDataSaved } = useCapacityOverrides();
  // `useSaveAllTeamData` runs `onUpdate` from `onSettled`, so it fires for a rejected write too, with
  // the configuration that was never saved. Park it here and let only `onSuccess` hand it to the
  // shell — otherwise a failed Commit leaves the shell deriving from a value storage never accepted.
  const savedConfig = useRef<Partial<NormalizeIssueConfig> | undefined>(undefined);
  const { save, isSaving } = useSaveAllTeamData({
    onUpdate: (config) => {
      savedConfig.current = config;
    },
  });
  // Each row owns its own mutation but `savedUserAllTeamData` is a render-time snapshot, so two
  // commits started before the first lands would each PUT the whole value and the later would win.
  // Counted globally rather than latched in the provider, so nothing stays stuck if a row unmounts
  // mid-write — and so a Teams-sidebar save blocks a commit too.
  const isWritingTeamData = useIsMutating({ mutationKey: updateTeamConfigurationKeys.allTeamData }) > 0;

  const commit = useCallback(
    (team: string, hierarchyLevel: number, values: TeamCapacityOverride, options?: { onSuccess?: () => void }) => {
      // The issue carries a number; `AllTeamData` keys its levels as numeric strings.
      const level = String(hierarchyLevel);
      const savedTeamData = savedUserAllTeamData[team];
      const written = withPinnedPointsPerPersonDay(values, () =>
        resolveTeamConfiguration(savedUserAllTeamData, jiraFields, team, level),
      );
      const changed = CAPACITY_FIELDS.filter((field) => written[field] !== undefined);

      const fieldsByTargetLevel = changed.reduce<Record<string, CapacityField[]>>((byLevel, field) => {
        const target =
          field === 'pointsPerPersonDay'
            ? String(getCapacityLevel(savedTeamData, level))
            : savedTeamData?.[level]?.[field] != null
              ? level
              : 'defaults';

        return { ...byLevel, [target]: [...(byLevel[target] ?? []), field] };
      }, {});

      // One pass per target level: `createUpdatedTeamData` replaces a level wholesale, so each pass
      // merges onto what that level already holds and feeds its result to the next.
      const allTeamData = Object.entries(fieldsByTargetLevel).reduce<AllTeamData>((data, [target, fields]) => {
        const saved = data[team]?.[target] ?? createEmptyConfiguration();

        const configuration: Configuration = {
          ...saved,
          ...Object.fromEntries(fields.map((field) => [field, written[field]])),
        };

        return sanitizeAllTeamData(data, team, target, configuration);
      }, savedUserAllTeamData);

      save(allTeamData, {
        onSuccess: () => {
          // Before the caller's own handler: it drops the override, which re-derives from this base.
          if (savedConfig.current) onTeamDataSaved?.(savedConfig.current);
          options?.onSuccess?.();
        },
        onSettled: () => {
          savedConfig.current = undefined;
        },
      });
    },
    [save, savedUserAllTeamData, jiraFields, onTeamDataSaved],
  );

  return { commit, isSaving, isBlocked: !isSaving && isWritingTeamData };
};

/** Adds the X a headcount commit needs to keep its effect, when the override doesn't carry one. */
function withPinnedPointsPerPersonDay(
  values: TeamCapacityOverride,
  resolve: () => Configuration,
): TeamCapacityOverride {
  if (values.teamMembers === undefined || values.pointsPerPersonDay !== undefined) return values;

  // "Has a saved headcount" means: pin a derived X, never re-anchor.
  const pointsPerPersonDay = pointsPerPersonDayForHeadcount(resolve(), values.teamMembers, true);

  return pointsPerPersonDay === undefined ? values : { ...values, pointsPerPersonDay };
}
