import type { FC } from 'react';

import React from 'react';

import CustomSettingsDot from '../../../CustomSettingsDot';
import SidebarButton from '../../../../../../../components/SidebarButton';

export interface TeamListItemProps {
  team: {
    name: string;
    status: 'reportOnly' | 'storageOnly' | 'storageAndReport';
  };
  selectedTeam: 'global' | (string & {});
  setSelectedTeam: (team: string) => void;
}

const TeamListItem: FC<TeamListItemProps> = ({ team, selectedTeam, setSelectedTeam }) => {
  return (
    <SidebarButton
      key={team.name}
      className="mt-0.5 !py-1 min-h-8 items-center"
      isActive={selectedTeam === team.name}
      // The highlight shows the selection; this tells a screen reader.
      aria-current={selectedTeam === team.name || undefined}
      onClick={() => setSelectedTeam(team.name)}
    >
      <div className="flex-1 min-w-0 break-words">{team.name}</div>
      {/* In the report with saved settings. Every team outside the report has saved settings — that is
          why it is listed — so a dot there would say nothing. */}
      {team.status === 'storageAndReport' && <CustomSettingsDot className="mr-1" />}
    </SidebarButton>
  );
};

export default TeamListItem;
