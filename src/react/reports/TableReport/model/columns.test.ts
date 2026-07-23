import { describe, expect, test } from 'vitest';

import { isNumericColumn } from './columns';

import type { ColumnDefinition } from './columns';

function makeColumn(filter?: ColumnDefinition['filter']): ColumnDefinition {
  return {
    id: 'test',
    label: 'Test',
    group: 'Fields',
    source: { kind: 'field', fieldKey: 'test', schemaType: 'string' },
    getValue: () => undefined,
    render: () => null,
    compare: () => 0,
    filter,
  };
}

describe('isNumericColumn', () => {
  test('true when filter kind is number', () => {
    expect(isNumericColumn(makeColumn({ kind: 'number' }))).toBe(true);
  });

  test('false for text/date/select/boolean filters', () => {
    expect(isNumericColumn(makeColumn({ kind: 'text' }))).toBe(false);
    expect(isNumericColumn(makeColumn({ kind: 'date' }))).toBe(false);
    expect(isNumericColumn(makeColumn({ kind: 'select' }))).toBe(false);
    expect(isNumericColumn(makeColumn({ kind: 'boolean' }))).toBe(false);
  });

  test('false when no filter is declared', () => {
    expect(isNumericColumn(makeColumn(undefined))).toBe(false);
  });
});
