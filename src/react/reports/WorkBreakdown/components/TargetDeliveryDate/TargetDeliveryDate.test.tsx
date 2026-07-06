import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { TargetDeliveryDate } from './TargetDeliveryDate';

describe('TargetDeliveryDate', () => {
  test('renders the label and formatted date', () => {
    render(<TargetDeliveryDate due={new Date('2025-03-09')} slip={{ kind: 'none' }} />);
    expect(screen.getByText('Target Delivery')).toBeTruthy();
    expect(screen.getByText('Mar 9')).toBeTruthy();
  });

  test('missing date shows an em dash', () => {
    render(<TargetDeliveryDate slip={{ kind: 'none' }} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  test('slipped date shows a red prior-date parenthetical', () => {
    render(<TargetDeliveryDate due={new Date('2025-07-24')} slip={{ kind: 'slipped', label: 'Jun 19' }} />);
    const slip = screen.getByText('(Jun 19)');
    expect(slip.className).toContain('color-text-blocked');
  });

  test('improved date shows a teal prior-date parenthetical', () => {
    render(<TargetDeliveryDate due={new Date('2025-10-03')} slip={{ kind: 'improved', label: 'Oct 10' }} />);
    const slip = screen.getByText('(Oct 10)');
    expect(slip.className).toContain('color-text-ahead');
  });

  test('custom label', () => {
    render(<TargetDeliveryDate label="Due" due={new Date('2025-03-09')} slip={{ kind: 'none' }} />);
    expect(screen.getByText('Due')).toBeTruthy();
  });
});
