import type { FC } from 'react';

import React, { Suspense } from 'react';
import DropdownMenu from '@atlaskit/dropdown-menu';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@sentry/react';

import Hr from '../../../components/Hr';
import { FilterRowsBuilder } from './components/FilterRowsBuilder';
import type { FilterFieldDefinition } from './components/FilterRowsBuilder';
import IssueTypeFilters from './components/IssueTypeFilters';
import DateRangeFilter from './components/DateRangeFilter';
import { useFilterRows } from './hooks/useFilterRows';
import { useSecondaryFilterRows } from './hooks/useSecondaryFilterRows';
import { useSecondaryChildFilterRows } from './hooks/useSecondaryChildFilterRows';
import { useSelectableRollupStatuses } from './hooks/useSelectableRollupStatuses';
import type { MinimalRollupIssue } from './hooks/useSelectableRollupStatuses';
import { useSelectableChildStatuses } from './hooks/useSelectableChildStatuses';
import type { MinimalChildStatusIssue } from './hooks/useSelectableChildStatuses';
import { useSelectableStatuses } from '../../../services/issues';
import { useFeatures } from '../../../services/features';
import { queryClient } from '../../../services/query';
import { StorageProvider } from '../../../services/storage';
import { useSelectedReleases } from './hooks/useSelectedReleases';
import { useShowOnlySemverReleases } from './hooks/useOnlySemverReleases';
import { useUnknownInitiatives } from './hooks/useUnknownInitiatives';
import { useSelectedIssueType } from '../../../services/issues/useSelectedIssueType';
import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import { useRouteData } from '../../../hooks/useRouteData/useRouteData';
import type { CanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import routeData from '../../../../canjs/routing/route-data';

export interface FiltersProps {
  /** All rolled-up issues/releases — used to compute Rollup Status filter option counts. */
  rolledupAndRolledBackIssuesAndReleasesObs?: CanObservable<MinimalRollupIssue[]>;
  /** The primary cards — used to derive the Work Breakdown child issue type/status options. */
  primaryIssuesOrReleasesObs?: CanObservable<MinimalChildStatusIssue[]>;
}

/**
 * `useFeatures()` (used to gate the secondary filter section) needs `QueryClientProvider`/
 * `StorageProvider`/`Suspense` ancestors that `ReportControls`'s standalone React root doesn't
 * otherwise provide — mirrors `ViewSettings.tsx`, the other `ReportControls` child that reads
 * feature flags.
 */
const FiltersInner: FC<FiltersProps> = ({ rolledupAndRolledBackIssuesAndReleasesObs, primaryIssuesOrReleasesObs }) => {
  const { selectedIssueType, isRelease } = useSelectedIssueType();
  const [primaryReportType] = usePrimaryReportType();
  const [secondaryReportType] = useRouteData<string>('secondaryReportType');
  const { secondaryReport } = useFeatures();

  const { filterRows, setFilterRows } = useFilterRows();
  const { filterRows: secondaryFilterRows, setFilterRows: setSecondaryFilterRows } = useSecondaryFilterRows();
  const { filterRows: secondaryChildFilterRows, setFilterRows: setSecondaryChildFilterRows } =
    useSecondaryChildFilterRows();
  const jiraStatusOptions = useSelectableStatuses();
  const rollupStatusOptions = useSelectableRollupStatuses(rolledupAndRolledBackIssuesAndReleasesObs);
  const { childType, statusOptions: childStatusOptions } = useSelectableChildStatuses(
    primaryIssuesOrReleasesObs,
    // Same underlying rolled-up issues as `rollupStatusOptions` above — just read through a
    // narrower duck-typed interface (`MinimalChildStatusIssue` needs `key`/`status`/
    // `reportingHierarchy`, which the real pipeline objects always carry alongside `rollupStatuses`).
    rolledupAndRolledBackIssuesAndReleasesObs as unknown as CanObservable<MinimalChildStatusIssue[]> | undefined,
  );

  const fieldDefinitions: FilterFieldDefinition[] = [
    { field: 'jiraStatus', label: 'Jira Status', operators: ['is', 'is not'], options: jiraStatusOptions },
    { field: 'rollupStatus', label: 'Rollup Status', operators: ['is', 'is not'], options: rollupStatusOptions },
  ];

  const childFieldDefinitions: FilterFieldDefinition[] = [
    { field: 'jiraStatus', label: 'Jira Status', operators: ['is', 'is not'], options: childStatusOptions },
    { field: 'rollupStatus', label: 'Rollup Status', operators: ['is', 'is not'], options: rollupStatusOptions },
  ];

  const hideUnknownInitiativesControls = useUnknownInitiatives();
  const showOnlySemverReleasesControls = useShowOnlySemverReleases();
  const releasesControls = useSelectedReleases();

  // The due-date range filter applies to the Scatter Plot ('due') and Gantt Chart ('start-due')
  // reports — see spec/004-scatter-improvements/date-range.md §6.
  const supportsDateRangeFilter = primaryReportType === 'due' || primaryReportType === 'start-due';

  const showSecondaryFilters =
    Boolean(secondaryReport) && Boolean(secondaryReportType) && secondaryReportType !== 'none';

  return (
    // Don't touch this id, its a hack to change the overflow of the dropdown menu
    <div id="filters-nested-modal-visibility-override">
      <DropdownMenu shouldRenderToParent trigger="Filters">
        <div className="p-6 w-[550px]">
          <p className="uppercase text-sm font-semibold text-zinc-800 pb-6">{selectedIssueType} Status Filtering</p>
          <FilterRowsBuilder rows={filterRows} onChange={setFilterRows} fieldDefinitions={fieldDefinitions} />
          <Hr className="my-6" />
          <IssueTypeFilters
            isRelease={isRelease}
            selectedIssueType={selectedIssueType}
            {...hideUnknownInitiativesControls}
            {...showOnlySemverReleasesControls}
            {...releasesControls}
          />
          {showSecondaryFilters && (
            <>
              <Hr className="my-6" />
              <p className="uppercase text-sm font-semibold text-zinc-800 pb-6">
                Secondary Report {selectedIssueType} Status Filtering
              </p>
              <FilterRowsBuilder
                rows={secondaryFilterRows}
                onChange={setSecondaryFilterRows}
                fieldDefinitions={fieldDefinitions}
              />
              <Hr className="my-6" />
              <p className="uppercase text-sm font-semibold text-zinc-800 pb-6">
                Secondary Report {childType} Status Filtering
              </p>
              <FilterRowsBuilder
                rows={secondaryChildFilterRows}
                onChange={setSecondaryChildFilterRows}
                fieldDefinitions={childFieldDefinitions}
              />
            </>
          )}
          {supportsDateRangeFilter && (
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

const Filters: FC<FiltersProps> = (props) => (
  <ErrorBoundary fallback={() => <></>}>
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <StorageProvider storage={routeData.storage}>
          <FiltersInner {...props} />
        </StorageProvider>
      </QueryClientProvider>
    </Suspense>
  </ErrorBoundary>
);

export default Filters;
