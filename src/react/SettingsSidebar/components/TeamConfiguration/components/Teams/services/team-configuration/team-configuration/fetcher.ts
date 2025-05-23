/**
 * Handles data retrieval and updating from storage
 */

import type { AppStorage } from '../../../../../../../../../jira/storage/common';
import type { AllTeamData, IssueFields, TeamConfiguration } from './shared';

import { allTeamDataKey } from '../key-factory';
import { createEmptyAllTeamsData, createEmptyTeamConfiguration } from './shared';

export const getAllTeamData = async (storage: AppStorage, issueTypes: string[] = []): Promise<AllTeamData> => {
  const data = await storage.get<AllTeamData>(allTeamDataKey);

  if (!data) {
    return createEmptyAllTeamsData(issueTypes);
  }

  if (Object.keys(data).length === 0) {
    return createEmptyAllTeamsData(issueTypes);
  }

  return data;
};

export const getTeamData = (teamName: string, allTeamData: AllTeamData): TeamConfiguration => {
  const teamData = allTeamData[teamName];

  if (!teamData) {
    return createEmptyTeamConfiguration(Object.keys(allTeamData.__GLOBAL__));
  }

  return teamData;
};

export const updateAllTeamData = async (storage: AppStorage, updates: AllTeamData): Promise<void> => {
  await storage.update(allTeamDataKey, updates);
};

/**
 * Jira fields might be removed in between app loads.
 * Since we don't know when that happens this function checks the stored
 * user data against the existing jiraIssues and normalizes the user data.
 *
 * If it finds mismatches it will attempt to update the configuration issue.
 * The results of this request are ultimately ignore since we are returning the
 * normalized data to the UI already and if it fails we will retry on next request.
 */
export const fixAnyNonExistingFields = (storage: AppStorage, userData: AllTeamData, jiraIssues: IssueFields) => {
  const fieldExistMap: Record<string, boolean> = {
    'confidence-not-used': true,
  };

  let normalizedTeamData = structuredClone(userData);

  for (const [teamKey, team] of Object.entries(userData)) {
    if (!team) {
      continue;
    }

    for (const [issueHierarchyKey, configuration] of Object.entries(team)) {
      if (!configuration) {
        continue;
      }

      for (const fieldName of ['confidenceField', 'estimateField', 'startDateField', 'dueDateField'] as const) {
        const field = configuration[fieldName];

        if (!field) {
          continue;
        }

        if (fieldExistMap[field]) {
          continue;
        }

        const matched = jiraIssues.find((issue) => {
          return issue.name === field;
        });

        if (matched) {
          fieldExistMap[field] = true;
        } else {
          console.log(`Detected a discrepancy between jiraFields and userData field "${field}" does not exist`);

          delete normalizedTeamData?.[teamKey]?.[issueHierarchyKey]?.[fieldName];
        }
      }
    }
  }

  if (JSON.stringify(userData) !== JSON.stringify(normalizedTeamData)) {
    updateAllTeamData(storage, normalizedTeamData)
      .then(() => console.log('Resolved discrepancies with the data source'))
      .catch((error) =>
        console.log(
          [
            'Could not update the data source',
            'users will not be impacted',
            `error: ${error?.message || 'could not parse error'}`,
          ].join('\n'),
        ),
      );
  }

  return normalizedTeamData;
};
