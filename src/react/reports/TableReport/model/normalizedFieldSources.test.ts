import { describe, expect, test } from 'vitest';

import { resolveNormalizedFieldSource } from './normalizedFieldSources';

import type { TableIssue } from './columns';

describe('resolveNormalizedFieldSource', () => {
  test('matches by field key (case-insensitive)', () => {
    expect(resolveNormalizedFieldSource({ key: 'status', name: 'Status' })).toBeDefined();
    expect(resolveNormalizedFieldSource({ key: 'parent', name: 'Parent' })).toBeDefined();
    expect(resolveNormalizedFieldSource({ key: 'PROJECT', name: 'x' })).toBeDefined();
  });

  test('matches by display name when the key does not (e.g. custom Team/Story Points)', () => {
    expect(resolveNormalizedFieldSource({ key: 'customfield_10001', name: 'Team' })).toBeDefined();
    expect(resolveNormalizedFieldSource({ key: 'customfield_10002', name: 'Story Points' })).toBeDefined();
  });

  test('returns undefined for a field with no normalized equivalent', () => {
    expect(resolveNormalizedFieldSource({ key: 'description', name: 'Description' })).toBeUndefined();
  });

  test('parent reads the flattened parentKey (not the raw Parent object)', () => {
    const source = resolveNormalizedFieldSource({ key: 'parent', name: 'Parent' })!;
    const issue = { parentKey: 'PROJ-1', fields: { Parent: { key: 'PROJ-1' } } } as TableIssue;
    expect(source.getValue(issue)).toBe('PROJ-1');
  });

  test('team reads issue.team.name', () => {
    const source = resolveNormalizedFieldSource({ key: 'team', name: 'Team' })!;
    expect(source.getValue({ team: { name: 'Falcons' } } as unknown as TableIssue)).toBe('Falcons');
    expect(source.getValue({} as TableIssue)).toBeUndefined();
  });

  test('labels array is joined into a comma list', () => {
    const source = resolveNormalizedFieldSource({ key: 'labels', name: 'Labels' })!;
    expect(source.getValue({ labels: ['a', 'b'] } as unknown as TableIssue)).toBe('a, b');
  });

  test('story points / dates carry type-specific filter + aggregate overrides', () => {
    const points = resolveNormalizedFieldSource({ key: 'customfield_1', name: 'Story Points' })!;
    expect(points.filter).toEqual({ kind: 'number' });
    expect(points.defaultAggregate).toBe('sum');

    const due = resolveNormalizedFieldSource({ key: 'duedate', name: 'Due date' })!;
    expect(due.filter).toEqual({ kind: 'date' });
    expect(due.defaultAggregate).toBe('range');
  });
});
