import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, vi } from 'vitest';
import CompareSlider from './CompareSlider';

describe('<SaveReportsWrapper />', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-05-23T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    render(<CompareSlider />);

    expect(screen.queryByText('Compare to')).toBeInTheDocument();
  });

  it('defaults to 15 days ago', () => {
    render(<CompareSlider />);

    const slider = screen.getByRole('slider', { name: /15 days ago/i });
    expect(slider).toBeInTheDocument();
  });
});
