import type { TeamCapacityOverride } from '../../../../services/capacity-overrides';

import { useCallback } from 'react';

import { useJiraIssueFields } from '../../../../services/jira';
import {
  createEmptyConfiguration,
  useAllTeamData,
  useSaveAllTeamData,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';
import { sanitizeAllTeamData } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/hooks/sanitizeAllTeamData';

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
  const { save, isSaving } = useSaveAllTeamData();

  const commit = useCallback(
    (team: string, values: TeamCapacityOverride) => {
      const saved = savedUserAllTeamData[team]?.defaults ?? createEmptyConfiguration();

      const configuration = {
        ...saved,
        ...(values.velocityPerSprint !== undefined ? { velocityPerSprint: values.velocityPerSprint } : {}),
        ...(values.tracks !== undefined ? { tracks: values.tracks } : {}),
      };

      save(sanitizeAllTeamData(savedUserAllTeamData, team, 'defaults', configuration));
    },
    [save, savedUserAllTeamData],
  );

  return { commit, isSaving };
};
