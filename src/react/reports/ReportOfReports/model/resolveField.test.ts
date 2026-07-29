import type { JiraFieldLike } from './resolveField';

import { resolveField, isFieldError } from './resolveField';

const catalog: JiraFieldLike[] = [
  { id: 'summary', name: 'Summary', schema: { type: 'string' }, clauseNames: ['summary'] },
  { id: 'duedate', name: 'Due date', schema: { type: 'date' }, clauseNames: ['due', 'duedate'] },
  { id: 'customfield_10014', name: 'Story points', schema: { type: 'number' }, clauseNames: ['Story Points'] },
  { id: 'labels', name: 'Labels', schema: { type: 'array', items: 'string' }, clauseNames: ['labels'] },
];

const resolve = (accessor: string, fields: JiraFieldLike[] = catalog) => {
  const result = resolveField(accessor, fields);

  if (isFieldError(result)) {
    throw new Error(`expected "${accessor}" to resolve, got: ${result.error}`);
  }

  return result;
};

const errorFor = (accessor: string, fields: JiraFieldLike[] = catalog) => {
  const result = resolveField(accessor, fields);

  if (!isFieldError(result)) {
    throw new Error(`expected "${accessor}" to fail, got: ${JSON.stringify(result)}`);
  }

  return result.error;
};

describe('resolveField', () => {
  it('resolves a field id, carrying its schema', () => {
    expect(resolve('summary')).toEqual({ id: 'summary', name: 'Summary', schema: { type: 'string' } });
  });

  it('resolves a custom field id', () => {
    expect(resolve('customfield_10014').name).toBe('Story points');
  });

  it('resolves a display name', () => {
    expect(resolve('Story points').id).toBe('customfield_10014');
  });

  it('resolves a display name case-insensitively', () => {
    expect(resolve('story POINTS').id).toBe('customfield_10014');
    expect(resolve('due date').id).toBe('duedate');
  });

  it('resolves a JQL clause name', () => {
    expect(resolve('due').id).toBe('duedate');
  });

  it('carries an array field’s item type', () => {
    expect(resolve('labels').schema).toEqual({ type: 'array', items: 'string' });
  });

  // An id must win: a field whose *name* is another field's *id* would otherwise hijack it.
  it('prefers an id over a display name that collides with it', () => {
    const colliding: JiraFieldLike[] = [
      { id: 'summary', name: 'Summary', schema: { type: 'string' } },
      { id: 'customfield_20000', name: 'summary', schema: { type: 'number' } },
    ];

    expect(resolve('summary', colliding).id).toBe('summary');
  });

  it('tolerates a field with no schema', () => {
    expect(resolve('odd', [{ id: 'odd', name: 'Odd' }]).schema).toEqual({ type: undefined, items: undefined });
  });

  describe('errors', () => {
    it('reports an unknown field', () => {
      expect(errorFor('nope')).toMatch(/No Jira field named "nope"/);
    });

    it('reports an empty accessor', () => {
      expect(errorFor('   ')).toMatch(/No field named/);
    });

    // Two fields sharing a display name is real (spec/015-field-selection). Naming the ids is what
    // makes the error actionable — the user retypes the expression with one of them.
    it('reports two fields sharing a display name, listing the ids', () => {
      const duplicated: JiraFieldLike[] = [
        { id: 'customfield_10014', name: 'Story points', schema: { type: 'number' } },
        { id: 'customfield_10032', name: 'Story points', schema: { type: 'number' } },
      ];

      const message = errorFor('Story points', duplicated);

      expect(message).toMatch(/2 fields are named "Story points"/);
      expect(message).toContain('customfield_10014');
      expect(message).toContain('customfield_10032');
      expect(message).toMatch(/Use the field id/);
    });

    it('still resolves either of them by id', () => {
      const duplicated: JiraFieldLike[] = [
        { id: 'customfield_10014', name: 'Story points', schema: { type: 'number' } },
        { id: 'customfield_10032', name: 'Story points', schema: { type: 'number' } },
      ];

      expect(resolve('customfield_10032', duplicated).id).toBe('customfield_10032');
    });

    // One field listing the same alias twice is not a collision, so it must still resolve.
    it('does not call one field ambiguous with itself', () => {
      const aliased: JiraFieldLike[] = [{ id: 'duedate', name: 'Due date', clauseNames: ['due', 'DUE'] }];

      expect(resolve('due', aliased).id).toBe('duedate');
    });
  });
});
