import type { AllTeamData, IssueFields } from './shared';

import { describe, test, expect } from 'vitest';

import { getGlobalDefaultData } from './allTeamDefault';
import { buildSelectableFields } from '../../../shared/selectable-fields';

const makeField = (name: string, id: string): IssueFields[number] => ({
  name,
  id,
  key: id,
  schema: {},
  custom: true,
  clauseNames: [],
  searchable: true,
  navigable: true,
  orderable: true,
});

// The real shape of the affected account: two GLOBAL "Start date" fields, neither scoped, so
// `buildSelectableFields` renders both options id-valued.
const jiraFields: IssueFields = [
  makeField('Start date', 'customfield_10325'),
  makeField('Start date', 'customfield_10015'),
  makeField('Due date', 'duedate'),
  makeField('Status Summary', 'customfield_20001'),
];

const globalDefaults = (defaults: Record<string, unknown>) => ({ __GLOBAL__: { defaults } }) as unknown as AllTeamData;

describe('getGlobalDefaultData with name-colliding fields', () => {
  // Regression (spec/015-field-selection): the existence check matched display names only, so an
  // id-valued selection was discarded and replaced by the display name. The dropdown's colliding
  // options are id-valued, so the name matched nothing and the select rendered blank on reload.
  test.each(['customfield_10325', 'customfield_10015'])('preserves the chosen field id %s', (id) => {
    const result = getGlobalDefaultData(globalDefaults({ startDateField: id }), jiraFields);

    expect(result.startDateField).toBe(id);
  });

  test('the value read back is selectable in the dropdown', () => {
    const value = getGlobalDefaultData(
      globalDefaults({ startDateField: 'customfield_10015' }),
      jiraFields,
    ).startDateField;

    expect(buildSelectableFields(jiraFields).map((option) => option.value)).toContain(value);
  });

  test('still preserves a unique field stored by name', () => {
    const result = getGlobalDefaultData(globalDefaults({ dueDateField: 'Due date' }), jiraFields);

    expect(result.dueDateField).toBe('Due date');
  });

  test('still falls back to a name default when the configured field is gone', () => {
    const result = getGlobalDefaultData(globalDefaults({ startDateField: 'customfield_deleted' }), jiraFields);

    expect(result.startDateField).toBe('Start date');
  });

  test('preserves an id-valued status summary field', () => {
    const result = getGlobalDefaultData(globalDefaults({ statusSummaryField: 'customfield_20001' }), jiraFields);

    expect(result.statusSummaryField).toBe('customfield_20001');
  });

  test('still honours the status-summary opt-out sentinel', () => {
    const result = getGlobalDefaultData(globalDefaults({ statusSummaryField: 'status-summary-not-used' }), jiraFields);

    expect(result.statusSummaryField).toBe('status-summary-not-used');
  });
});
