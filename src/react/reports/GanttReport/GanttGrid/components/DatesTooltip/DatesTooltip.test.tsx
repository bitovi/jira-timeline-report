import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatesTooltip } from './DatesTooltip';

const renderBar = (data: React.ComponentProps<typeof DatesTooltip>['data']) =>
  render(
    <DatesTooltip data={data}>
      {({ triggerProps, anchorRef }) => (
        <button {...triggerProps} ref={anchorRef}>
          bar
        </button>
      )}
    </DatesTooltip>,
  );

describe('DatesTooltip', () => {
  it('renders the trigger and no tooltip when there is no data', () => {
    renderBar({});
    const bar = screen.getByRole('button', { name: 'bar' });
    fireEvent.mouseEnter(bar);
    expect(screen.queryByTestId('dates-tooltip')).not.toBeInTheDocument();
  });

  it('shows the pills on hover and hides them on leave', async () => {
    renderBar({ startPill: 'Jan 1', durationPill: '2w 0d', endPill: 'Jan 15' });
    expect(screen.queryByTestId('dates-tooltip')).not.toBeInTheDocument();

    const bar = screen.getByRole('button', { name: 'bar' });
    fireEvent.mouseEnter(bar);
    expect(await screen.findByTestId('dates-tooltip')).toHaveTextContent('Jan 1');
    expect(screen.getByTestId('dates-tooltip')).toHaveTextContent('Jan 15');

    fireEvent.mouseLeave(bar);
    expect(screen.queryByTestId('dates-tooltip')).not.toBeInTheDocument();
  });
});
