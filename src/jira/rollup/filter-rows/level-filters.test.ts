import { describe, expect, it } from 'vitest';
import {
  childLevelKey,
  countActiveFilters,
  dueDateRangeApplies,
  findAncestorAtLevel,
  intersectDateRange,
  LevelFiltersConfig,
  levelKeyOf,
  levelScope,
  matchesLevelFilter,
  resolveLevelFilters,
  splitLevels,
} from './level-filters';
import { FilterRow } from './filter-rows';

const hierarchy = [
  { name: 'Initiative', hierarchyLevel: 2 },
  { name: 'Epic', hierarchyLevel: 1 },
  { name: 'Story', hierarchyLevel: 0 },
];

const row = (overrides: Partial<FilterRow> = {}): FilterRow => ({
  id: 'r1',
  field: 'jiraStatus',
  operator: 'is',
  value: ['Done'],
  ...overrides,
});

const config = (overrides: Partial<LevelFiltersConfig> = {}): LevelFiltersConfig => ({
  primaryIssueType: 'Epic',
  issueHierarchy: hierarchy,
  levelFilters: {},
  ...overrides,
});

const day = (iso: string) => new Date(`${iso}T12:00:00`);

describe('resolveLevelFilters', () => {
  it('is empty-ish when nothing is configured', () => {
    expect(resolveLevelFilters(config())).toEqual({ Epic: { rows: [] } });
  });

  it('falls back to the legacy params for the Report on level', () => {
    const resolved = resolveLevelFilters(
      config({
        effectiveFilterRows: [row()],
        hideUnknownInitiatives: true,
        scatterDateRangeStart: '2026-01-01',
        scatterDateRangeEnd: '2026-03-31',
      }),
    );
    expect(resolved.Epic).toEqual({
      rows: [row()],
      hideWithoutDates: true,
      dueDateStart: '2026-01-01',
      dueDateEnd: '2026-03-31',
    });
  });

  it('falls back to cardsChildFilterRows for the level directly below', () => {
    const resolved = resolveLevelFilters(config({ cardsChildFilterRows: [row({ value: ['QA'] })] }));
    expect(resolved.Story).toEqual({ rows: [row({ value: ['QA'] })] });
    expect(resolved.Initiative).toBeUndefined();
  });

  it('puts the release picker and semver on the Release level', () => {
    const resolved = resolveLevelFilters(
      config({
        primaryIssueType: 'Release',
        secondaryIssueType: 'Initiative',
        releasesToShow: ['R1'],
        showOnlySemverReleases: true,
        cardsChildFilterRows: [row()],
      }),
    );
    expect(resolved.Release).toEqual({ rows: [], releasesToShow: ['R1'], showOnlySemverReleases: true });
    expect(resolved.Initiative).toEqual({ rows: [row()] });
  });

  it('ignores semver outside of release reports, as before', () => {
    expect(resolveLevelFilters(config({ showOnlySemverReleases: true })).Epic).toEqual({ rows: [] });
  });

  it('prefers levelFilters over the legacy fallbacks', () => {
    const levelFilters = { Epic: { rows: [] }, Story: { rows: [row({ value: ['Todo'] })] } };
    const resolved = resolveLevelFilters(
      config({
        levelFilters,
        effectiveFilterRows: [row()],
        hideUnknownInitiatives: true,
        cardsChildFilterRows: [row()],
      }),
    );
    expect(resolved.Epic).toEqual({ rows: [] });
    expect(resolved.Story).toEqual(levelFilters.Story);
  });

  it('does not mutate its input', () => {
    const levelFilters = {};
    resolveLevelFilters(config({ levelFilters, effectiveFilterRows: [row()] }));
    expect(levelFilters).toEqual({});
  });
});

describe('levels', () => {
  it('splits the hierarchy around Report on', () => {
    expect(splitLevels(config())).toEqual({ above: [hierarchy[0]], below: [hierarchy[2]] });
  });

  it('puts the secondary type and everything under it below Release', () => {
    expect(splitLevels(config({ primaryIssueType: 'Release', secondaryIssueType: 'Epic' }))).toEqual({
      above: [],
      below: [hierarchy[1], hierarchy[2]],
    });
  });

  it('finds the child level', () => {
    expect(childLevelKey(config())).toBe('Story');
    expect(childLevelKey(config({ primaryIssueType: 'Story' }))).toBeUndefined();
  });

  it('keys an issue by hierarchyLevel, not type', () => {
    expect(levelKeyOf({ type: 'Feature', hierarchyLevel: 1 }, hierarchy)).toBe('Epic');
    expect(levelKeyOf({ type: 'Release' }, hierarchy)).toBe('Release');
  });
});

describe('levelScope', () => {
  it('scopes All items to Report on and below', () => {
    expect(levelScope('all', config())).toEqual({
      hierarchyLevels: new Set([1, 0]),
      includesReleases: false,
      isAbove: false,
    });
    expect(levelScope('all', config({ primaryIssueType: 'Release', secondaryIssueType: 'Epic' }))).toEqual({
      hierarchyLevels: new Set([1, 0]),
      includesReleases: true,
      isAbove: false,
    });
  });

  it('marks levels above Report on', () => {
    expect(levelScope('Initiative', config()).isAbove).toBe(true);
    expect(levelScope('Story', config()).isAbove).toBe(false);
  });
});

describe('dueDateRangeApplies', () => {
  const applies = (key: string, primaryReportType: string) =>
    dueDateRangeApplies(key, { ...config(), primaryReportType });

  it('applies to Report on only where Gantt and Scatter filter by it', () => {
    expect(['due', 'start-due', 'cards', 'table'].map((report) => applies('Epic', report))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('applies above Report on in every report', () => {
    expect(['due', 'table', 'auto-scheduler'].map((report) => applies('Initiative', report))).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('applies below Report on only where child rows render', () => {
    expect(
      ['start-due', 'cards', 'table', 'due', 'estimate-analysis'].map((report) => applies('Story', report)),
    ).toEqual([true, true, true, false, false]);
  });

  it('applies to All items wherever Report on or children use it', () => {
    expect(['due', 'cards', 'table', 'estimate-analysis'].map((report) => applies('all', report))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });
});

describe('countActiveFilters', () => {
  it('counts rows with values, toggles, and a date range once', () => {
    expect(countActiveFilters(undefined)).toBe(0);
    expect(countActiveFilters({ rows: [row(), row({ value: [] })] })).toBe(1);
    expect(
      countActiveFilters({
        rows: [row()],
        hideWithoutDates: true,
        dueDateStart: '2026-01-01',
        dueDateEnd: '2026-02-01',
        releasesToShow: ['R1'],
        showOnlySemverReleases: true,
      }),
    ).toBe(5);
  });
});

describe('matchesLevelFilter', () => {
  const dated = { start: day('2026-01-01'), due: day('2026-02-15') };

  it('matches everything without a filter', () => {
    expect(matchesLevelFilter({}, undefined, { dates: {} })).toBe(true);
  });

  it('applies rows', () => {
    expect(matchesLevelFilter({ status: 'Done' }, { rows: [row()] }, { dates: {} })).toBe(true);
    expect(matchesLevelFilter({ status: 'Todo' }, { rows: [row()] }, { dates: {} })).toBe(false);
  });

  it('hide-without-dates needs start < due outside Scatter', () => {
    const filter = { rows: [], hideWithoutDates: true };
    expect(matchesLevelFilter({}, filter, { dates: dated })).toBe(true);
    expect(matchesLevelFilter({}, filter, { dates: { due: dated.due } })).toBe(false);
    expect(matchesLevelFilter({}, filter, { dates: { start: dated.due, due: dated.start } })).toBe(false);
  });

  it('hide-without-dates needs only a due date on Scatter', () => {
    const filter = { rows: [], hideWithoutDates: true };
    expect(matchesLevelFilter({}, filter, { dates: { due: dated.due }, scatter: true })).toBe(true);
    expect(matchesLevelFilter({}, filter, { dates: { start: dated.start }, scatter: true })).toBe(false);
  });

  it('applies the due-date range day-granularly and keeps undated items', () => {
    const filter = { rows: [], dueDateStart: '2026-02-15', dueDateEnd: '2026-03-31' };
    expect(matchesLevelFilter({}, filter, { dates: dated })).toBe(true);
    expect(matchesLevelFilter({}, filter, { dates: { due: day('2026-04-01') } })).toBe(false);
    expect(matchesLevelFilter({}, filter, { dates: {} })).toBe(true);
    expect(matchesLevelFilter({}, { ...filter, hideWithoutDates: true }, { dates: {}, scatter: true })).toBe(false);
  });

  it('skips the range when asked', () => {
    const filter = { rows: [], dueDateEnd: '2025-01-01' };
    expect(matchesLevelFilter({}, filter, { dates: dated, skipDateRange: true })).toBe(true);
  });

  it('applies the release picker and semver', () => {
    expect(matchesLevelFilter({ name: 'R1' }, { rows: [], releasesToShow: ['R1'] }, { dates: {} })).toBe(true);
    expect(matchesLevelFilter({ name: 'R2' }, { rows: [], releasesToShow: ['R1'] }, { dates: {} })).toBe(false);
    expect(matchesLevelFilter({ names: {} }, { rows: [], showOnlySemverReleases: true }, { dates: {} })).toBe(false);
  });
});

describe('intersectDateRange', () => {
  it('takes the latest start and earliest end', () => {
    expect(
      intersectDateRange(
        { rows: [], dueDateStart: '2026-01-01', dueDateEnd: '2026-12-31' },
        { rows: [], dueDateStart: '2026-03-01' },
        undefined,
      ),
    ).toEqual({ start: '2026-03-01', end: '2026-12-31' });
    expect(intersectDateRange(undefined)).toEqual({ start: '', end: '' });
  });
});

describe('findAncestorAtLevel', () => {
  const byKey = new Map([
    ['I-1', { key: 'I-1', parentKey: null, hierarchyLevel: 2 }],
    ['E-1', { key: 'E-1', parentKey: 'I-1', hierarchyLevel: 1 }],
    ['E-2', { key: 'E-2', parentKey: null, hierarchyLevel: 1 }],
  ]);

  it('walks up past intermediate levels', () => {
    expect(findAncestorAtLevel({ parentKey: 'E-1' }, byKey, 2)?.key).toBe('I-1');
  });

  it('is undefined when there is no ancestor at that level', () => {
    expect(findAncestorAtLevel({ parentKey: 'E-2' }, byKey, 2)).toBeUndefined();
    expect(findAncestorAtLevel({ parentKey: 'MISSING' }, byKey, 2)).toBeUndefined();
  });
});
