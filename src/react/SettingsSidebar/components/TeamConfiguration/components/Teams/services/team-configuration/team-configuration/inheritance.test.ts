import type { AllTeamData, Configuration, IssueFields, TeamConfiguration } from './shared';
import { expect, test, describe } from 'vitest';
import { createEmptyAllTeamsData, createEmptyConfiguration, createEmptyTeamConfiguration } from './shared';
import { applyInheritance, createTeamFieldLookup, getInheritedData } from './inheritance';

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
