import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TrackStepper } from './TrackStepper';

describe('TrackStepper', () => {
  it('reads out a singular track', () => {
    render(<TrackStepper value={1} onChange={vi.fn()} />);
    expect(screen.getByText('1 track')).toBeInTheDocument();
  });

  it('reads out plural tracks', () => {
    render(<TrackStepper value={2} onChange={vi.fn()} />);
    expect(screen.getByText('2 tracks')).toBeInTheDocument();
  });

  it('adds a track', async () => {
    const onChange = vi.fn();
    render(<TrackStepper value={2} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /add a parallel work track/i }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('removes a track', async () => {
    const onChange = vi.fn();
    render(<TrackStepper value={2} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /remove a work track/i }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('cannot go below one track', () => {
    render(<TrackStepper value={1} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /remove a work track/i })).toBeDisabled();
  });

  it('has no upper bound', () => {
    render(<TrackStepper value={99} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add a parallel work track/i })).toBeEnabled();
  });

  it('announces the count, so stepping is audible to a screen reader', () => {
    render(<TrackStepper value={2} onChange={vi.fn()} />);
    expect(screen.getByText('2 tracks')).toHaveAttribute('aria-live', 'polite');
  });
});
