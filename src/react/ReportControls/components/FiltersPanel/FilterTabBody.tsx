import type { FC, ReactNode } from 'react';

import React, { useId } from 'react';
import Select from '@atlaskit/select';
import Toggle from '@atlaskit/toggle';
import InfoIcon from '@atlaskit/icon/glyph/info';

import { FilterRowsBuilder, filterSelectProps } from '../Filters/components/FilterRowsBuilder';
import type { FilterFieldDefinition } from '../Filters/components/FilterRowsBuilder';
import DateRangeFilter from '../Filters/components/DateRangeFilter';
import { useLevelFilter } from '../Filters/hooks/useLevelFilter';
import type { FilterTab } from '../Filters/hooks/useFilterTabs';
import {
  useExcludableStatusOptions,
  useLevelIssueTypeOptions,
  useLevelRollupStatusOptions,
  useLevelStatusOptions,
} from '../Filters/hooks/useLevelOptions';
import type { MinimalLevelIssue } from '../Filters/hooks/useLevelOptions';
import { useSelectableReleases } from '../Filters/hooks/useSelectedReleases/useSelectedReleases';
import type { CanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import { useRouteData } from '../../../hooks/useRouteData';
import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import {
  ALL_LEVELS,
  dueDateRangeApplies,
  RELEASE_LEVEL,
  type HierarchyLevel,
  type LevelFilter,
} from '../../../../jira/rollup/filter-rows/level-filters';

const Section: FC<{ title: string; action?: ReactNode; children: ReactNode }> = ({ title, action, children }) => (
  // A rule between sections (not above the first), with the body's gap above it and padding below.
  <section className="flex flex-col gap-3 border-t border-neutral-41 pt-6 first-of-type:border-t-0 first-of-type:pt-0">
    <div className="flex min-h-5 items-baseline justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-801">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

/** Shown only while there is something to clear. */
const SectionClear: FC<{ label: string; disabled: boolean; onClick: () => void }> = ({ label, disabled, onClick }) =>
  disabled ? null : (
    <button
      type="button"
      className="text-sm font-medium text-blue-400 hover:underline"
      aria-label={label}
      onClick={onClick}
    >
      Clear
    </button>
  );

type Option = { label: string; value: string };

// Atlaskit's Toggle insets its track by 6px (margin, border and padding) on every side. Pull the row
// back so the track lines up with the section heading and spaces like the other sections' inputs.
const toggleRowClassName = 'flex items-center gap-2 -my-1.5 -ml-1.5';

export interface FilterTabBodyViewProps {
  tab: FilterTab;
  filter: LevelFilter;
  onChange: (filter: LevelFilter) => void;
  statusOptions: Option[];
  /** Empty above Report on, which hides the Rollup Status field. */
  rollupStatusOptions: Option[];
  issueTypeOptions: Option[];
  releaseOptions: Option[];
  /** False hides the Due date range section, for reports where this tab's range changes nothing. */
  showDueDateRange?: boolean;
  /**
   * Exclude statuses (`statusesToExclude`), shown on All items only. Unlike the field filters, it
   * removes issues before rollup, so they don't count toward their parents.
   */
  excludedStatuses?: string[];
  excludableStatusOptions?: Option[];
  onExcludedStatusesChange?: (statuses: string[]) => void;
}

/**
 * One Filters panel tab: field filters, options and the due-date range for a single level (or for
 * All items). Edits apply live. Presentation only; {@link FilterTabBody} connects it to route data.
 */
export const FilterTabBodyView: FC<FilterTabBodyViewProps> = ({
  tab,
  filter,
  onChange,
  statusOptions,
  rollupStatusOptions,
  issueTypeOptions,
  releaseOptions,
  showDueDateRange = true,
  excludedStatuses = [],
  excludableStatusOptions = [],
  onExcludedStatusesChange,
}) => {
  const hideWithoutDatesId = useId();
  const semverId = useId();
  const excludeId = useId();

  const isAll = tab.key === ALL_LEVELS;
  const isReleases = tab.key === RELEASE_LEVEL;
  const rows = filter.rows ?? [];

  // The first edit on a tab copies its legacy fallback (if any) into its own entry.
  const update = (changes: Partial<LevelFilter>) => onChange({ ...filter, rows, ...changes });

  const fieldDefinitions: FilterFieldDefinition[] = [
    { field: 'jiraStatus', label: 'Jira Status', operators: ['is', 'is not'], options: statusOptions },
    // Levels above Report on are never rolled up, so they have no rollup status to filter on.
    ...(rollupStatusOptions.length
      ? [
          {
            field: 'rollupStatus' as const,
            label: 'Rollup Status',
            operators: ['is', 'is not'] as FilterFieldDefinition['operators'],
            options: rollupStatusOptions,
          },
        ]
      : []),
    { field: 'issueType', label: 'Issue Type', operators: ['is', 'is not'], options: issueTypeOptions },
  ];

  const selectedReleases = (filter.releasesToShow ?? []).map((name) => ({ label: name, value: name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2 rounded bg-blue-101 px-3 py-2 text-sm text-neutral-800">
        <span className="shrink-0 text-blue-400">
          <InfoIcon label="" size="small" />
        </span>
        {isAll ? 'These filters apply to every issue type in the report.' : `These filters apply to ${tab.label}.`}
      </div>

      <Section
        title="Field filters"
        action={
          <SectionClear label="Clear field filters" disabled={rows.length === 0} onClick={() => update({ rows: [] })} />
        }
      >
        <FilterRowsBuilder
          rows={rows}
          onChange={(next) => update({ rows: next })}
          fieldDefinitions={fieldDefinitions}
        />
      </Section>

      <Section title="Options">
        {isReleases && (
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-800" htmlFor={`${semverId}-releases`}>
              Releases
            </label>
            <Select
              inputId={`${semverId}-releases`}
              isMulti
              isSearchable
              options={releaseOptions}
              value={selectedReleases}
              onChange={(options) => update({ releasesToShow: (options ?? []).map(({ value }) => value) })}
              {...filterSelectProps}
            />
          </div>
        )}
        <div className={toggleRowClassName}>
          <Toggle
            id={hideWithoutDatesId}
            isChecked={!!filter.hideWithoutDates}
            onChange={({ target }) => update({ hideWithoutDates: target.checked || undefined })}
          />
          <label className="text-sm text-neutral-800" htmlFor={hideWithoutDatesId}>
            Hide {isAll ? 'items' : tab.label} without dates
          </label>
        </div>
        {isReleases && (
          <div className={toggleRowClassName}>
            <Toggle
              id={semverId}
              isChecked={!!filter.showOnlySemverReleases}
              onChange={({ target }) => update({ showOnlySemverReleases: target.checked || undefined })}
            />
            <label className="text-sm text-neutral-800" htmlFor={semverId}>
              Limit to SemVer releases only
            </label>
          </div>
        )}
      </Section>

      {showDueDateRange && (
        <Section
          title="Due date range"
          action={
            <SectionClear
              label="Clear due date range"
              disabled={!filter.dueDateStart && !filter.dueDateEnd}
              onClick={() => update({ dueDateStart: undefined, dueDateEnd: undefined })}
            />
          }
        >
          <DateRangeFilter
            idPrefix={`filters-panel-${tab.key}-range`}
            hideHeading
            hideClear
            start={filter.dueDateStart ?? ''}
            end={filter.dueDateEnd ?? ''}
            onChange={(start, end) => update({ dueDateStart: start || undefined, dueDateEnd: end || undefined })}
          />
        </Section>
      )}

      {isAll && onExcludedStatusesChange && (
        <Section title="Exclude statuses">
          <p id={`${excludeId}-help`} className="text-sm text-neutral-801">
            Removes these issues before rollup, so they don&apos;t count toward their parents&apos; dates or progress.
          </p>
          <Select
            inputId={excludeId}
            aria-label="Exclude statuses"
            aria-describedby={`${excludeId}-help`}
            isMulti
            isSearchable
            placeholder="Select statuses"
            options={excludableStatusOptions}
            value={excludedStatuses.map((status) => ({ label: status, value: status }))}
            onChange={(options) => onExcludedStatusesChange((options ?? []).map(({ value }) => value))}
            {...filterSelectProps}
          />
        </Section>
      )}
    </div>
  );
};

interface FilterTabBodyProps {
  tab: FilterTab;
  rolledupAndRolledBackIssuesAndReleasesObs?: CanObservable<MinimalLevelIssue[]>;
}

/** {@link FilterTabBodyView} reading and writing this tab's `levelFilters` entry. */
const FilterTabBody: FC<FilterTabBodyProps> = ({ tab, rolledupAndRolledBackIssuesAndReleasesObs }) => {
  const { filter, setFilter } = useLevelFilter(tab.key);
  const [primaryReportType] = usePrimaryReportType();
  const [primaryIssueType] = useRouteData<string | undefined>('primaryIssueType');
  const [secondaryIssueType] = useRouteData<string | undefined>('secondaryIssueType');
  const [issueHierarchy] = useRouteData<HierarchyLevel[] | null>('issueHierarchy');
  const [statusesToExclude, setStatusesToExclude] = useRouteData<string[] | undefined, string[]>('statusesToExclude');
  return (
    <FilterTabBodyView
      tab={tab}
      filter={filter}
      onChange={setFilter}
      statusOptions={useLevelStatusOptions(tab.key)}
      rollupStatusOptions={useLevelRollupStatusOptions(tab.key, rolledupAndRolledBackIssuesAndReleasesObs)}
      issueTypeOptions={useLevelIssueTypeOptions(tab.key, rolledupAndRolledBackIssuesAndReleasesObs)}
      releaseOptions={useSelectableReleases()}
      showDueDateRange={dueDateRangeApplies(tab.key, {
        primaryIssueType,
        secondaryIssueType,
        issueHierarchy,
        primaryReportType,
      })}
      excludedStatuses={statusesToExclude ?? []}
      excludableStatusOptions={useExcludableStatusOptions()}
      onExcludedStatusesChange={setStatusesToExclude}
    />
  );
};

export default FilterTabBody;
