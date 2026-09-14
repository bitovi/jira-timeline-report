import type { TeamCapacityOverride } from '../../../../services/capacity-overrides';
import type {
  AllTeamData,
  Configuration,
  TeamConfiguration,
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
 * Targets the team's `defaults` rather than a specific hierarchy level: the Auto-Scheduler shows one
 * capacity per team, and `applyInheritance` propagates `defaults` down to every level.
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
    (team: string, values: TeamCapacityOverride, options?: { onSuccess?: () => void }) => {
      const saved = savedUserAllTeamData[team]?.defaults ?? createEmptyConfiguration();
      const changed = CAPACITY_FIELDS.filter((field) => values[field] !== undefined);

      const configuration: Configuration = {
        ...saved,
        ...Object.fromEntries(changed.map((field) => [field, values[field]])),
      };

      const allTeamData = clearLevelSpecificValues(savedUserAllTeamData, team, changed);

      save(sanitizeAllTeamData(allTeamData, team, 'defaults', configuration), { onSuccess: options?.onSuccess });
    },
    [save, savedUserAllTeamData],
  );

  return { commit, isSaving };
};

/**
 * `createNormalizeConfiguration` resolves `allData[team][hierarchyLevel]` after inheritance, so a
 * value set from the Teams sidebar's per-level panel out-ranks the `defaults` a commit writes and
 * would make the commit a silent no-op.
 */
function clearLevelSpecificValues(
  allTeamData: AllTeamData,
  team: string,
  fields: ReadonlyArray<CapacityField>,
): AllTeamData {
  const teamConfiguration = allTeamData[team];

  if (!teamConfiguration || fields.length === 0) return allTeamData;

  const cleared = Object.fromEntries(
    Object.entries(teamConfiguration).map(([level, configuration]) => {
      if (level === 'defaults' || !configuration) return [level, configuration];

      // `sanitizeAllTeamData` strips nulls, so this removes the value rather than storing a null.
      return [level, { ...configuration, ...Object.fromEntries(fields.map((field) => [field, null])) }];
    }),
  ) as TeamConfiguration;

  return { ...allTeamData, [team]: cleared };
}
