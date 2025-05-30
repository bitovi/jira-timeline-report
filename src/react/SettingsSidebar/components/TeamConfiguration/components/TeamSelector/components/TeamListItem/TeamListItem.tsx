import type { FC } from 'react';

import React from 'react';
import Badge from '@atlaskit/badge';
import PeopleGroupIcon from '@atlaskit/icon/glyph/people-group';
import ArrowRightCircleIcon from '@atlaskit/icon/glyph/arrow-right-circle';

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
      className="mt-2 items-center justify-center"
      isActive={selectedTeam === team.name}
      onClick={() => setSelectedTeam(team.name)}
    >
      <div className="[&>span]:!block">
        <PeopleGroupIcon label={`${team} settings`} />
      </div>
      <div className="flex-1 flex flex-col justify-between items-start">
        {team.name}
        {team.status === 'reportOnly' && <Badge>using defaults</Badge>}
      </div>
      {selectedTeam === team.name && <ArrowRightCircleIcon label={`${team} settings selected`} />}
    </SidebarButton>
  );
};

export default TeamListItem;
