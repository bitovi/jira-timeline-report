import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { renderStackedBar, segmentColor } from './stackedBar';
import { colorForName } from './chartColors';
import { getMeasureRenderer } from './grouping';

import type { ColumnDefinition, TableIssue } from './columns';

function col(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id: 'value',
    label: 'Value',
    group: 'Fields',
    source: { kind: 'field', fieldKey: 'value', schemaType: 'string' },
    getValue: (issue: TableIssue) => issue.value,
    render: (v) => String(v),
    compare: (a, b) => String(a).localeCompare(String(b)),
    filter: { kind: 'select' },
    ...overrides,
  };
}

const members: TableIssue[] = [
  { key: 'A', value: 'Ready' },
  { key: 'B', value: 'Idea' },
  { key: 'C', value: 'Ready' },
  { key: 'D', value: null },
];

const segments = () => screen.getAllByTestId('stacked-bar-segment');
const labels = () => segments().map((s) => s.getAttribute('aria-label'));

describe('renderStackedBar', () => {
  test('one segment per value, A→Z by default, sized by share, coloured by name', () => {
    render(<>{renderStackedBar(col(), { members })}</>);
    expect(labels()).toEqual(['Idea (1)', 'Ready (2)']);
    expect(segments()[1].style.width).toBe(`${(2 * 100) / 3}%`);
    expect(segments()[0]).toHaveAttribute('data-color', colorForName('Idea'));
    expect(segments()[1]).toHaveAttribute('data-color', colorForName('Ready'));
  });

  test('a picked colour wins over the column default, which wins over the name', () => {
    const column = col({ bar: { defaultColor: () => 'color.chart.green.bold' } });
    render(<>{renderStackedBar(column, { members, valueColors: { Ready: 'theme.blocked', Idea: 'not-a-color' } })}</>);
    expect(segments()[1]).toHaveAttribute('data-color', 'theme.blocked');
    // An unknown id (e.g. a hand-edited URL) falls back to the column default.
    expect(segments()[0]).toHaveAttribute('data-color', 'color.chart.green.bold');
  });

  test('segmentColor returns the palette entry the segment is painted with', () => {
    // Checked here rather than on the element: jsdom drops `var(...)` from inline styles.
    expect(segmentColor(col(), 'Ready', {}, { Ready: 'theme.complete' })).toMatchObject({
      background: 'var(--complete-color)',
      text: 'var(--complete-text-color)',
    });
  });

  test('follows a saved value order', () => {
    render(<>{renderStackedBar(col(), { members, valueOrder: ['Ready'] })}</>);
    expect(labels()).toEqual(['Ready (2)', 'Idea (1)']);
  });

  test('flattens array values', () => {
    render(<>{renderStackedBar(col(), { members: [{ value: ['bug', 'ui'] }, { value: ['bug'] }] })}</>);
    expect(labels()).toEqual(['bug (2)', 'ui (1)']);
  });

  test('segments open their issues when the report supplies onShowIssues', () => {
    const onShowIssues = vi.fn();
    render(<>{renderStackedBar(col(), { members, onShowIssues })}</>);
    fireEvent.click(screen.getByRole('button', { name: 'Idea (1)' }));
    expect(onShowIssues).toHaveBeenCalledWith('Idea (1)', [members[1]]);
  });

  test('a group with no values is blank', () => {
    expect(renderStackedBar(col(), { members: [{ value: null }] })).toBe('');
  });
});

describe('getMeasureRenderer', () => {
  test('draws the stacked bar for `bar` on any column, and nothing special for `tally`', () => {
    expect(getMeasureRenderer(col(), 'bar')).toBeTypeOf('function');
    expect(getMeasureRenderer(col(), 'tally')).toBeNull();
  });
});

test('segments show their label in an Atlaskit tooltip, not a native title', async () => {
  render(<>{renderStackedBar(col(), { members })}</>);
  const [idea] = segments();
  expect(idea).not.toHaveAttribute('title');
  fireEvent.mouseOver(idea);
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Idea (1)');
});
