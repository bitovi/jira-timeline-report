import { describe, expect, it } from 'vitest';

import {
  BUILTIN_CONCEPTS,
  CLAIMED_FIELD_IDS,
  getBuiltinFacet,
  requiredFieldsFor,
} from './builtinFieldRegistry';

import type { TableIssue } from './columns';

describe('requiredFieldsFor', () => {
  it('returns no fields for a derived built-in facet (Project Key)', () => {
    // Project Key derives from the issue key — it must NEVER trigger a field load.
    expect(requiredFieldsFor('builtin:project:key')).toEqual([]);
  });

  it('returns the loaded field for a raw built-in facet (Project Name)', () => {
    expect(requiredFieldsFor('builtin:project:name')).toEqual(['project']);
  });

  it('passes a generic `field:<id>` column through as its id', () => {
    expect(requiredFieldsFor('field:customfield_10234')).toEqual(['customfield_10234']);
  });

  it('requires nothing for identity / estimation / unknown sourceIds', () => {
    expect(requiredFieldsFor('identity:key')).toEqual([]);
    expect(requiredFieldsFor('estimation:estimatedDays')).toEqual([]);
    expect(requiredFieldsFor('rollup:status')).toEqual([]);
    expect(requiredFieldsFor('totally-unknown')).toEqual([]);
  });

  it('requires nothing for derived Common facets or Report Fields (all covered by CORE / normalized)', () => {
    for (const id of [
      'builtin:issueType:name',
      'builtin:status:category',
      'builtin:parent:summary',
      'builtin:team:name',
      'builtin:sprint:names',
      'builtin:labels:list',
      'builtin:created:date',
      'builtin:rank:value',
      'report:startDate',
      'report:storyPoints',
      'report:confidence',
    ]) {
      expect(requiredFieldsFor(id)).toEqual([]);
    }
  });
});

describe('Common / Report facet accessors', () => {
  it('resolves report-field facets via getBuiltinFacet', () => {
    expect(getBuiltinFacet('report:startDate')?.get({ startDate: 'x' } as unknown as TableIssue)).toBe('x');
  });

  it('Parent facets normalize the raw Parent object', () => {
    const issue = {
      parentKey: 'PROJ-9',
      fields: { Parent: { key: 'PROJ-9', fields: { summary: 'P', issuetype: { name: 'Epic' } } } },
    } as unknown as TableIssue;
    expect(getBuiltinFacet('builtin:parent:summary')?.get(issue)).toBe('P');
    expect(getBuiltinFacet('builtin:parent:type')?.get(issue)).toBe('Epic');
    // Parent facets are blank when the raw Parent object is absent.
    expect(getBuiltinFacet('builtin:parent:summary')?.get({ fields: {} } as unknown as TableIssue)).toBeUndefined();
  });
});

describe('built-in facet accessors', () => {
  it('Project Key reads the derived normalized `projectKey`', () => {
    const facet = getBuiltinFacet('builtin:project:key')!;
    const issue = { projectKey: 'ORD', fields: {} } as unknown as TableIssue;
    expect(facet.get(issue)).toBe('ORD');
  });

  it('Project Name reads `.name` off the raw `project` field object', () => {
    const facet = getBuiltinFacet('builtin:project:name')!;
    const issue = { fields: { project: { id: '10000', key: 'ORD', name: 'Ordering' } } } as unknown as TableIssue;
    expect(facet.get(issue)).toBe('Ordering');
  });

  it('Project Name is undefined when the `project` field was not loaded', () => {
    const facet = getBuiltinFacet('builtin:project:name')!;
    expect(facet.get({ fields: {} } as unknown as TableIssue)).toBeUndefined();
  });
});

describe('registry invariants (guard against drift)', () => {
  const allFacets = BUILTIN_CONCEPTS.flatMap((c) => c.facets);

  it('every facet sourceId is unique', () => {
    const ids = allFacets.map((f) => f.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every concept claims at least one field id', () => {
    for (const concept of BUILTIN_CONCEPTS) {
      expect(concept.claims.length).toBeGreaterThan(0);
    }
  });

  it('every `requires` is an array of non-empty string ids', () => {
    for (const facet of allFacets) {
      expect(Array.isArray(facet.requires)).toBe(true);
      for (const id of facet.requires) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }
    }
  });

  it('exposes every claimed field id (lowercased) for the catalog set-difference', () => {
    expect(CLAIMED_FIELD_IDS.has('project')).toBe(true);
  });
});
