import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { FilterRowsBuilder } from './FilterRowsBuilder';
import type { FilterFieldDefinition } from './FilterRowsBuilder';
import type { FilterRow } from '../../../../../../jira/rollup/filter-rows/filter-rows';

const fieldDefinitions: FilterFieldDefinition[] = [
  {
    field: 'jiraStatus',
    label: 'Jira Status',
    operators: ['is', 'is not'],
    options: [
      { label: 'Done (9)', value: 'Done' },
      { label: 'In Progress (4)', value: 'In Progress' },
    ],
  },
  {
    field: 'rollupStatus',
    label: 'Rollup Status',
    operators: ['is', 'is not'],
    options: [
      { label: 'Blocked (2)', value: 'blocked' },
      { label: 'Warning (4)', value: 'warning' },
      { label: 'Newly started', value: 'newlyStarted' },
    ],
  },
];

const oneRow: FilterRow[] = [{ id: 'row-1', field: 'jiraStatus', operator: 'is', value: ['Done'] }];

describe('FilterRowsBuilder', () => {
  it('renders one row per entry with Field/Operator/Value selects', () => {
    render(<FilterRowsBuilder rows={oneRow} onChange={vi.fn()} fieldDefinitions={fieldDefinitions} />);
    expect(screen.getByText('Jira Status')).toBeInTheDocument();
    expect(screen.getByText('is', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Done (9)')).toBeInTheDocument();
  });

  it('"+ Add filter" appends a new row defaulted to the first field definition', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterRowsBuilder rows={[]} onChange={onChange} fieldDefinitions={fieldDefinitions} />);

    await user.click(screen.getByText('+ Add filter'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newRows = onChange.mock.calls[0][0] as FilterRow[];
    expect(newRows).toHaveLength(1);
    expect(newRows[0]).toMatchObject({ field: 'jiraStatus', operator: 'is', value: [] });
  });

  it('row "×" removes that row', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterRowsBuilder rows={oneRow} onChange={onChange} fieldDefinitions={fieldDefinitions} />);

    await user.click(screen.getByRole('button', { name: 'Remove filter' }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('"Clear all filters" empties the rows array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterRowsBuilder rows={oneRow} onChange={onChange} fieldDefinitions={fieldDefinitions} />);

    await user.click(screen.getByText('Clear all filters'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('"Clear all filters" is disabled when there are no rows', () => {
    render(<FilterRowsBuilder rows={[]} onChange={vi.fn()} fieldDefinitions={fieldDefinitions} />);
    expect(screen.getByText('Clear all filters').closest('button')).toBeDisabled();
  });

  it("changing a row's Field resets its Value to [] and Operator to the first allowed operator", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterRowsBuilder rows={oneRow} onChange={onChange} fieldDefinitions={fieldDefinitions} />);

    const fieldSelect = screen.getByLabelText('Field');
    await user.click(fieldSelect);
    await user.click(screen.getByText('Rollup Status'));

    expect(onChange).toHaveBeenCalledWith([{ id: 'row-1', field: 'rollupStatus', operator: 'is', value: [] }]);
  });

  it("changing a row's Operator updates just the operator", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterRowsBuilder rows={oneRow} onChange={onChange} fieldDefinitions={fieldDefinitions} />);

    const operatorSelect = screen.getByLabelText('Operator');
    await user.click(operatorSelect);
    await user.click(screen.getByText('is not'));

    expect(onChange).toHaveBeenCalledWith([{ id: 'row-1', field: 'jiraStatus', operator: 'is not', value: ['Done'] }]);
  });
});
