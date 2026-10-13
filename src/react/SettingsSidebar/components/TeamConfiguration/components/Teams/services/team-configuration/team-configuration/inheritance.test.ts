import type { AllTeamData, Configuration, IssueFields, TeamConfiguration } from './shared';
import { expect, test, describe } from 'vitest';
import { createEmptyAllTeamsData, createEmptyConfiguration, createEmptyTeamConfiguration } from './shared';
import {
  applyInheritance,
  createFullyInheritedConfig,
  createTeamFieldLookup,
  getInheritedData,
  getParentConfiguration,
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
