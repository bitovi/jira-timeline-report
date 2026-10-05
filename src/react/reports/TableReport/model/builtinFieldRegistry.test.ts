import { describe, expect, it } from 'vitest';

import { BUILTIN_CONCEPTS, CLAIMED_FIELD_IDS, getBuiltinFacet, requiredFieldsFor } from './builtinFieldRegistry';

import type { TableIssue } from './columns';

describe('requiredFieldsFor', () => {
  it('returns no fields for a derived built-in facet (Project Key)', () => {
    // Project Key derives from the issue key — it must NEVER trigger a field load.
    expect(requiredFieldsFor('builtin:project:key')).toEqual([]);
  });

  it('returns the loaded field for a raw built-in facet (Project Name)', () => {
    // Uses the display name 'Project', not the raw id 'project' — the fetch pipeline renames
    // response field keys from id -> display name (see builtinFieldRegistry.ts comment).
    expect(requiredFieldsFor('builtin:project:name')).toEqual(['Project']);
  });

  it('returns the loaded field for the Assignee & Avatar facet', () => {
    // THE regression guard for spec/034 §1. Assignee is not in CORE_FIELDS, so this facet is the
    // only thing that makes the field load; if this ever returns [], the column silently renders
    // blank in the real app while every other test in this file stays green.
    expect(requiredFieldsFor('builtin:assignee:avatar')).toEqual(['Assignee']);
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

  it('Project Name reads `.name` off the raw `Project` field object', () => {
    const facet = getBuiltinFacet('builtin:project:name')!;
    const issue = { fields: { Project: { id: '10000', key: 'ORD', name: 'Ordering' } } } as unknown as TableIssue;
    expect(facet.get(issue)).toBe('Ordering');
  });

  it('Project Name is undefined when the `project` field was not loaded', () => {
    const facet = getBuiltinFacet('builtin:project:name')!;
    expect(facet.get({ fields: {} } as unknown as TableIssue)).toBeUndefined();
  });

  it('Assignee & Avatar reads `.displayName` off the raw `Assignee` user object', () => {
    const facet = getBuiltinFacet('builtin:assignee:avatar')!;
    const issue = {
      fields: {
        Assignee: {
          accountId: 'abc',
          displayName: 'Arthur Pankiewicz',
          avatarUrls: { '48x48': 'https://x/avatar.png' },
        },
      },
    } as unknown as TableIssue;
    // The NAME, never the avatar URL — sorting, select-filter options, the `distinct` reducer and
    // group labels all read this value (spec/034 §3). The renderer reaches for the URL separately.
    expect(facet.get(issue)).toBe('Arthur Pankiewicz');
  });

  it('Assignee & Avatar is undefined when nobody is assigned', () => {
    const facet = getBuiltinFacet('builtin:assignee:avatar')!;
    expect(facet.get({ fields: {} } as unknown as TableIssue)).toBeUndefined();
    expect(facet.get({ fields: { Assignee: null } } as unknown as TableIssue)).toBeUndefined();
  });
});

describe('registry invariants (guard against drift)', () => {
  const allFacets = BUILTIN_CONCEPTS.flatMap((c) => c.facets);

  it('every facet sourceId is unique', () => {
    const ids = allFacets.map((f) => f.sourceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // `assignee` is the one deliberate exception: claiming 'Assignee' would delete the bare
  // `field:assignee` column via the catalog's set-difference, and spec/034 keeps BOTH so saved
  // reports already using it keep working. Every other concept must still claim, or its raw field
  // shows up twice — once curated, once bare.
  const CLAIMLESS_CONCEPTS = new Set(['assignee']);

  it('every concept claims at least one field id, except the documented claimless ones', () => {
    for (const concept of BUILTIN_CONCEPTS) {
      if (CLAIMLESS_CONCEPTS.has(concept.concept)) {
        expect(concept.claims).toEqual([]);
        continue;
      }
      expect(concept.claims.length).toBeGreaterThan(0);
    }
  });

  it('does not claim Assignee, so the bare `field:assignee` column survives', () => {
    expect(CLAIMED_FIELD_IDS.has('assignee')).toBe(false);
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
