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
import { useCardsChildFilterRows } from './hooks/useCardsChildFilterRows';
import { useSelectableRollupStatuses } from './hooks/useSelectableRollupStatuses';
import type { MinimalRollupIssue } from './hooks/useSelectableRollupStatuses';
import { useSelectableChildStatuses } from './hooks/useSelectableChildStatuses';
import type { MinimalChildStatusIssue } from './hooks/useSelectableChildStatuses';
import { useSelectableStatuses } from '../../../services/issues';
import { queryClient } from '../../../services/query';
import { StorageProvider } from '../../../services/storage';
import { useSelectedReleases } from './hooks/useSelectedReleases';
import { useShowOnlySemverReleases } from './hooks/useOnlySemverReleases';
import { useUnknownInitiatives } from './hooks/useUnknownInitiatives';
import { useDateRangeFilter } from './hooks/useDateRangeFilter';
import { useReportOnLevelKey } from './hooks/useLevelFilter';
import { useLevelIssueTypeOptions } from './hooks/useLevelOptions';
import FiltersPanel from '../FiltersPanel';
import { useFeatures } from '../../../services/features';
import { useSelectedIssueType } from '../../../services/issues/useSelectedIssueType';
import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import type { CanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import routeData from '../../../../canjs/routing/route-data';

export interface FiltersProps {
  /** All rolled-up issues/releases — used to compute Rollup Status filter option counts. */
  rolledupAndRolledBackIssuesAndReleasesObs?: CanObservable<MinimalRollupIssue[]>;
  /** The primary cards — used to derive the Cards report's child issue type/status options. */
  primaryIssuesOrReleasesObs?: CanObservable<MinimalChildStatusIssue[]>;
}

/**
 * The hooks below (`useSelectableStatuses` and friends) need `QueryClientProvider`/
 * `StorageProvider`/`Suspense` ancestors that `ReportControls`'s standalone React root doesn't
 * otherwise provide — mirrors `ViewSettings.tsx`, the other `ReportControls` child in the same
 * position.
 */
const FiltersInner: FC<FiltersProps> = ({ rolledupAndRolledBackIssuesAndReleasesObs, primaryIssuesOrReleasesObs }) => {
  const { selectedIssueType, isRelease } = useSelectedIssueType();
  const [primaryReportType] = usePrimaryReportType();

  const { filterRows, setFilterRows } = useFilterRows();
  const { filterRows: cardsChildFilterRows, setFilterRows: setCardsChildFilterRows } = useCardsChildFilterRows();
  const jiraStatusOptions = useSelectableStatuses();
  const issueTypeOptions = useLevelIssueTypeOptions(
    useReportOnLevelKey() ?? '',
    rolledupAndRolledBackIssuesAndReleasesObs,
  );
  const dateRange = useDateRangeFilter();
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
    { field: 'issueType', label: 'Issue Type', operators: ['is', 'is not'], options: issueTypeOptions },
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

  // Only the Cards report renders child rows inside each card, so it is the only report the second
  // filter list means anything for. See spec/018-card-report/alt-plan.md.
  const showCardsChildFilters = primaryReportType === 'cards';

  return (
    // Don't touch this id, its a hack to change the overflow of the dropdown menu
    <div id="filters-nested-modal-visibility-override">
      <DropdownMenu shouldRenderToParent trigger="Filters">
        <div className="p-6 w-[550px]">
          <div className="flex items-baseline justify-between pb-6">
            <p className="uppercase text-sm font-semibold text-zinc-800">{selectedIssueType} Status Filtering</p>
            <ClearLink disabled={filterRows.length === 0} onClick={() => setFilterRows([])} />
          </div>
          <FilterRowsBuilder rows={filterRows} onChange={setFilterRows} fieldDefinitions={fieldDefinitions} />
          <Hr className="my-6" />
          <IssueTypeFilters
            isRelease={isRelease}
            selectedIssueType={selectedIssueType}
            {...hideUnknownInitiativesControls}
            {...showOnlySemverReleasesControls}
            {...releasesControls}
          />
          {showCardsChildFilters && (
            <>
              <Hr className="my-6" />
              <div className="flex items-baseline justify-between pb-6">
                <p className="uppercase text-sm font-semibold text-zinc-800">Card {childType} Status Filtering</p>
                <ClearLink disabled={cardsChildFilterRows.length === 0} onClick={() => setCardsChildFilterRows([])} />
              </div>
              <FilterRowsBuilder
                rows={cardsChildFilterRows}
                onChange={setCardsChildFilterRows}
                fieldDefinitions={childFieldDefinitions}
              />
            </>
          )}
          {supportsDateRangeFilter && (
            <>
              <Hr className="my-6" />
              <DateRangeFilter
                start={dateRange.dateRangeStart}
                end={dateRange.dateRangeEnd}
                onChange={dateRange.applyPreset}
              />
            </>
          )}
        </div>
      </DropdownMenu>
    </div>
  );
};

const ClearLink: FC<{ disabled: boolean; onClick: () => void }> = ({ disabled, onClick }) => (
  <button
    type="button"
    className="text-sm font-medium text-blue-400 hover:underline disabled:text-neutral-100 disabled:no-underline"
    disabled={disabled}
    onClick={onClick}
  >
    Clear
  </button>
);

/** `useFeatures` suspends and needs storage, so the flag is read inside the providers below. */
const FiltersEntry: FC<FiltersProps> = (props) => {
  const { filtersPanel } = useFeatures();
  return filtersPanel ? <FiltersPanel {...props} /> : <FiltersInner {...props} />;
};

const Filters: FC<FiltersProps> = (props) => (
  <ErrorBoundary fallback={() => <></>}>
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <StorageProvider storage={routeData.storage}>
          <FiltersEntry {...props} />
        </StorageProvider>
      </QueryClientProvider>
    </Suspense>
  </ErrorBoundary>
);

export default Filters;
