import type { FC } from 'react';
import type { NormalizeIssueConfig } from '../../../../jira/normalized/normalize';
import type { CanObservable } from '../../../hooks/useCanObservable';

import React, { useState } from 'react';
import ArrowLeftCircleIcon from '@atlaskit/icon/glyph/arrow-left-circle';

import ConfigureTeams from './components/Teams';
import TeamSelector from './components/TeamSelector';
import SidebarButton from '../../../components/SidebarButton';
import ConfigureAllTeams from './components/Teams/ConfigureAllTeams';
import { useJiraIssueFields } from '../../../services/jira';
import { useAllTeamData } from './components/Teams/services/team-configuration';
import { StorageCheck } from '../../../services/storage';

export interface ConfigurationPanelProps {
  onBackButtonClicked: () => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  derivedIssuesObservable: CanObservable<Array<{ team: { name: string } }> | undefined>;
}

type TeamName = 'global' | (string & {});

const ConfigurationPanel: FC<ConfigurationPanelProps> = ({
  onBackButtonClicked,
  derivedIssuesObservable,
  ...configurationProps
}) => {
  const jiraFields = useJiraIssueFields();
  const { savedUserAllTeamData } = useAllTeamData(jiraFields);

  const [selectedTeam, setSelectedTeam] = useState<TeamName>('global');

  return (
    <div className="w-full h-full flex">
      <div className="w-60 border-r border-neutral-30 px-6 py-2 flex flex-col">
        <SidebarButton onClick={onBackButtonClicked}>
          <ArrowLeftCircleIcon label="go back" />
          Go back
        </SidebarButton>
        <TeamSelector
          teamsFromStorage={Object.keys(savedUserAllTeamData)}
          selectedTeam={selectedTeam}
          setSelectedTeam={setSelectedTeam}
          derivedIssuesObservable={derivedIssuesObservable}
        />
      </div>
      {/* checks that configuration issue exists */}
      <StorageCheck>
        {selectedTeam === 'global' && (
          <div className="w-128 overflow-auto">
            <ConfigureAllTeams jiraFields={jiraFields} {...configurationProps} />
          </div>
        )}
        {!!selectedTeam && selectedTeam !== 'global' && (
          <div key={selectedTeam} className="w-128 overflow-auto">
            <ConfigureTeams teamName={selectedTeam} jiraFields={jiraFields} {...configurationProps} />
          </div>
        )}
      </StorageCheck>
    </div>
  );
};

export default ConfigurationPanel;
