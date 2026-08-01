import { ObservableObject } from '../../can';
import { propsFor } from './reportProps';

/**
 * The prop bag every report received from the shell, transcribed by hand from the `baseProps`
 * `useMemo` in `TimelineReport.tsx` at ab3088c — the commit *before* `propsFor` was extracted out of
 * it (spec/016-report-of-reports Phase 2).
 *
 * That provenance is the whole value of this list, and the reason it lives here rather than next to
 * `propsFor`: it is an independent record of the contract the extraction had to preserve. Editing it
 * to match a failing `propsFor` defeats it. Every name below is read by at least one report
 * component, so dropping one doesn't fail a build — it silently feeds that report `undefined`.
 */
const SHELL_PROP_KEYS_AT_EXTRACTION = [
  'primaryIssuesOrReleasesObs',
  'allIssuesOrReleasesObs',
  'rollupTimingLevelsAndCalculationsObs',
  'filteredDerivedIssuesObs',
  'flowMetricsCycleTimeRangeObs',
  'flowMetricsStatusFilterObs',
  'flowMetricsIssueTypeFilterObs',
  'flowMetricsProjectFilterObs',
  'flowMetricsTeamFilterObs',
  'timeInStatusDateRangeObs',
  'timeInStatusStatusFilterObs',
  'timeInStatusIssueTypeFilterObs',
  'timeInStatusProjectFilterObs',
  'timeInStatusReorderObs',
  'roundToObs',
  'groupByObs',
  'dateRangeStartObs',
  'dateRangeEndObs',
  'primaryIssueTypeObs',
  'breakdownObs',
  'showPercentCompleteObs',
  'tableColumnsObs',
  'tableSortColumnObs',
  'tableSortDirObs',
  'tableFiltersObs',
  'tableGroupByObs',
  'tableGroupByColObs',
  'tableGroupByGranularityObs',
  'tableGroupByColGranularityObs',
  'tableFieldAxisObs',
  'tableShowRowTotalsObs',
  'tableShowColTotalsObs',
];

// A stand-in for routeData / ChildReportConfig — propsFor only ever reads named properties off it.
class FakeConfig extends ObservableObject {
  static props = {
    fields: {
      get default() {
        return [];
      },
    },
    jql: { default: '' },
    primaryIssueType: { default: '' },
    roundTo: { default: 'day' },
  };
}

class FakeViewModel extends ObservableObject {
  static props = {
    primaryIssuesOrReleases: {
      get default() {
        return [];
      },
    },
    rolledupAndRolledBackIssuesAndReleases: {
      get default() {
        return [];
      },
    },
    rollupTimingLevelsAndCalculations: {
      get default() {
        return [];
      },
    },
    filteredDerivedIssues: {
      get default() {
        return [];
      },
    },
  };
}

describe('propsFor', () => {
  // Guards the Phase 2 extraction: the shell and each embedded child must build an identical bag
  // from different sources, so a key dropped while moving this out of TimelineReport is a test
  // failure rather than a silently broken report. See spec/016-report-of-reports.
  it('returns exactly the key set the shell passed before the extraction', () => {
    const props = propsFor(new FakeViewModel(), new FakeConfig());

    expect(Object.keys(props).sort()).toEqual([...SHELL_PROP_KEYS_AT_EXTRACTION].sort());
  });

  it('binds config-backed props to the config it is given, not a global', () => {
    const first = new FakeConfig();
    const second = new FakeConfig();

    first.primaryIssueType = 'Initiative';
    second.primaryIssueType = 'Epic';

    expect(propsFor(new FakeViewModel(), first).primaryIssueTypeObs.value).toBe('Initiative');
    expect(propsFor(new FakeViewModel(), second).primaryIssueTypeObs.value).toBe('Epic');
  });

  it('binds vm-backed props to the view model it is given', () => {
    const vm = new FakeViewModel();
    const issues = [{ key: 'A-1' }];

    vm.primaryIssuesOrReleases = issues;

    expect(propsFor(vm, new FakeConfig()).primaryIssuesOrReleasesObs.value).toBe(issues);
  });
});
