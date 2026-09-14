import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CapacityField } from './CapacityField';

describe('CapacityField', () => {
  it('renders the value as a button, not an input, at rest', () => {
    render(<CapacityField value={21} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /21 points per sprint/i })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('opens a field when the read view is clicked', async () => {
    render(<CapacityField value={21} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));

    expect(screen.getByRole('spinbutton')).toHaveValue(21);
  });

  it('reports the new value on confirm', async () => {
    const onChange = vi.fn();
    render(<CapacityField value={21} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '35{Enter}');

    expect(onChange).toHaveBeenCalledWith(35);
  });

  it('does not report a value that did not change', async () => {
    const onChange = vi.fn();
    render(<CapacityField value={21} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.type(screen.getByRole('spinbutton'), '{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects zero and negative capacity', async () => {
    const onChange = vi.fn();
    render(<CapacityField value={21} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '0{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('rejects a capacity that parses to Infinity', async () => {
    const onChange = vi.fn();
    render(<CapacityField value={21} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /21 points per sprint/i }));
    await userEvent.clear(screen.getByRole('spinbutton'));
    await userEvent.type(screen.getByRole('spinbutton'), '1e999{Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });
});
