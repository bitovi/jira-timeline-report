import { describe, test, expect, vi, beforeEach } from 'vitest';
import { deriveFieldMaps, makeFieldsRequest } from './fields';
import type { Config } from './types';

describe('deriveFieldMaps', () => {
  test('maps each name to a single id and each id to its name', () => {
    const { nameMap, idMap } = deriveFieldMaps([
      { name: 'Summary', id: 'summary' },
      { name: 'Story points', id: 'customfield_10020' },
    ]);

    expect(nameMap).toEqual({ Summary: 'summary', 'Story points': 'customfield_10020' });
    expect(idMap).toEqual({ summary: 'Summary', customfield_10020: 'Story points' });
  });

  test('collects the ids of every field whose name is shared by more than one field', () => {
    const { ambiguousFieldIds } = deriveFieldMaps([
      { name: 'Start date', id: 'customfield_10015' },
      { name: 'Start date', id: 'customfield_10099' },
      { name: 'Due date', id: 'duedate' },
    ]);

    expect(ambiguousFieldIds).toEqual(new Set(['customfield_10015', 'customfield_10099']));
  });

  test('leaves ambiguousFieldIds empty when all names are unique', () => {
    const { ambiguousFieldIds } = deriveFieldMaps([
      { name: 'Start date', id: 'customfield_10015' },
      { name: 'Due date', id: 'duedate' },
    ]);

    expect(ambiguousFieldIds.size).toBe(0);
  });

  test('prefers a field without a scope over one with a scope when resolving a name to an id', () => {
    const { nameMap } = deriveFieldMaps([
      { name: 'Start date', id: 'scoped', scope: 'PROJECT' },
      { name: 'Start date', id: 'global' },
    ]);

    expect(nameMap['Start date']).toBe('global');
  });
});

describe('makeFieldsRequest', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('fires the request when an access token is present', () => {
    window.localStorage.setItem('accessToken', 'a-token');
    const requestHelper = vi.fn(async () => [] as unknown);
    const setFieldsRequest = vi.fn();

    makeFieldsRequest({ requestHelper, host: 'hosted' } as unknown as Config, setFieldsRequest);

    expect(requestHelper).toHaveBeenCalledWith('/api/3/field');
    expect(setFieldsRequest).toHaveBeenCalled();
  });

  test('skips the request when there is no access token', () => {
    const requestHelper = vi.fn(async () => [] as unknown);

    makeFieldsRequest({ requestHelper, host: 'hosted' } as unknown as Config, vi.fn());

    expect(requestHelper).not.toHaveBeenCalled();
  });

  // Regression: this used to throw "requestHelper is not a function" from inside
  // createJiraHelpers, before the factory returned, breaking the OAuth callback page for anyone
  // re-authing with a leftover accessToken in localStorage.
  test('does not throw when the config has no requestHelper', () => {
    window.localStorage.setItem('accessToken', 'a-token');
    const setFieldsRequest = vi.fn();

    expect(() => makeFieldsRequest({ host: undefined } as unknown as Config, setFieldsRequest)).not.toThrow();
    expect(setFieldsRequest).not.toHaveBeenCalled();
  });
});
