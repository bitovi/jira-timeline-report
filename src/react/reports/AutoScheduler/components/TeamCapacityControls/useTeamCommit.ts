import type { TeamCapacityOverride } from '../../../../services/capacity-overrides';
import type {
  AllTeamData,
  Configuration,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';

import { useCallback } from 'react';

import { useCapacityOverrides } from '../../../../services/capacity-overrides';
import { useJiraIssueFields } from '../../../../services/jira';
import {
  createEmptyConfiguration,
  useAllTeamData,
  useSaveAllTeamData,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';
import { sanitizeAllTeamData } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/hooks/sanitizeAllTeamData';

const CAPACITY_FIELDS = ['velocityPerSprint', 'tracks'] as const;

type CapacityField = (typeof CAPACITY_FIELDS)[number];

/**
 * Writes a team's what-if capacity and tracks through to saved team settings, using the same
 * mutation the Teams sidebar uses.
 *
 * Writes each field to wherever the team's own saved data already holds it: the scheduled hierarchy
 * level if the team set it there, otherwise the team's `defaults` — which is also where a value
 * inherited from `__GLOBAL__` lands, so one team's commit never changes another team's capacity.
 * The two fields can target different levels, so a commit may touch both; nothing is ever removed
 * from a level it is not targeting.
 *
 * Uses `useSaveAllTeamData` rather than `useSaveTeamData`: the latter closes over its `teamName` at
 * render time, so a row that names its team and commits in the same tick would save the team named
 * by the previous render.
 */
export const useTeamCommit = () => {
  const jiraFields = useJiraIssueFields();
  const { savedUserAllTeamData } = useAllTeamData(jiraFields);
  const { onTeamDataSaved } = useCapacityOverrides();
  // Without this seam the shell keeps deriving from the pre-commit configuration, so dropping the
  // override after a successful save snaps the plan back to the old capacity until a reload.
  const { save, isSaving } = useSaveAllTeamData({ onUpdate: onTeamDataSaved });

  const commit = useCallback(
    (team: string, hierarchyLevel: number, values: TeamCapacityOverride, options?: { onSuccess?: () => void }) => {
      // The issue carries a number; `AllTeamData` keys its levels as numeric strings.
      const level = String(hierarchyLevel);
      const savedTeamData = savedUserAllTeamData[team];
      const changed = CAPACITY_FIELDS.filter((field) => values[field] !== undefined);

      const fieldsByTargetLevel = changed.reduce<Record<string, CapacityField[]>>((byLevel, field) => {
        const target = savedTeamData?.[level]?.[field] != null ? level : 'defaults';

        return { ...byLevel, [target]: [...(byLevel[target] ?? []), field] };
      }, {});

      // One pass per target level: `createUpdatedTeamData` replaces a level wholesale, so each pass
      // merges onto what that level already holds and feeds its result to the next.
      const allTeamData = Object.entries(fieldsByTargetLevel).reduce<AllTeamData>((data, [target, fields]) => {
        const saved = data[team]?.[target] ?? createEmptyConfiguration();

        const configuration: Configuration = {
          ...saved,
          ...Object.fromEntries(fields.map((field) => [field, values[field]])),
        };

        return sanitizeAllTeamData(data, team, target, configuration);
      }, savedUserAllTeamData);

      save(allTeamData, { onSuccess: options?.onSuccess });
    },
    [save, savedUserAllTeamData],
  );

  return { commit, isSaving };
};
