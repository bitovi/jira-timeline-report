import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCircle } from './StatusCircle';

describe('StatusCircle', () => {
  it('renders the empty-set icon for empty-set-current', () => {
    render(<StatusCircle variant="empty-set-current" isDense={false} />);
    expect(screen.getByTestId('status-circle').querySelector('img')).toBeInTheDocument();
  });

  it('renders a left-arrow for past-due, colored by status', () => {
    render(<StatusCircle variant="past-due" status="blocked" isDense={false} />);
    const circle = screen.getByTestId('status-circle');
    expect(circle).toHaveTextContent('←');
    expect(circle.className).toContain('blocked');
  });

  it('renders an empty-set symbol (text-only) for empty-set-past', () => {
    render(<StatusCircle variant="empty-set-past" isDense={false} />);
    const circle = screen.getByTestId('status-circle');
    expect(circle).toHaveTextContent('∅');
    expect(circle.className).toContain('color-text-notstarted');
    expect(circle.className).not.toContain('color-text-and-bg');
  });

  it('applies denser padding when isDense is true', () => {
    const { container } = render(<StatusCircle variant="empty-set-current" isDense={true} />);
    expect(container.firstChild).toHaveClass('p-1');
  });
});
