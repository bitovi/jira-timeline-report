import { describe, it, expect } from 'vitest';

import { getIssueHierarchyUnderType, TimelineReportViewModel } from './timeline-report-view-model.js';
import { resolveLevelFilters } from '../../jira/rollup/filter-rows/level-filters';

// The issue-type-config hierarchy (what `issueTimingCalculations` is built from). Level 0 is
// labeled "Story" here regardless of what the loaded JQL data calls it.
const timingCalculations = [
  { type: 'Outcome', hierarchyLevel: 3, calculation: 'widestRange' },
  { type: 'Initiative', hierarchyLevel: 2, calculation: 'widestRange' },
  { type: 'Epic', hierarchyLevel: 1, calculation: 'widestRange' },
  { type: 'Story', hierarchyLevel: 0, calculation: 'widestRange' },
  { type: 'Assignment', hierarchyLevel: -1, calculation: 'parentOnly' },
];

const names = (calcs) => calcs.map((c) => c.type);

describe('getIssueHierarchyUnderType', () => {
  it('slices from the primary level down when the "Report on" label matches the config name', () => {
    const issueHierarchy = [
      { name: 'Epic', hierarchyLevel: 1 },
      { name: 'Story', hierarchyLevel: 0 },
    ];
    const result = getIssueHierarchyUnderType(timingCalculations, 'Epic', undefined, issueHierarchy);
    expect(names(result)).toEqual(['Epic', 'Story', 'Assignment']);
  });

  it('matches by hierarchy LEVEL when the loaded-data label differs from the config name', () => {
    // JQL `type = Risk` loads only Risks, so the data-derived hierarchy labels level 0 "Risk",
    // while the config hierarchy calls level 0 "Story". Matching by name would fail to find "Risk";
    // matching by level must still slice from level 0.
    const issueHierarchy = [{ name: 'Risk', hierarchyLevel: 0 }];
    const result = getIssueHierarchyUnderType(timingCalculations, 'Risk', undefined, issueHierarchy);
    expect(names(result)).toEqual(['Story', 'Assignment']);
  });

  it('caps the descent at the "To" level, resolved by level too', () => {
    const issueHierarchy = [
      { name: 'Outcome', hierarchyLevel: 3 },
      { name: 'Initiative', hierarchyLevel: 2 },
      { name: 'Epic', hierarchyLevel: 1 },
      { name: 'Story', hierarchyLevel: 0 },
    ];
    const result = getIssueHierarchyUnderType(timingCalculations, 'Outcome', 'Epic', issueHierarchy);
    expect(names(result)).toEqual(['Outcome', 'Initiative', 'Epic']);
  });

  it('falls back to name matching when the type is absent from issueHierarchy', () => {
    // Nothing of the primary type was loaded, so it is not in the data-derived hierarchy; the
    // config name still resolves it.
    const result = getIssueHierarchyUnderType(timingCalculations, 'Initiative', undefined, []);
    expect(names(result)).toEqual(['Initiative', 'Epic', 'Story', 'Assignment']);
  });

  it('returns the full list when the primary type cannot be resolved at all', () => {
    const result = getIssueHierarchyUnderType(timingCalculations, 'Nonexistent', undefined, []);
    expect(names(result)).toEqual(['Outcome', 'Initiative', 'Epic', 'Story', 'Assignment']);
  });
});

// The filter getters read only the slice below, so they're called against a plain `this` rather than
// a vm whose rollup would need a full normalize configuration.
const getter = (name) => Object.getOwnPropertyDescriptor(TimelineReportViewModel.props, name).get;

describe('level filters', () => {
  const issueHierarchy = [
    { name: 'Initiative', hierarchyLevel: 2 },
    { name: 'Epic', hierarchyLevel: 1 },
    { name: 'Story', hierarchyLevel: 0 },
  ];
  const rollup = (status) => ({ rollup: { status, start: new Date(2026, 0, 1), due: new Date(2026, 1, 1) } });
  const initiatives = [
    { key: 'I-1', type: 'Initiative', hierarchyLevel: 2, status: 'In Progress', parentKey: null },
    { key: 'I-2', type: 'Initiative', hierarchyLevel: 2, status: 'Done', parentKey: null },
  ];
  const epics = [
    {
      key: 'E-1',
      type: 'Epic',
      hierarchyLevel: 1,
      status: 'Todo',
      parentKey: 'I-1',
      rollupStatuses: rollup('ontrack'),
    },
    {
      key: 'E-2',
      type: 'Epic',
      hierarchyLevel: 1,
      status: 'Done',
      parentKey: 'I-2',
      rollupStatuses: rollup('complete'),
    },
    {
      key: 'E-3',
      type: 'Feature',
      hierarchyLevel: 1,
      status: 'Todo',
      parentKey: null,
      rollupStatuses: rollup('ontrack'),
    },
  ];
  const stories = [
    {
      key: 'S-1',
      type: 'Story',
      hierarchyLevel: 0,
      status: 'Done',
      parentKey: 'E-1',
      rollupStatuses: rollup('complete'),
    },
    { key: 'S-2', type: 'Bug', hierarchyLevel: 0, status: 'Todo', parentKey: 'E-1', rollupStatuses: rollup('ontrack') },
  ];

  const routeDataWith = (levelFilters, overrides = {}) => {
    const routeData = {
      primaryIssueType: 'Epic',
      issueHierarchy,
      levelFilters,
      primaryReportType: 'start-due',
      ...overrides,
    };
    return { ...routeData, effectiveLevelFilters: resolveLevelFilters(routeData) };
  };
  const vmThis = (levelFilters, overrides) => ({
    routeData: routeDataWith(levelFilters, overrides),
    groupedParentDownHierarchy: [epics, stories],
    rolledupAndRolledBackIssuesAndReleases: [...epics, ...stories],
    filteredDerivedIssues: [...initiatives, ...epics, ...stories],
  });
  const keys = (issues) => issues.map(({ key }) => key);
  const row = (field, operator, value) => ({ id: 'r', field, operator, value });

  describe('primaryIssuesOrReleases', () => {
    const primary = (levelFilters, overrides) =>
      keys(getter('primaryIssuesOrReleases').call(vmThis(levelFilters, overrides)));

    it('is unfiltered with no filters', () => {
      expect(primary({})).toEqual(['E-1', 'E-2', 'E-3']);
    });

    it('ANDs All items with the Report on tab', () => {
      expect(
        primary({
          all: { rows: [row('jiraStatus', 'is', ['Todo'])] },
          Epic: { rows: [row('issueType', 'is', ['Epic'])] },
        }),
      ).toEqual(['E-1']);
    });

    it('keeps a row only when its ancestor at a filtered upper level matches, and hides rows without one', () => {
      expect(primary({ Initiative: { rows: [row('jiraStatus', 'is', ['In Progress'])] } })).toEqual(['E-1']);
    });

    // I-1 is "In Progress", so if All items reached initiatives, E-1 would be hidden.
    it('ignores All items for levels above Report on', () => {
      expect(primary({ all: { rows: [row('jiraStatus', 'is not', ['In Progress'])] } })).toEqual(['E-1', 'E-2', 'E-3']);
    });

    it('still reads the legacy params', () => {
      expect(primary({}, { effectiveFilterRows: [row('jiraStatus', 'is', ['Done'])] })).toEqual(['E-2']);
    });
  });

  describe('levelFilteredDerivedIssues', () => {
    const levelFiltered = (levelFilters) => getter('levelFilteredDerivedIssues').call(vmThis(levelFilters));

    it('applies each tab to its own level, initiatives included', () => {
      expect(
        keys(
          levelFiltered({
            all: { rows: [row('jiraStatus', 'is not', ['Done'])] },
            Story: { rows: [row('issueType', 'is', ['Bug'])] },
          }),
        ),
      ).toEqual(['I-1', 'E-1', 'E-3', 'S-2']);
    });
  });

  describe('visibleIssuesOrReleases', () => {
    const visible = (levelFilters) => getter('visibleIssuesOrReleases').call(vmThis(levelFilters));

    it('returns the unfiltered list when nothing below Report on is filtered', () => {
      const self = vmThis({ Epic: { rows: [row('jiraStatus', 'is', ['Done'])] } });
      expect(getter('visibleIssuesOrReleases').call(self)).toBe(self.rolledupAndRolledBackIssuesAndReleases);
    });

    it('hides children only, leaving parents and their rollup untouched', () => {
      const result = visible({ Story: { rows: [row('jiraStatus', 'is', ['Done'])] } });
      expect(keys(result)).toEqual(['E-1', 'E-2', 'E-3', 'S-1']);
      expect(result[0]).toBe(epics[0]);
      expect(result[0].rollupStatuses.rollup.status).toBe('ontrack');
    });

    it('applies All items to the levels below', () => {
      expect(keys(visible({ all: { rows: [row('issueType', 'is not', ['Bug'])] } }))).toEqual([
        'E-1',
        'E-2',
        'E-3',
        'S-1',
      ]);
    });
  });
});
