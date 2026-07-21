import type { AppStorage } from '../../../../../../../../../jira/storage/common';
import type { AllTeamData, IssueFields } from './shared';

import { describe, test, expect } from 'vitest';
import { createEmptyConfiguration } from './shared';
import { fixAnyNonExistingFields } from './fetcher';

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

// A no-op storage: these tests exercise the pure normalization result, not persistence.
const storage = { update: async () => {} } as unknown as AppStorage;

const allTeamDataWithStartDate = (startDateField: string): AllTeamData => ({
  __GLOBAL__: { defaults: { ...createEmptyConfiguration(), startDateField } },
});

describe('fixAnyNonExistingFields', () => {
  test('keeps a config field stored as a field id when a field with that id exists', () => {
    const userData = allTeamDataWithStartDate('customfield_10099');
    const jiraFields: IssueFields = [
      makeField('Start date', 'customfield_10015'),
      makeField('Start date', 'customfield_10099'),
    ];

    const result = fixAnyNonExistingFields(storage, userData, jiraFields);

    expect(result.__GLOBAL__.defaults.startDateField).toBe('customfield_10099');
  });

  test('keeps a config field stored as a field name (existing behavior)', () => {
    const userData = allTeamDataWithStartDate('Start date');
    const jiraFields: IssueFields = [makeField('Start date', 'customfield_10015')];

    const result = fixAnyNonExistingFields(storage, userData, jiraFields);

    expect(result.__GLOBAL__.defaults.startDateField).toBe('Start date');
  });

  test('deletes a config field that matches neither an existing id nor name', () => {
    const userData = allTeamDataWithStartDate('customfield_does_not_exist');
    const jiraFields: IssueFields = [makeField('Start date', 'customfield_10015')];

    const result = fixAnyNonExistingFields(storage, userData, jiraFields);

    expect(result.__GLOBAL__.defaults.startDateField).toBeUndefined();
  });
});
