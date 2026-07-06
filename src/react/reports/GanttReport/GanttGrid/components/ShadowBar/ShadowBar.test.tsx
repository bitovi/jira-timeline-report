import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShadowBar } from './ShadowBar';
import { computeBarPosition } from '../../helpers/barPosition';
import type { AxisRange } from '../../types';

const range: AxisRange = { firstDay: new Date('2025-01-01'), lastDay: new Date('2025-01-31') };

describe('ShadowBar', () => {
  it('renders nothing when there is no prior-period work', () => {
    const currentPosition = computeBarPosition(
      range,
      { start: new Date('2025-01-10'), due: new Date('2025-01-20') },
      'day',
    );
    const { container } = render(
      <ShadowBar work={null} range={range} roundTo="day" currentPosition={currentPosition} sizeClass="h-6" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the prior period matches the current position', () => {
    const work = { start: new Date('2025-01-10'), due: new Date('2025-01-20') };
    const currentPosition = computeBarPosition(range, work, 'day');
    const { container } = render(
      <ShadowBar work={work} range={range} roundTo="day" currentPosition={currentPosition} sizeClass="h-6" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the prior period is entirely in the past', () => {
    const currentPosition = computeBarPosition(
      range,
      { start: new Date('2025-01-10'), due: new Date('2025-01-20') },
      'day',
    );
    const { container } = render(
      <ShadowBar
        work={{ start: new Date('2024-11-01'), due: new Date('2024-12-01') }}
        range={range}
        roundTo="day"
        currentPosition={currentPosition}
        sizeClass="h-6"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a blurred bar when the prior period differs from the current one', () => {
    const currentPosition = computeBarPosition(
      range,
      { start: new Date('2025-01-10'), due: new Date('2025-01-20') },
      'day',
    );
    render(
      <ShadowBar
        work={{ start: new Date('2025-01-05'), due: new Date('2025-01-12') }}
        range={range}
        roundTo="day"
        currentPosition={currentPosition}
        sizeClass="h-6"
      />,
    );
    expect(screen.getByTestId('shadow-bar')).toBeInTheDocument();
    expect(screen.getByTestId('shadow-bar')).toHaveClass('h-6');
  });
});
