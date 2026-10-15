import { useMemo } from 'react';

import { useJiraIssueFields } from '../../../../services/jira';
import {
  resolveTeamConfiguration,
  useAllTeamData,
} from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration';
import { fieldLabelFor } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

/**
 * What the team row needs from saved settings that the normalized issue doesn't carry: the resolved
 * configuration and the Estimate Field's display name, which labels every capacity number.
 */
export const useTeamSettings = (team: string, hierarchyLevel: number) => {
  const jiraFields = useJiraIssueFields();
  const { savedUserAllTeamData } = useAllTeamData(jiraFields);

  return useMemo(() => {
    const level = String(hierarchyLevel);
    const config = resolveTeamConfiguration(savedUserAllTeamData, jiraFields, team, level);
    // A name-colliding field is stored by id (spec/015-field-selection).
    const fieldName = jiraFields.find((field) => field.id === config.estimateField)?.name ?? config.estimateField;

    return {
      config,
      fieldLabel: fieldLabelFor(fieldName),
    };
  }, [savedUserAllTeamData, jiraFields, team, hierarchyLevel]);
};
