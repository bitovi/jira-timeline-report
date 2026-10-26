import type { AllTeamData, Configuration, IssueFields, TeamConfiguration } from './shared';
import { expect, test, describe } from 'vitest';
import { createEmptyAllTeamsData, createEmptyConfiguration, createEmptyTeamConfiguration } from './shared';
import {
  applyInheritance,
  createFullyInheritedConfig,
  createTeamFieldLookup,
  getCapacityLevel,
  getInheritedData,
  getParentConfiguration,
  hasSavedTeamMembers,
  resolveTeamConfiguration,
} from './inheritance';

const createConfiguration = (overrides: Partial<Configuration> = {}): Configuration => ({
  ...createEmptyConfiguration(),
  ...overrides,
});

const hierarchyLevels = ['3', '2', '1', '0'];

const createTeamConfiguration = (overrides: Partial<TeamConfiguration> = {}): TeamConfiguration => ({
  ...createEmptyTeamConfiguration(['defaults', ...hierarchyLevels]),
  ...overrides,
});

const createAllTeamData = (teamOverrides: Partial<Record<string, TeamConfiguration>> = {}): AllTeamData => ({
  ...createEmptyAllTeamsData(hierarchyLevels),
  ...teamOverrides,
});

describe('Lookup', () => {
  test('grabs the global defaults if nothing is provided', () => {
    const { getFieldFor } = createTeamFieldLookup(
      createAllTeamData({
        __GLOBAL__: createTeamConfiguration({
          defaults: createConfiguration({
            startDateField: 'Start Date',
            dueDateField: 'Due Date',
            estimateField: 'Story Points',
            confidenceField: 'Confidence',
          }),
        }),
      }),
    );

    expect(getFieldFor({ field: 'startDateField' })).toBe('Start Date');
    expect(getFieldFor({ field: 'dueDateField' })).toBe('Due Date');
    expect(getFieldFor({ field: 'estimateField' })).toBe('Story Points');
    expect(getFieldFor({ field: 'confidenceField' })).toBe('Confidence');
  });

  test('looks up the global issue hierarchy if nothing is provided', () => {
    const { getFieldFor } = createTeamFieldLookup(
      createAllTeamData({
        __GLOBAL__: createTeamConfiguration({
          1: createConfiguration({
            startDateField: 'Start Date',
            dueDateField: 'Due Date',
            estimateField: 'Story Points',
            confidenceField: 'Confidence',
          }),
        }),
      }),
    );

    expect(getFieldFor({ issueLevel: '1', field: 'startDateField' })).toBe('Start Date');
    expect(getFieldFor({ issueLevel: '1', field: 'dueDateField' })).toBe('Due Date');
    expect(getFieldFor({ issueLevel: '1', field: 'estimateField' })).toBe('Story Points');
    expect(getFieldFor({ issueLevel: '1', field: 'confidenceField' })).toBe('Confidence');
  });

  test('looks up the team defaults if a team name and no hierarchy is provided', () => {
    const { getFieldFor } = createTeamFieldLookup(
      createAllTeamData({
        bitovi: createTeamConfiguration({
          defaults: createConfiguration({
            startDateField: 'Start Date',
            dueDateField: 'Due Date',
            estimateField: 'Story Points',
            confidenceField: 'Confidence',
          }),
        }),
      }),
    );

    expect(getFieldFor({ team: 'bitovi', field: 'startDateField' })).toBe('Start Date');
    expect(getFieldFor({ team: 'bitovi', field: 'dueDateField' })).toBe('Due Date');
    expect(getFieldFor({ team: 'bitovi', field: 'estimateField' })).toBe('Story Points');
    expect(getFieldFor({ team: 'bitovi', field: 'confidenceField' })).toBe('Confidence');
  });

  test('looks up the team fields', () => {
    const { getFieldFor } = createTeamFieldLookup(
      createAllTeamData({
        bitovi: createTeamConfiguration({
          1: createConfiguration({
            startDateField: 'Start Date',
            dueDateField: 'Due Date',
            estimateField: 'Story Points',
            confidenceField: 'Confidence',
          }),
        }),
      }),
    );

    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'startDateField' })).toBe('Start Date');
    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'dueDateField' })).toBe('Due Date');
    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'estimateField' })).toBe('Story Points');
    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'confidenceField' })).toBe('Confidence');
  });

  test('looks up the globals if the team does not exist', () => {
    const { getFieldFor } = createTeamFieldLookup(
      createAllTeamData({
        __GLOBAL__: createTeamConfiguration({
          1: createConfiguration({
            startDateField: 'Start Date',
            dueDateField: 'Due Date',
            estimateField: 'Story Points',
            confidenceField: 'Confidence',
          }),
        }),
      }),
    );

    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'startDateField' })).toBe('Start Date');
    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'dueDateField' })).toBe('Due Date');
    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'estimateField' })).toBe('Story Points');
    expect(getFieldFor({ team: 'bitovi', issueLevel: '1', field: 'confidenceField' })).toBe('Confidence');
  });
});

// spec/039-global-defaults-workitems: team[level] → team.defaults → __GLOBAL__[level] → __GLOBAL__.defaults
describe('global per work item type precedence', () => {
  const EPIC = '1';

  // applyGlobalDefaultData drops global field picks that aren't real Jira fields, so they must exist.
  const jiraFields = ['A', 'B', 'C', 'G'].map((name) => ({ id: name, name })) as IssueFields;

  const resolve = (userData: AllTeamData) => createFullyInheritedConfig(userData, jiraFields, hierarchyLevels);

  test('a team default beats the global setting for that work item type', () => {
    const resolved = resolve({
      __GLOBAL__: { defaults: createConfiguration(), [EPIC]: createConfiguration({ estimateField: 'A' }) },
      bitovi: { defaults: createConfiguration({ estimateField: 'B' }) },
    });

    expect(resolved.bitovi?.[EPIC]?.estimateField).toBe('B');
  });

  test('a team with no values inherits the global setting for that work item type', () => {
    const resolved = resolve({
      __GLOBAL__: { defaults: createConfiguration(), [EPIC]: createConfiguration({ estimateField: 'A' }) },
      bitovi: { defaults: createConfiguration() },
    });

    expect(resolved.bitovi?.[EPIC]?.estimateField).toBe('A');
  });

  test("a team's own work item type setting beats everything", () => {
    const resolved = resolve({
      __GLOBAL__: {
        defaults: createConfiguration({ estimateField: 'G' }),
        [EPIC]: createConfiguration({ estimateField: 'A' }),
      },
      bitovi: { defaults: createConfiguration(), [EPIC]: createConfiguration({ estimateField: 'C' }) },
    });

    expect(resolved.bitovi?.[EPIC]?.estimateField).toBe('C');
  });

  test('only the global default set → the global and team work item types both use it', () => {
    const resolved = resolve({
      __GLOBAL__: { defaults: createConfiguration({ estimateField: 'G' }) },
      bitovi: { defaults: createConfiguration() },
    });

    expect(resolved.__GLOBAL__[EPIC]?.estimateField).toBe('G');
    expect(resolved.bitovi?.[EPIC]?.estimateField).toBe('G');
  });
});

describe('getParentConfiguration', () => {
  const EPIC = '1';

  const inheritedGlobal = (global: TeamConfiguration) =>
    applyInheritance('__GLOBAL__', { __GLOBAL__: global }, hierarchyLevels).__GLOBAL__;

  test('team defaults inherit the global defaults, not the global work item type', () => {
    const parent = getParentConfiguration({
      teamName: 'bitovi',
      hierarchyLevel: 'defaults',
      savedTeamData: { defaults: createConfiguration({ estimateField: 'B' }) },
      inheritedGlobal: inheritedGlobal({
        defaults: createConfiguration({ estimateField: 'G' }),
        [EPIC]: createConfiguration({ estimateField: 'A' }),
      }),
    });

    expect(parent.estimateField).toBe('G');
  });

  test('a team work item type inherits the team default first', () => {
    const parent = getParentConfiguration({
      teamName: 'bitovi',
      hierarchyLevel: EPIC,
      savedTeamData: {
        defaults: createConfiguration({ estimateField: 'B' }),
        [EPIC]: createConfiguration({ estimateField: 'C' }),
      },
      inheritedGlobal: inheritedGlobal({
        defaults: createConfiguration({ estimateField: 'G' }),
        [EPIC]: createConfiguration({ estimateField: 'A' }),
      }),
    });

    expect(parent.estimateField).toBe('B');
  });

  test('a team work item type with no team default inherits the global work item type', () => {
    const parent = getParentConfiguration({
      teamName: 'bitovi',
      hierarchyLevel: EPIC,
      savedTeamData: { defaults: createConfiguration(), [EPIC]: createConfiguration({ estimateField: 'C' }) },
      inheritedGlobal: inheritedGlobal({
        defaults: createConfiguration({ estimateField: 'G' }),
        [EPIC]: createConfiguration({ estimateField: 'A' }),
      }),
    });

    expect(parent.estimateField).toBe('A');
  });

  test('a team that was never saved falls back to the global default', () => {
    const parent = getParentConfiguration({
      teamName: 'bitovi',
      hierarchyLevel: EPIC,
      savedTeamData: undefined,
      inheritedGlobal: inheritedGlobal({ defaults: createConfiguration({ estimateField: 'G' }) }),
    });

    expect(parent.estimateField).toBe('G');
  });

  test('a global work item type inherits the global default, not its own value', () => {
    const parent = getParentConfiguration({
      teamName: '__GLOBAL__',
      hierarchyLevel: EPIC,
      savedTeamData: {
        defaults: createConfiguration(),
        [EPIC]: createConfiguration({ estimateField: 'A' }),
      },
      inheritedGlobal: inheritedGlobal({
        defaults: createConfiguration({ estimateField: 'G' }),
        [EPIC]: createConfiguration({ estimateField: 'A' }),
      }),
    });

    expect(parent.estimateField).toBe('G');
  });
});

// spec/040: X (`pointsPerPersonDay`) resolves together with the estimate unit.
describe('pointsPerPersonDay resolves with the unit', () => {
  const resolve = (saved: Partial<AllTeamData>, team = 'A', level = '1') =>
    getInheritedData(
      (saved[team] ?? {}) as TeamConfiguration,
      { __GLOBAL__: { defaults: {} }, ...saved } as AllTeamData,
      [level],
    )[level]!.pointsPerPersonDay;

  test('a team with no capacity fields of its own takes the global X', () => {
    expect(
      resolve({ __GLOBAL__: { defaults: { estimateUnit: 'teamWeeks', pointsPerPersonDay: 0.04 } } as never }),
    ).toBe(0.04);
  });

  test('X saved on a more specific level than the unit is read', () => {
    expect(
      resolve({
        __GLOBAL__: { defaults: { estimateUnit: 'teamWeeks', pointsPerPersonDay: 0.04 } } as never,
        A: { defaults: { pointsPerPersonDay: 0.02, teamMembers: 10 } } as never,
      }),
    ).toBe(0.02);
  });

  test('a level overriding the unit without X does not read a less specific X', () => {
    expect(
      resolve({
        __GLOBAL__: { defaults: { estimateUnit: 'storyPoints', pointsPerPersonDay: 0.3 } } as never,
        A: { 1: { estimateUnit: 'teamWeeks' } } as never,
      }),
    ).toBeNull();
  });

  test.each(['velocityPerSprint', 'estimateTeamShare'] as const)('a legacy %s on a level anchors it', (field) => {
    expect(
      resolve({
        __GLOBAL__: { defaults: { pointsPerPersonDay: 0.3 } } as never,
        A: { defaults: { [field]: field === 'velocityPerSprint' ? 21 : 'half' } } as never,
      }),
    ).toBeNull();
  });

  test('a headcount alone does not anchor', () => {
    expect(
      resolve({
        __GLOBAL__: { defaults: { pointsPerPersonDay: 0.3 } } as never,
        A: { 1: { teamMembers: 11 } } as never,
      }),
    ).toBe(0.3);
  });

  test("getParentConfiguration takes X from the team's defaults only when they anchor", () => {
    const inheritedGlobal = { defaults: createConfiguration({ pointsPerPersonDay: 0.3 }) } as TeamConfiguration;

    expect(
      getParentConfiguration({
        teamName: 'A',
        hierarchyLevel: '1',
        savedTeamData: { defaults: createConfiguration({ estimateUnit: 'teamWeeks' }) },
        inheritedGlobal,
      }).pointsPerPersonDay,
    ).toBeNull();
    expect(
      getParentConfiguration({
        teamName: 'A',
        hierarchyLevel: '1',
        savedTeamData: { defaults: createConfiguration({ teamMembers: 4 }) },
        inheritedGlobal,
      }).pointsPerPersonDay,
    ).toBe(0.3);
  });
});

describe('hasSavedTeamMembers', () => {
  test.each([
    ['nothing saved', {}, false],
    ['the team level', { A: { 1: { teamMembers: 3 } } }, true],
    ['the team defaults', { A: { defaults: { teamMembers: 3 } } }, true],
    ['the global level', { __GLOBAL__: { defaults: {}, 1: { teamMembers: 3 } } }, true],
    ['the global defaults', { __GLOBAL__: { defaults: { teamMembers: 3 } } }, true],
    ['another level only', { A: { 2: { teamMembers: 3 } } }, false],
    ['another team only', { B: { defaults: { teamMembers: 3 } } }, false],
  ])('%s', (_name, saved, expected) => {
    expect(hasSavedTeamMembers({ __GLOBAL__: { defaults: {} }, ...saved } as AllTeamData, 'A', '1')).toBe(expected);
  });
});

describe('getCapacityLevel', () => {
  test.each([
    ['nothing saved', undefined, 'defaults'],
    ['only a headcount at the level', { 1: { teamMembers: 4 } }, 'defaults'],
    ['the unit at the level', { 1: { estimateUnit: 'teamWeeks' } }, '1'],
    ['X at the level', { 1: { pointsPerPersonDay: 0.2 } }, '1'],
    ['a legacy velocity at the level', { 1: { velocityPerSprint: 21 } }, '1'],
  ])('%s → %s', (_name, saved, expected) => {
    expect(getCapacityLevel(saved as TeamConfiguration | undefined, '1')).toBe(expected);
  });
});

describe('resolveTeamConfiguration', () => {
  const jiraFields = [] as unknown as IssueFields;

  test('applies the global defaults and the team chain for one level', () => {
    const config = resolveTeamConfiguration(
      {
        __GLOBAL__: { defaults: { estimateUnit: 'teamWeeks', pointsPerPersonDay: 0.04 } },
        A: { defaults: { teamMembers: 11 }, 1: { tracks: 2 } },
      } as unknown as AllTeamData,
      jiraFields,
      'A',
      '1',
    );

    expect(config).toEqual(
      expect.objectContaining({
        estimateUnit: 'teamWeeks',
        pointsPerPersonDay: 0.04,
        teamMembers: 11,
        tracks: 2,
        sprintLength: 10,
      }),
    );
  });

  test('a team with nothing saved gets the global defaults, including the default headcount', () => {
    const config = resolveTeamConfiguration({ __GLOBAL__: { defaults: {} } } as AllTeamData, jiraFields, 'A', '1');

    expect(config).toEqual(
      expect.objectContaining({ estimateUnit: 'storyPoints', teamMembers: 5, pointsPerPersonDay: null }),
    );
  });
});
