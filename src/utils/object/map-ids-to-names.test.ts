import { describe, test, expect } from 'vitest';
import mapIdsToNames from './map-ids-to-names';

describe('mapIdsToNames', () => {
  test('rewrites field id keys to their display names', () => {
    const result = mapIdsToNames(
      { summary: 'Hello', customfield_10015: '2026-01-01' },
      { idMap: { summary: 'Summary', customfield_10015: 'Start date' } },
    );

    expect(result).toEqual({ Summary: 'Hello', 'Start date': '2026-01-01' });
  });

  test('keeps the raw id key alongside the name key for an ambiguous field', () => {
    const result = mapIdsToNames(
      { customfield_10015: '2026-01-01' },
      { idMap: { customfield_10015: 'Start date' }, ambiguousFieldIds: new Set(['customfield_10015']) },
    );

    expect(result).toEqual({ customfield_10015: '2026-01-01', 'Start date': '2026-01-01' });
  });

  test('keeps two identically-named fields in distinct id-keyed slots', () => {
    const result = mapIdsToNames(
      { customfield_10015: 'early', customfield_10099: 'late' },
      {
        idMap: { customfield_10015: 'Start date', customfield_10099: 'Start date' },
        ambiguousFieldIds: new Set(['customfield_10015', 'customfield_10099']),
      },
    );

    expect(result.customfield_10015).toBe('early');
    expect(result.customfield_10099).toBe('late');
    // the shared name slot still exists (holds whichever came last) for name-based readers
    expect(result['Start date']).toBe('late');
  });

  test('adds no id keys and leaves unknown keys untouched when no ambiguousFieldIds is given', () => {
    const result = mapIdsToNames(
      { customfield_10015: 'x', notAField: 'y' },
      { idMap: { customfield_10015: 'Start date' } },
    );

    expect(result).toEqual({ 'Start date': 'x', notAField: 'y' });
  });
});
