import React from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { GridLines } from './GridLines';

afterEach(cleanup);

describe('GridLines', () => {
  test('renders one line per month', () => {
    render(<GridLines monthCount={6} rowCount={2} />);
    expect(screen.getAllByTestId('grid-line')).toHaveLength(6);
  });

  test('positions each line in its own column spanning rowCount rows', () => {
    render(<GridLines monthCount={3} rowCount={4} />);
    const lines = screen.getAllByTestId('grid-line');
    expect(lines[0].style.gridColumn).toBe('1 / span 1');
    expect(lines[0].style.gridRow).toBe('3 / span 4');
    expect(lines[2].style.gridColumn).toBe('3 / span 1');
  });

  test('only the last column has a right border', () => {
    render(<GridLines monthCount={3} rowCount={1} />);
    const lines = screen.getAllByTestId('grid-line');
    expect(lines[0].className).not.toContain('border-r');
    expect(lines[2].className).toContain('border-r');
  });

  test('renders nothing for zero months', () => {
    render(<GridLines monthCount={0} rowCount={1} />);
    expect(screen.queryAllByTestId('grid-line')).toHaveLength(0);
  });
});
