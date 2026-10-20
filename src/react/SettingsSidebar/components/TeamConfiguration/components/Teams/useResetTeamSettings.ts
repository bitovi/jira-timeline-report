import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';
import type { AllTeamData, TeamConfiguration } from './services/team-configuration';
import type { TeamDataCache } from './services/team-configuration';

import { useQueryClient } from '@tanstack/react-query';

import {
  createEmptyConfiguration,
  updateTeamConfigurationKeys,
  useSaveAllTeamData,
} from './services/team-configuration';
import { sanitizeAllTeamData } from './services/team-configuration/hooks/sanitizeAllTeamData';

/** Drops one level of a team's saved settings, so every field there inherits again. */
export const resetLevel = (allTeamData: AllTeamData, teamName: string, level: keyof TeamConfiguration) =>
  // `sanitizeAllTeamData` drops the emptied level, and the team too if nothing else is left.
  sanitizeAllTeamData(allTeamData, teamName, level, createEmptyConfiguration());

/** Drops everything a team saved, so it inherits the global settings at every level. */
export const resetTeam = (allTeamData: AllTeamData, teamName: string): AllTeamData =>
  Object.fromEntries(Object.entries(allTeamData).filter(([name]) => name !== teamName)) as AllTeamData;

/**
 * Resets a team's settings, one level or all of them. Builds from the cached saved data at click
 * time, as `useSaveTeamData` does, rather than from a render-time snapshot a form save may have
 * already replaced.
 */
export const useResetTeamSettings = (
  teamName: string,
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void,
) => {
  const queryClient = useQueryClient();
  const { save, isSaving } = useSaveAllTeamData({ onUpdate });

  const withSavedData = (reset: (allTeamData: AllTeamData) => AllTeamData) => {
    const cached = queryClient.getQueryData<TeamDataCache>(updateTeamConfigurationKeys.allTeamData);

    if (!cached) {
      console.warn('Could not reset without all team data');
      return;
    }

    save(reset(cached.savedUserData));
  };

  return {
    isSaving,
    resetLevel: (level: keyof TeamConfiguration) => withSavedData((data) => resetLevel(data, teamName, level)),
    resetTeam: () => withSavedData((data) => resetTeam(data, teamName)),
  };
};
