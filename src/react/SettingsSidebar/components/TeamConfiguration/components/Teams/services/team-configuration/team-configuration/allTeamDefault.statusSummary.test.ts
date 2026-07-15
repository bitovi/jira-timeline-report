import { describe, it, expect } from 'vitest';
import { getGlobalDefaultData } from './allTeamDefault';
import type { AllTeamData, IssueFields } from './shared';

const fields = (names: string[]): IssueFields =>
  names.map((name, i) => ({
    name,
    id: `id${i}`,
    key: `k${i}`,
    schema: {},
    custom: true,
    clauseNames: [],
    searchable: true,
    navigable: true,
    orderable: true,
  }));

const empty = { __GLOBAL__: { defaults: {} } } as unknown as AllTeamData;

describe('getGlobalDefaultData statusSummaryField', () => {
  it('auto-detects a field literally named "Status Summary"', () => {
    expect(getGlobalDefaultData(empty, fields(['Summary', 'Status Summary'])).statusSummaryField).toBe(
      'Status Summary',
    );
  });

  it('auto-detects any field whose name contains both "status" and "summary"', () => {
    expect(getGlobalDefaultData(empty, fields(['Delivery Status — Summary'])).statusSummaryField).toBe(
      'Delivery Status — Summary',
    );
  });

  it('falls back to a strict "Executive Summary" name', () => {
    expect(getGlobalDefaultData(empty, fields(['Executive Summary'])).statusSummaryField).toBe('Executive Summary');
  });

  it('never auto-selects the system "Summary" title field', () => {
    expect(getGlobalDefaultData(empty, fields(['Summary'])).statusSummaryField).toBeNull();
  });

  it('keeps a valid user-chosen field', () => {
    const withUser = { __GLOBAL__: { defaults: { statusSummaryField: 'Status Note' } } } as unknown as AllTeamData;
    expect(getGlobalDefaultData(withUser, fields(['Status Note'])).statusSummaryField).toBe('Status Note');
  });
});
