import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatesTooltip } from './DatesTooltip';

describe('DatesTooltip', () => {
  it('renders the trigger children without wrapping when there is no data', () => {
    render(
      <DatesTooltip data={{}}>
        <button>bar</button>
      </DatesTooltip>,
    );
    expect(screen.getByRole('button', { name: 'bar' })).toBeInTheDocument();
  });

  it('renders the trigger children when pills are present', () => {
    render(
      <DatesTooltip data={{ startPill: 'Jan 1', durationPill: '2w 0d', endPill: 'Jan 15' }}>
        <button>bar</button>
      </DatesTooltip>,
    );
    expect(screen.getByRole('button', { name: 'bar' })).toBeInTheDocument();
  });
});
