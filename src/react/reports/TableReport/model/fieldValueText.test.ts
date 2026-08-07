import { describe, expect, test } from 'vitest';

import { fieldValueText } from './fieldValueText';

describe('fieldValueText', () => {
  test('scalars pass through', () => {
    expect(fieldValueText('High')).toBe('High');
    expect(fieldValueText(42)).toBe('42');
    expect(fieldValueText(true)).toBe('true');
  });

  test('empty values render as an empty string', () => {
    expect(fieldValueText(null)).toBe('');
    expect(fieldValueText(undefined)).toBe('');
    expect(fieldValueText('')).toBe('');
  });

  test('Assignee — a user object renders its display name', () => {
    const assignee = {
      self: 'https://x.atlassian.net/rest/api/3/user?accountId=abc',
      accountId: 'abc',
      displayName: 'Arthur Pankiewicz',
      emailAddress: 'arthur@bitovi.com',
      avatarUrls: { '48x48': 'https://x/avatar.png' },
      active: true,
    };
    expect(fieldValueText(assignee)).toBe('Arthur Pankiewicz');
  });

  test('Priority — a name-bearing object renders its name', () => {
    expect(fieldValueText({ self: 'https://x/priority/2', iconUrl: 'https://x/high.svg', name: 'High', id: '2' })).toBe(
      'High',
    );
  });

  test('single-select customfields render their `value`', () => {
    expect(fieldValueText({ self: 'https://x/option/1', value: 'Needs review', id: '1' })).toBe('Needs review');
  });

  test('displayName wins over name, name wins over value', () => {
    expect(fieldValueText({ displayName: 'Arthur', name: 'apankiewicz', value: 'x' })).toBe('Arthur');
    expect(fieldValueText({ name: 'High', value: 'x' })).toBe('High');
  });

  test('arrays join their members, skipping empties', () => {
    expect(fieldValueText([{ name: 'api' }, { name: 'web' }])).toBe('api, web');
    expect(fieldValueText(['QA', 'UAT'])).toBe('QA, UAT');
    expect(fieldValueText([{ name: 'api' }, { type: 'doc' }, null])).toBe('api');
    expect(fieldValueText([])).toBe('');
  });

  test('Date values format as YYYY-MM-DD rather than falling into the object branch', () => {
    expect(fieldValueText(new Date('2024-03-15T12:00:00Z'))).toBe('2024-03-15');
  });

  test('unrenderable shapes yield an empty string, never "[object Object]"', () => {
    // ADF rich text (a description / comment body).
    expect(fieldValueText({ type: 'doc', version: 1, content: [] })).toBe('');
    // An object with no label key at all (e.g. timetracking).
    expect(fieldValueText({ originalEstimate: '1d', remainingEstimate: '4h' })).toBe('');
  });
});
