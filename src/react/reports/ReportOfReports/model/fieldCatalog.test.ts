import type { JiraFieldLike } from './resolveField';

import { buildFieldOptions, buildValueExpression } from './fieldCatalog';

const field = (id: string, name: string): JiraFieldLike => ({ id, name });

const catalog: JiraFieldLike[] = [
  field('summary', 'Summary'),
  field('status', 'Status'),
  field('customfield_10014', 'Story points'),
];

// See spec/016-report-of-reports/009-value-report-modal Phase 3.
describe('buildFieldOptions', () => {
  it('puts Latest Comment first, under Derived', () => {
    expect(buildFieldOptions(catalog)[0]).toEqual({ id: 'latestComment', label: 'Latest Comment', group: 'Derived' });
  });

  // A sibling preset, not a replacement — so Latest Comment keeps the head of the list and Status
  // Update follows it. See spec/027-status-updates § The accessor and the dropdown.
  it('offers Status Update second, also under Derived', () => {
    const derived = buildFieldOptions(catalog).filter((option) => option.group === 'Derived');

    expect(derived).toEqual([
      { id: 'latestComment', label: 'Latest Comment', group: 'Derived' },
      { id: 'statusUpdate', label: 'Status Update', group: 'Derived' },
    ]);
  });

  it('promotes a curated id to Common and does not also list it under Fields', () => {
    const options = buildFieldOptions(catalog);

    expect(options.filter((option) => option.id === 'summary')).toEqual([
      { id: 'summary', label: 'Summary', group: 'Common' },
    ]);
  });

  it('lists everything else under Fields', () => {
    expect(buildFieldOptions(catalog)).toContainEqual({
      id: 'customfield_10014',
      label: 'Story points',
      group: 'Fields',
    });
  });

  it('labels a promoted field with the name Jira gave it, not the curated id', () => {
    // The curated list names ids; the label has to come from the catalog or a renamed field lies.
    const options = buildFieldOptions([field('issuetype', 'Work Type')]);

    expect(options).toContainEqual({ id: 'issuetype', label: 'Work Type', group: 'Common' });
  });

  it('skips a curated id the catalog does not have', () => {
    const options = buildFieldOptions([field('summary', 'Summary')]);

    expect(options.map((option) => option.id)).toEqual(['latestComment', 'statusUpdate', 'summary']);
  });
});

describe('buildValueExpression', () => {
  // No special case for either derived id — the generic line already produced exactly this, which is
  // why the branch that used to be here went. See spec/027-status-updates § The accessor and the dropdown.
  it('writes a derived id the same way as any other accessor', () => {
    expect(buildValueExpression('ABC-1', 'latestComment')).toBe('(issue = ABC-1).latestComment');
    expect(buildValueExpression('ABC-1', 'statusUpdate')).toBe('(issue = ABC-1).statusUpdate');
  });

  it('writes the field id for an ordinary field, never its name', () => {
    expect(buildValueExpression('ABC-1', 'customfield_10014')).toBe('(issue = ABC-1).customfield_10014');
  });

  it('trims the key', () => {
    expect(buildValueExpression('  ABC-1 ', 'summary')).toBe('(issue = ABC-1).summary');
  });
});
