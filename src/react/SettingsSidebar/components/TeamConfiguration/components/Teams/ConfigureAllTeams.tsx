import type { FC } from 'react';
import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';
import type { IssueFields } from './services/team-configuration';

import React from 'react';

import { useSaveTeamData, useTeamData } from './services/team-configuration';
import { useFeatures } from '../../../../../services/features';

import AllTeamsDefaultForm from './AllTeamsDefaultsForm';
import ConfigureTeams from './ConfigureTeams';

export interface ConfigureAllTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  jiraFields: IssueFields;
}

const ConfigureAllTeams: FC<ConfigureAllTeamsProps> = ({ jiraFields, onUpdate, ...props }) => {
  const { savedUserTeamData, inheritedTeamData } = useTeamData('__GLOBAL__', jiraFields);
  const { estimationQuestions } = useFeatures();

  const { save } = useSaveTeamData({
    teamName: '__GLOBAL__',
    hierarchyLevel: 'defaults',
    onUpdate,
  });

  return (
    <ConfigureTeams
      jiraFields={jiraFields}
      teamName="__GLOBAL__"
      title="Global settings"
      defaultsLabel="Global Defaults"
      onUpdate={onUpdate}
      // The global defaults have nothing to inherit from, so they get the plain form.
      defaultsPanel={
        <AllTeamsDefaultForm
          save={save}
          savedUserData={savedUserTeamData.defaults}
          inheritedData={inheritedTeamData.defaults}
          jiraFields={jiraFields}
          showEstimationQuestions={!!estimationQuestions}
          {...props}
        />
      }
    />
  );
};

export default ConfigureAllTeams;
