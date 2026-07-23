import { describe, expect, test } from 'vitest';

import { getFieldTypeEntry, issueKeyColumn, issueTypeColumn, summaryColumn } from './fieldTypeRegistry';

import type { RenderContext, TableIssue } from './columns';

const ctx = (issue: TableIssue): RenderContext => ({ issue });

describe('getFieldTypeEntry', () => {
  test('number entry: numeric compare + number filter + sum default', () => {
    const entry = getFieldTypeEntry('number');
    expect(entry.filter).toEqual({ kind: 'number' });
    expect(entry.defaultAggregate).toBe('sum');
    expect([3, 1, 2, 10].sort(entry.compare)).toEqual([1, 2, 3, 10]);
  });

  test('date/datetime entry: chronological compare + date filter + range default', () => {
    const entry = getFieldTypeEntry('date');
    expect(getFieldTypeEntry('datetime')).toBe(entry);
    expect(entry.filter).toEqual({ kind: 'date' });
    expect(entry.defaultAggregate).toBe('range');
    const sorted = ['2024-06-01', '2024-01-01', '2024-03-15'].sort(entry.compare);
    expect(sorted).toEqual(['2024-01-01', '2024-03-15', '2024-06-01']);
    expect(entry.render('2024-01-05', ctx({}))).toBe('2024-01-05');
  });

  test('string/text entry: alphabetical compare + text filter + distinct default', () => {
    const entry = getFieldTypeEntry('string');
    expect(getFieldTypeEntry('text')).toBe(entry);
    expect(entry.filter).toEqual({ kind: 'text' });
    expect(entry.defaultAggregate).toBe('distinct');
    expect(['banana', 'apple', 'cherry'].sort(entry.compare)).toEqual(['apple', 'banana', 'cherry']);
  });

  test('unknown type falls back to the string renderer/entry', () => {
    const entry = getFieldTypeEntry('mystery');
    expect(entry.filter).toEqual({ kind: 'text' });
    expect(entry.render(42, ctx({}))).toBe('42');
    expect(entry.render(null, ctx({}))).toBe('');
  });

  test('array fields key off schema.items', () => {
    expect(getFieldTypeEntry('array', 'number')).toBe(getFieldTypeEntry('number'));
  });

  test('nullish values sort last', () => {
    const entry = getFieldTypeEntry('number');
    expect([null, 2, undefined, 1].sort(entry.compare)).toEqual([1, 2, null, undefined]);
  });
});

describe('identity columns', () => {
  test('issue key column renders a link when url present', () => {
    const col = issueKeyColumn();
    expect(col.isIdentity).toBe(true);
    expect(col.getValue({ key: 'JIRA-1' })).toBe('JIRA-1');
    const el = col.render('JIRA-1', ctx({ key: 'JIRA-1', url: 'http://x/JIRA-1' })) as {
      type: string;
      props: Record<string, unknown>;
    };
    expect(el.type).toBe('a');
    expect(el.props.href).toBe('http://x/JIRA-1');
    // no url -> plain text
    expect(col.render('JIRA-1', ctx({ key: 'JIRA-1' }))).toBe('JIRA-1');
  });

  test('summary column is the tree column', () => {
    const col = summaryColumn();
    expect(col.isTree).toBe(true);
    expect(col.isIdentity).toBe(true);
    expect(col.getValue({ summary: 'Do the thing' })).toBe('Do the thing');
  });

  test('issue type column reads the icon url from fields', () => {
    const col = issueTypeColumn();
    const issue: TableIssue = { fields: { 'Issue Type': { iconUrl: 'http://icon.png' } } };
    expect(col.getValue(issue)).toBe('http://icon.png');
    const el = col.render('http://icon.png', ctx(issue)) as { type: string; props: Record<string, unknown> };
    expect(el.type).toBe('img');
    expect(el.props.src).toBe('http://icon.png');
    expect(col.render(undefined, ctx({}))).toBe('');
  });
});
