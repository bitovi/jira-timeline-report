import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import DateRangeFilter from './DateRangeFilter';

/** Holds the range in state, as the hooks that feed it do, and reports every change. */
const Harness = ({ onChange }: { onChange: (start: string, end: string) => void }) => {
  const [range, setRange] = useState({ start: '', end: '' });
  return (
    <DateRangeFilter
      start={range.start}
      end={range.end}
      onChange={(start, end) => {
        setRange({ start, end });
        onChange(start, end);
      }}
    />
  );
};

const renderComponent = () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  return onChange;
};

describe('DateRangeFilter', () => {
  it('renders the label, From/To pickers, Clear button, and preset pills', () => {
    renderComponent();
    expect(screen.getByText('Due date range')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.getByText('This quarter')).toBeInTheDocument();
    expect(screen.getByText('This and next quarter')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('can hide its heading and prefix its ids', () => {
    render(<DateRangeFilter start="" end="" onChange={() => {}} idPrefix="Epic-range" hideHeading />);
    expect(screen.queryByText('Due date range')).not.toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveAttribute('id', 'Epic-range-from');
  });

  it('disables Clear when no range is set', () => {
    renderComponent();
    expect(screen.getByText('Clear').closest('button')).toBeDisabled();
  });

  it('clicking a preset sets both ends', async () => {
    const user = userEvent.setup();
    const onChange = renderComponent();

    await user.click(screen.getByText('This quarter'));

    const [start, end] = onChange.mock.calls.at(-1)!;
    expect(start).not.toBe('');
    expect(end).not.toBe('');
  });

  it('clicking Clear resets both ends', async () => {
    const user = userEvent.setup();
    const onChange = renderComponent();

    await user.click(screen.getByText('This quarter'));
    await user.click(screen.getByText('Clear'));

    expect(onChange).toHaveBeenLastCalledWith('', '');
  });

  it('marks the matching preset as selected when the range equals its window', async () => {
    const user = userEvent.setup();
    renderComponent();

    const thisQuarter = screen.getByText('This quarter').closest('button')!;
    const nextQuarter = screen.getByText('This and next quarter').closest('button')!;
    expect(thisQuarter).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByText('This quarter'));

    expect(thisQuarter).toHaveAttribute('aria-pressed', 'true');
    expect(nextQuarter).toHaveAttribute('aria-pressed', 'false');
  });

  it('deselects the preset once the range no longer matches (e.g. after Clear)', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('This quarter'));
    expect(screen.getByText('This quarter').closest('button')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByText('Clear'));
    expect(screen.getByText('This quarter').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
