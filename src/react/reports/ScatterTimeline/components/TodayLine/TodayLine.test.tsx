import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TodayLine } from './TodayLine';

afterEach(cleanup);

describe('TodayLine', () => {
  test('renders the line with the given left margin', () => {
    render(<TodayLine marginLeftPercent={50} monthCount={3} rowCount={2} />);
    expect(screen.getByTestId('today-line').style.marginLeft).toBe('50%');
  });

  test('spans all month columns', () => {
    const { container } = render(<TodayLine marginLeftPercent={10} monthCount={6} rowCount={3} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.gridColumn).toBe('1 / span 6');
  });

  test('spans rowCount + 1 rows starting at row 2', () => {
    const { container } = render(<TodayLine marginLeftPercent={10} monthCount={6} rowCount={3} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.gridRow).toBe('2 / span 4');
  });

  test('accepts a negative margin (today before range)', () => {
    render(<TodayLine marginLeftPercent={-15} monthCount={3} rowCount={1} />);
    expect(screen.getByTestId('today-line').style.marginLeft).toBe('-15%');
  });
});
