import type { FC } from 'react';
import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';
import type { IssueFields } from './services/team-configuration';

import React from 'react';

import { createEmptyConfiguration, useSaveTeamData, useTeamData } from './services/team-configuration';

import AllTeamsDefaultForm from './AllTeamsDefaultsForm';
import ConfigureTeams from './ConfigureTeams';

export interface ConfigureAllTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  jiraFields: IssueFields;
}

const ConfigureAllTeams: FC<ConfigureAllTeamsProps> = ({ jiraFields, onUpdate, ...props }) => {
  const { savedUserTeamData, inheritedTeamData } = useTeamData('__GLOBAL__', jiraFields);

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
          // Saving drops empty levels, so global settings saved only per type have no `defaults`.
          savedUserData={savedUserTeamData.defaults ?? createEmptyConfiguration()}
          inheritedData={inheritedTeamData.defaults}
          jiraFields={jiraFields}
          {...props}
        />
      }
    />
  );
};

export default ConfigureAllTeams;
