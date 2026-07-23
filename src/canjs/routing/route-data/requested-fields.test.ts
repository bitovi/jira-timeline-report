import { describe, expect, it } from 'vitest';

import { canonicalFieldIdSet, sameRequestedFields, setsEqual, toFieldId } from './requested-fields';

import type { FieldMaps } from './requested-fields';

// Two fields share the display name "Team" (dup names are legal in Jira) — the id disambiguates.
const maps: FieldMaps = {
  nameMap: { Status: 'status', 'Due date': 'duedate', 'Story points': 'customfield_1', Team: 'customfield_9' },
  idMap: { status: 'Status', duedate: 'Due date', customfield_1: 'Story points', customfield_9: 'Team' },
};

const CORE = ['Status', 'Parent', 'Labels'];

describe('toFieldId', () => {
  it('maps a display name to its field id', () => {
    expect(toFieldId('Status', maps)).toBe('status');
    expect(toFieldId('Story points', maps)).toBe('customfield_1');
  });

  it('passes an id (or unknown identifier) through unchanged', () => {
    expect(toFieldId('status', maps)).toBe('status');
    expect(toFieldId('customfield_999', maps)).toBe('customfield_999');
  });

  it('returns the identifier as-is when no maps are available', () => {
    expect(toFieldId('Status')).toBe('Status');
  });
});

describe('canonicalFieldIdSet', () => {
  it('collapses names and ids into one id space', () => {
    // 'Status' (name) and 'status' (id) are the SAME field → one entry.
    expect(canonicalFieldIdSet(['Status', 'status', 'customfield_1'], maps)).toEqual(
      new Set(['status', 'customfield_1']),
    );
  });

  it('ignores empty / non-string entries', () => {
    expect(canonicalFieldIdSet(['status', '', undefined as unknown as string], maps)).toEqual(new Set(['status']));
  });
});

describe('setsEqual', () => {
  it('compares set membership', () => {
    expect(setsEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(setsEqual(new Set(['a']), new Set(['a', 'b']))).toBe(false);
  });
});

describe('sameRequestedFields', () => {
  it('is true when the only difference is a field that is already core', () => {
    // Adding a `status` column when Status is already in CORE_FIELDS → no real change.
    expect(sameRequestedFields(['summary'], ['summary', 'status'], CORE, maps)).toBe(true);
  });

  it('is true across the name/id boundary for a core field', () => {
    // Column contributes id `status`; CORE contributes name `Status` — canonically identical.
    expect(sameRequestedFields([], ['status'], CORE, maps)).toBe(true);
  });

  it('is false when a genuinely new non-core field is added', () => {
    expect(sameRequestedFields(['summary'], ['summary', 'customfield_1'], CORE, maps)).toBe(false);
  });

  it('removing a core-backed column is a no-op', () => {
    expect(sameRequestedFields(['summary', 'status'], ['summary'], CORE, maps)).toBe(true);
  });

  it('without maps, still recognises identical id-space lists', () => {
    expect(sameRequestedFields(['customfield_1'], ['customfield_1'], CORE)).toBe(true);
    expect(sameRequestedFields(['customfield_1'], ['customfield_2'], CORE)).toBe(false);
  });
});
