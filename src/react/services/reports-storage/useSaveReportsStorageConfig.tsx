import type { ReportsStorageConfig } from '../../../jira/storage/reports-config';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setReportsStorageConfig } from '../../../jira/reports/backend';
import { writeReportsStorageConfig } from '../../../jira/storage/reports-config';
import { configurationIssueTitle } from '../../../shared/configurationIssue';
import { useJira } from '../jira';
import { useStorage } from '../storage';
import { reportKeys } from '../reports/key-factory';
import { reportsStorageKeys } from './key-factory';

/**
 * Confirms the space exists and is reachable *before* the pointer is written to it. Without this,
 * the first thing a typo does is empty the report list — the pointer would be saved, the search for
 * reports in a space that isn't there would come back with nothing, and the reports would look gone
 * (they aren't; the legacy record is never touched).
 */
const assertSpaceIsReachable = async (
  fetchJiraProject: (key: string) => Promise<unknown>,
  spaceName: string,
): Promise<void> => {
  try {
    await fetchJiraProject(spaceName);
  } catch (error) {
    console.warn(`[reports/storage] could not reach the space "${spaceName}"`, error);

    throw new Error(
      `Could not find a space with the key "${spaceName}". Check the key and that you have access to it.`,
    );
  }
};

/**
 * Writes the pointer, then points this session at the new store.
 *
 * The order matters on failure: nothing local changes until Jira has accepted the write, so a failed
 * save leaves the app reading exactly where it was.
 */
export const useSaveReportsStorageConfig = () => {
  const storage = useStorage();
  const jira = useJira();
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, error, reset } = useMutation({
    mutationFn: async (config: ReportsStorageConfig) => {
      if (config.kind === 'space') {
        await assertSpaceIsReachable(jira.fetchJiraProject, config.spaceName);
      }

      // This setting is itself a setting, so it lands wherever the app keeps those — on the web build
      // that is a Jira issue which may not exist yet. Checked up front because the raw failure from
      // that store is `[Storage Error]: update (web-app) needs a configuration issue`, which tells a
      // user nothing about what to go and do.
      if (!(await storage.storageInitialized())) {
        throw new Error(
          `Settings are stored in a Jira issue titled "${configurationIssueTitle()}", and this site doesn't have one yet. Create it, then set where reports are stored.`,
        );
      }

      await writeReportsStorageConfig(storage, config);
      setReportsStorageConfig(config);

      return config;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reportsStorageKeys.config() });
      // The reports themselves now come from somewhere else, so nothing cached about them holds.
      void queryClient.invalidateQueries({ queryKey: reportKeys.allReports });
    },
  });

  return { save: mutate, saveAsync: mutateAsync, isSaving: isPending, error, reset };
};
