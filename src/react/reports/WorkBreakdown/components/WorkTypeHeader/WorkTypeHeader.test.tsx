import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import type { WorkTypeColumn } from '../../types';
import { WorkTypeHeader } from './WorkTypeHeader';

const columns: WorkTypeColumn[] = [
  { type: 'design', symbol: 'd', status: 'complete', due: new Date('2025-02-12'), slip: { kind: 'none' } },
  {
    type: 'dev',
    symbol: 'D',
    status: 'behind',
    due: new Date('2025-07-24'),
    slip: { kind: 'slipped', label: 'Jun 19' },
  },
  {
    type: 'qa',
    symbol: 'Q',
    status: 'ahead',
    due: new Date('2025-10-03'),
    slip: { kind: 'improved', label: 'Oct 10' },
  },
];

describe('WorkTypeHeader', () => {
  test('renders a letter chip per column with its status color', () => {
    render(<WorkTypeHeader columns={columns} />);
    const d = screen.getByText('d');
    expect(d.className).toContain('color-text-and-bg-complete');
    expect(screen.getByText('D').className).toContain('color-text-and-bg-behind');
  });

  test('shows the rollup date', () => {
    render(<WorkTypeHeader columns={columns} />);
    expect(screen.getByText('Feb 12')).toBeTruthy();
  });

  test('slipped column shows a red prior date, improved shows teal', () => {
    render(<WorkTypeHeader columns={columns} />);
    expect(screen.getByText('Jun 19').className).toContain('color-text-blocked');
    expect(screen.getByText('Oct 10').className).toContain('color-text-ahead');
  });

  test('builds a descriptive tooltip', () => {
    render(<WorkTypeHeader columns={columns} />);
    const devCell = screen.getByText('D').closest('div');
    expect(devCell?.getAttribute('title')).toContain('dev: Behind');
    expect(devCell?.getAttribute('title')).toContain('(was Jun 19)');
  });
});
