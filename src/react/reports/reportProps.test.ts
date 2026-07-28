import { ObservableObject } from '../../can';
import { propsFor, REPORT_PROP_KEYS } from './reportProps';

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
  it('returns exactly the documented key set', () => {
    const props = propsFor(new FakeViewModel(), new FakeConfig());

    expect(Object.keys(props).sort()).toEqual([...REPORT_PROP_KEYS].sort());
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
