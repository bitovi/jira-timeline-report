import { describe, expect, it } from 'vitest';

import { queryKeyOf, rawIssuesCacheKey, type FieldMaps } from './raw-issues-cache-key.ts';

const maps: FieldMaps = {
  nameMap: { Status: 'status', 'Story points': 'customfield_1', summary: 'summary' },
  idMap: { status: 'Status', customfield_1: 'Story points', summary: 'summary' },
};

const key = (overrides: Record<string, unknown> = {}, fieldMaps?: FieldMaps) =>
  rawIssuesCacheKey(
    { isLoggedIn: true, loadChildren: false, jql: 'project = ORDER', childJQL: '', fields: [], ...overrides },
    fieldMaps,
  );

describe('rawIssuesCacheKey', () => {
  describe('the field list is a SET, not a sequence', () => {
    // `allFieldsToRequest` is a `[...new Set(...)]` union whose tail is ordered by the report's
    // COLUMN order — the thing users drag around. Two Tables over one JQL with the same columns in a
    // different order must not miss the dedupe.
    it('ignores order', () => {
      expect(key({ fields: ['a', 'b', 'c'] })).toBe(key({ fields: ['c', 'a', 'b'] }));
    });

    it('ignores duplicates', () => {
      expect(key({ fields: ['a', 'a', 'b'] })).toBe(key({ fields: ['b', 'a'] }));
    });
  });

  describe('core absorption', () => {
    // A Table whose only column is Status asks for ['Status']; a Gantt over the same JQL asks for
    // []. Status is core, so both send the same thing.
    it('collapses a core-only field list against an empty one', () => {
      expect(key({ fields: ['Status'] }, maps)).toBe(key({ fields: [] }, maps));
    });

    it('does NOT collapse a non-core field', () => {
      expect(key({ fields: ['customfield_1'] }, maps)).not.toBe(key({ fields: [] }, maps));
    });
  });

  describe('name vs id', () => {
    it('collapses a display name onto its id when the maps are loaded', () => {
      expect(key({ fields: ['Story points'] }, maps)).toBe(key({ fields: ['customfield_1'] }, maps));
    });

    // Before `jiraHelpers.fields` resolves, `toFieldId` passes identifiers through unchanged. That
    // is the CONSERVATIVE direction: it can only miss a dedupe, never share one fetch between two
    // requests that wanted different fields.
    it('keeps them apart without maps, rather than guessing', () => {
      expect(key({ fields: ['Story points'] })).not.toBe(key({ fields: ['customfield_1'] }));
    });
  });

  describe('the question itself', () => {
    it.each([
      ['jql', { jql: 'project = OTHER' }],
      ['childJQL', { childJQL: 'type = Bug' }],
      ['loadChildren', { loadChildren: true }],
      ['isLoggedIn', { isLoggedIn: false }],
    ])('changing %s changes the key', (_label, overrides) => {
      expect(key(overrides)).not.toBe(key());
    });
  });
});

describe('queryKeyOf', () => {
  it('ignores fields entirely — it identifies the question, not the projection', () => {
    // The whole point: two reports over one JQL group together however their columns differ.
    const gantt = queryKeyOf({ jql: 'project = ORDER', childJQL: '', loadChildren: false });
    const table = queryKeyOf({ jql: 'project = ORDER', childJQL: '', loadChildren: false });

    expect(gantt).toBe(table);
  });

  it.each([
    ['jql', { jql: 'project = OTHER' }],
    ['childJQL', { childJQL: 'type = Bug' }],
    ['loadChildren', { loadChildren: true }],
  ])('changing %s changes the key', (_label, overrides) => {
    const base = { jql: 'project = ORDER', childJQL: '', loadChildren: false };
    expect(queryKeyOf({ ...base, ...overrides })).not.toBe(queryKeyOf(base));
  });

  it('treats a missing jql the same as an empty one', () => {
    expect(queryKeyOf({ loadChildren: false })).toBe(queryKeyOf({ jql: '', childJQL: '', loadChildren: false }));
  });
});
