import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QuarterAndMonthHeaders } from './QuarterAndMonthHeaders';
import { computeQuartersAndMonths } from '../../../../../utils/date/compute-quarters-and-months';

afterEach(cleanup);

describe('QuarterAndMonthHeaders', () => {
  test('renders a cell for each quarter and month', () => {
    const { quarters, months } = computeQuartersAndMonths(new Date('2025-01-15'), new Date('2025-01-20'));
    render(
      <div style={{ display: 'grid' }}>
        <QuarterAndMonthHeaders quarters={quarters} months={months} />
      </div>,
    );
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('Feb')).toBeInTheDocument();
    expect(screen.getByText('Mar')).toBeInTheDocument();
  });

  test('quarter cells span three columns', () => {
    const { quarters, months } = computeQuartersAndMonths(new Date('2025-01-15'), new Date('2025-01-20'));
    render(
      <div style={{ display: 'grid' }}>
        <QuarterAndMonthHeaders quarters={quarters} months={months} />
      </div>,
    );
    const q1 = screen.getByText('Q1');
    expect(q1.style.gridColumn).toBe('span 3');
  });

  test('renders multiple quarters across a wider range', () => {
    const { quarters, months } = computeQuartersAndMonths(new Date('2025-02-01'), new Date('2025-05-31'));
    render(
      <div style={{ display: 'grid' }}>
        <QuarterAndMonthHeaders quarters={quarters} months={months} />
      </div>,
    );
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('Q2')).toBeInTheDocument();
    expect(months).toHaveLength(6);
  });
});
