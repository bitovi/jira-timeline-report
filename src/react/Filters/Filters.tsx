import type { FC } from 'react';

import React from 'react';
import DropdownMenu from '@atlaskit/dropdown-menu';

import Hr from '../components/Hr';
import StatusFilter from './components/StatusFilter';
import IssueTypeFilters from './components/IssueTypeFilters';
import { useStatusFilters } from './hooks/useStatusFilters';
import { useSelectedReleases } from './hooks/useSelectedReleases';
import { useShowOnlySemverReleases } from './hooks/useOnlySemverReleases';
import { useUnknownInitiatives } from './hooks/useUnknownInitiatives';
import { useSelectedIssueType } from '../services/issues/useSelectedIssueType';

const Filters: FC = () => {
  const { selectedIssueType, isRelease } = useSelectedIssueType();

  const statusFilterControls = useStatusFilters();

  const hideUnknownInitiativesControls = useUnknownInitiatives();
  const showOnlySemverReleasesControls = useShowOnlySemverReleases();
  const releasesControls = useSelectedReleases();

  return (
    // Don't touch this id, its a hack to change the overflow of the dropdown menu
    <div id="filters-nested-modal-visibility-override">
      <DropdownMenu shouldRenderToParent trigger="Filters">
        <div className="p-6 w-[550px]">
          <p className="uppercase text-sm font-semibold text-zinc-800 pb-6">{selectedIssueType} statuses</p>
          <StatusFilter {...statusFilterControls} />
          <Hr className="my-6" />
          <IssueTypeFilters
            isRelease={isRelease}
            selectedIssueType={selectedIssueType}
            {...hideUnknownInitiativesControls}
            {...showOnlySemverReleasesControls}
            {...releasesControls}
          />
        </div>
      </DropdownMenu>
    </div>
  );
};

export default Filters;
