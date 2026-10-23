import { describe, expect, it } from 'vitest';

import { RouteData } from './route-data';

// Exercise the getter directly — building a full RouteData would bind it to the URL.
const effectiveSourceFilterRows = (state: { sourceFilterRows?: unknown[]; statusesToExclude?: string[] }) =>
  Object.getOwnPropertyDescriptor(RouteData.props, 'effectiveSourceFilterRows')!.get!.call(state);

describe('effectiveSourceFilterRows', () => {
  const rows = [{ id: 'r1', field: 'issueType', operator: 'is not', value: ['Story'] }];

  it('returns the explicit rules', () => {
    expect(effectiveSourceFilterRows({ sourceFilterRows: rows, statusesToExclude: [] })).toEqual(rows);
  });

  // Old URLs and saved reports keep excluding their statuses.
  it('migrates the legacy statusesToExclude param to a Status · is not rule', () => {
    expect(effectiveSourceFilterRows({ sourceFilterRows: [], statusesToExclude: ['Done', "Won't do"] })).toEqual([
      { id: 'legacy-statuses-to-exclude', field: 'status', operator: 'is not', value: ['Done', "Won't do"] },
    ]);
  });

  it('prefers the new param when both are set', () => {
    expect(effectiveSourceFilterRows({ sourceFilterRows: rows, statusesToExclude: ['Done'] })).toEqual(rows);
  });

  it('is empty when nothing is configured', () => {
    expect(effectiveSourceFilterRows({ sourceFilterRows: [], statusesToExclude: [] })).toEqual([]);
  });
});
