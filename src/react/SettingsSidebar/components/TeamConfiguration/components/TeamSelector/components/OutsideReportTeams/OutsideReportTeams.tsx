import type { FC } from 'react';
import type { TeamListItemProps } from '../TeamListItem/TeamListItem';

import React, { useState } from 'react';
import Button from '@atlaskit/button/new';

import TeamListItem from '../TeamListItem';

/** How many outside-report teams are shown per "Load more" click, and the cap on search results. */
export const OUTSIDE_REPORT_TEAMS_PAGE_SIZE = 10;

export interface OutsideReportTeamsProps {
  /** Already filtered by the caller's search when `isFiltered` is true. */
  teams: TeamListItemProps['team'][];
  isFiltered: boolean;
  selectedTeam: TeamListItemProps['selectedTeam'];
  setSelectedTeam: TeamListItemProps['setSelectedTeam'];
  pageSize?: number;
}

const OutsideReportTeams: FC<OutsideReportTeamsProps> = ({
  teams,
  isFiltered,
  selectedTeam,
  setSelectedTeam,
  pageSize = OUTSIDE_REPORT_TEAMS_PAGE_SIZE,
}) => {
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const visibleTeams = teams.slice(0, isFiltered ? pageSize : visibleCount);
  const canLoadMore = !isFiltered && visibleCount < teams.length;

  return (
    <div>
      {visibleTeams.map((team) => (
        <TeamListItem key={team.name} team={team} selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} />
      ))}
      {isFiltered && teams.length > pageSize && (
        <p className="mt-2 text-xs text-neutral-500">
          Showing {pageSize} of {teams.length} matches. Refine your search to narrow them down.
        </p>
      )}
      {canLoadMore && (
        <div className="mt-2">
          <Button shouldFitContainer onClick={() => setVisibleCount(visibleCount + pageSize)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
};

export default OutsideReportTeams;
