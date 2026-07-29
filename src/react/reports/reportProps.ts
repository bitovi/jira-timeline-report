// @ts-ignore - can.js has loose types
import { value } from '../../can';

/**
 * The report prop bag, built from a derived-data pipeline (`vm`) and a config source (`config`).
 *
 * Extracted from `TimelineReport` so the shell and each embedded child build an *identical* bag
 * from *different* sources: the shell passes the global `routeData`, a child passes its own
 * `ChildReportConfig`. Reports themselves are unchanged — they still receive the same `*Obs`
 * observables. See spec/016-report-of-reports Phase 2.
 *
 * `config` must expose the same property names `routeData` does; anything it doesn't define simply
 * observes as `undefined`, exactly as a missing URL param does today.
 */
export const propsFor = (vm: any, config: any) => ({
  primaryIssuesOrReleasesObs: value.from(vm, 'primaryIssuesOrReleases'),
  allIssuesOrReleasesObs: value.from(vm, 'rolledupAndRolledBackIssuesAndReleases'),
  rollupTimingLevelsAndCalculationsObs: value.from(vm, 'rollupTimingLevelsAndCalculations'),
  filteredDerivedIssuesObs: value.from(vm, 'filteredDerivedIssues'),
  extraFieldsObs: value.bind(config, 'fields'),
  rowGroupObs: value.bind(config, 'rowGroup'),
  colGroupObs: value.bind(config, 'colGroup'),
  aggregatorsObs: value.bind(config, 'aggregators'),
  flowMetricsCycleTimeRangeObs: value.bind(config, 'flowMetricsCycleTimeRange'),
  flowMetricsStatusFilterObs: value.bind(config, 'flowMetricsStatusFilter'),
  flowMetricsIssueTypeFilterObs: value.bind(config, 'flowMetricsIssueTypeFilter'),
  flowMetricsProjectFilterObs: value.bind(config, 'flowMetricsProjectFilter'),
  flowMetricsTeamFilterObs: value.bind(config, 'flowMetricsTeamFilter'),
  timeInStatusDateRangeObs: value.bind(config, 'timeInStatusDateRange'),
  timeInStatusStatusFilterObs: value.bind(config, 'timeInStatusStatusFilter'),
  timeInStatusIssueTypeFilterObs: value.bind(config, 'timeInStatusIssueTypeFilter'),
  timeInStatusProjectFilterObs: value.bind(config, 'timeInStatusProjectFilter'),
  timeInStatusReorderObs: value.bind(config, 'timeInStatusReorder'),
  roundToObs: value.bind(config, 'roundTo'),
  groupByObs: value.bind(config, 'groupBy'),
  dateRangeStartObs: value.bind(config, 'scatterDateRangeStart'),
  dateRangeEndObs: value.bind(config, 'scatterDateRangeEnd'),
  primaryIssueTypeObs: value.bind(config, 'primaryIssueType'),
  breakdownObs: value.bind(config, 'primaryReportBreakdown'),
  showPercentCompleteObs: value.bind(config, 'showPercentComplete'),
  // Table report (`table2`) persisted view state — spec/012-table-and-grouper Phase 5.
  tableColumnsObs: value.bind(config, 'tableColumns'),
  tableSortColumnObs: value.bind(config, 'tableSortColumn'),
  tableSortDirObs: value.bind(config, 'tableSortDir'),
  tableFiltersObs: value.bind(config, 'tableFilters'),
  tableGroupByObs: value.bind(config, 'tableGroupBy'),
  tableGroupByColObs: value.bind(config, 'tableGroupByCol'),
  tableGroupByGranularityObs: value.bind(config, 'tableGroupByGranularity'),
  tableGroupByColGranularityObs: value.bind(config, 'tableGroupByColGranularity'),
  tableFieldAxisObs: value.bind(config, 'tableFieldAxis'),
  tableShowRowTotalsObs: value.bind(config, 'tableShowRowTotals'),
  tableShowColTotalsObs: value.bind(config, 'tableShowColTotals'),
});

/** The secondary (Work Breakdown) report's prop bag. Shell-only — children render no secondary. */
export const secondaryPropsFor = (vm: any, config: any) => ({
  primaryIssuesOrReleasesObs: value.from(vm, 'primaryIssuesOrReleases'),
  allIssuesOrReleasesObs: value.from(vm, 'rolledupAndRolledBackIssuesAndReleases'),
  planningIssuesObs: value.from(vm, 'planningIssues'),
  secondaryReportTypeObs: value.bind(config, 'secondaryReportType'),
  filterRowsObs: value.bind(config, 'secondaryFilterRows'),
  childFilterRowsObs: value.bind(config, 'secondaryChildFilterRows'),
});

// The key set this produces is pinned by `reportProps.test.ts`. The expected list lives in the test
// rather than here on purpose: a guard kept beside the thing it guards gets "fixed" in the same edit
// that broke it.
