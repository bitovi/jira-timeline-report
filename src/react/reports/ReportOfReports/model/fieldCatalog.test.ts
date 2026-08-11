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

    expect(options.map((option) => option.id)).toEqual(['latestComment', 'summary']);
  });
});

describe('buildValueExpression', () => {
  it('routes the derived id through latestCommentExpression', () => {
    expect(buildValueExpression('ABC-1', 'latestComment')).toBe('(issue = ABC-1).latestComment');
  });

  it('writes the field id for an ordinary field, never its name', () => {
    expect(buildValueExpression('ABC-1', 'customfield_10014')).toBe('(issue = ABC-1).customfield_10014');
  });

  it('trims the key', () => {
    expect(buildValueExpression('  ABC-1 ', 'summary')).toBe('(issue = ABC-1).summary');
  });
});
