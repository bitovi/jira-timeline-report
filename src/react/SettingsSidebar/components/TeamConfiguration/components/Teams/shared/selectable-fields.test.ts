import type { IssueFields } from '../services/team-configuration';
import { expect, test, describe } from 'vitest';
import { buildSelectableFields } from './selectable-fields';

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

describe('buildSelectableFields', () => {
  test('uses the field name as the value when the name is unique', () => {
    const fields: IssueFields = [makeField('Start date', 'customfield_10015'), makeField('Due date', 'duedate')];

    expect(buildSelectableFields(fields)).toEqual([
      { value: 'Start date', label: 'Start date' },
      { value: 'Due date', label: 'Due date' },
    ]);
  });

  test('uses the field id as the value and disambiguates the label when a name collides', () => {
    const fields: IssueFields = [
      makeField('Start date', 'customfield_10015'),
      makeField('Start date', 'customfield_10099'),
    ];

    expect(buildSelectableFields(fields)).toEqual([
      { value: 'customfield_10015', label: 'Start date (customfield_10015)' },
      { value: 'customfield_10099', label: 'Start date (customfield_10099)' },
    ]);
  });

  test('only the colliding names switch to id values; unique names are left name-based', () => {
    const fields: IssueFields = [
      makeField('Start date', 'customfield_10015'),
      makeField('Start date', 'customfield_10099'),
      makeField('Story points', 'customfield_10020'),
    ];

    expect(buildSelectableFields(fields)).toEqual([
      { value: 'customfield_10015', label: 'Start date (customfield_10015)' },
      { value: 'customfield_10099', label: 'Start date (customfield_10099)' },
      { value: 'Story points', label: 'Story points' },
    ]);
  });
});
