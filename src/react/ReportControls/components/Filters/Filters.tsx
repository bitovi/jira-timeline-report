import type { FC } from 'react';

import React from 'react';
import DropdownMenu from '@atlaskit/dropdown-menu';

import Hr from '../../../components/Hr';
import StatusFilter from './components/StatusFilter';
import IssueTypeFilters from './components/IssueTypeFilters';
import DateRangeFilter from './components/DateRangeFilter';
import { useStatusFilters } from './hooks/useStatusFilters';
import { useSelectedReleases } from './hooks/useSelectedReleases';
import { useShowOnlySemverReleases } from './hooks/useOnlySemverReleases';
import { useUnknownInitiatives } from './hooks/useUnknownInitiatives';
import { useSelectedIssueType } from '../../../services/issues/useSelectedIssueType';
import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';

const Filters: FC = () => {
  const { selectedIssueType, isRelease } = useSelectedIssueType();
  const [primaryReportType] = usePrimaryReportType();

  const statusFilterControls = useStatusFilters();

  const hideUnknownInitiativesControls = useUnknownInitiatives();
  const showOnlySemverReleasesControls = useShowOnlySemverReleases();
  const releasesControls = useSelectedReleases();

  // The due-date range filter only applies to the Scatter Plot ('due' report) today — see
  // spec/004-scatter-improvements/date-range.md §6 (Gantt reuse is a planned future step).
  const isScatterPlot = primaryReportType === 'due';

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
          {isScatterPlot && (
            <>
              <Hr className="my-6" />
              <DateRangeFilter />
            </>
          )}
        </div>
      </DropdownMenu>
    </div>
  );
};

export default Filters;
