import { describe, test, expect } from 'vitest';
import { deriveFieldMaps } from './fields';

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

  test('pins system fields to the names the app reads, whatever Jira currently calls them', () => {
    const { nameMap, idMap } = deriveFieldMaps([
      { name: 'Linked work items', id: 'issuelinks' },
      { name: 'Work type', id: 'issuetype' },
      { name: 'Statut', id: 'status' },
    ]);

    expect(nameMap).toMatchObject({ 'Linked Issues': 'issuelinks', 'Issue Type': 'issuetype', Status: 'status' });
    expect(idMap).toMatchObject({ issuelinks: 'Linked Issues', issuetype: 'Issue Type', status: 'Status' });
    expect(nameMap['Linked work items']).toBeUndefined();
  });

  test('leaves custom field names as Jira reports them', () => {
    const { idMap } = deriveFieldMaps([{ name: 'Team', id: 'customfield_10001' }]);

    expect(idMap.customfield_10001).toBe('Team');
  });
});
