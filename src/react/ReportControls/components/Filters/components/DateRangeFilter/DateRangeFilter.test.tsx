import React, { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import routeData from '../../../../../../canjs/routing/route-data/route-data';
import DateRangeFilter from './DateRangeFilter';

vi.mock('../../../../../../canjs/routing/route-data/route-data', async () => {
  const mockRouteData = {
    scatterDateRangeStart: '',
    scatterDateRangeEnd: '',
  };
  const { ObservableObject } = await import('../../../../../../can');
  return {
    default: new (ObservableObject as ObjectConstructor)(mockRouteData),
  };
});

type MockableRouteData = { scatterDateRangeStart: string; scatterDateRangeEnd: string };

const renderComponent = () =>
  render(
    <Suspense fallback="loading">
      <DateRangeFilter />
    </Suspense>,
  );

beforeEach(() => {
  (routeData as unknown as MockableRouteData).scatterDateRangeStart = '';
  (routeData as unknown as MockableRouteData).scatterDateRangeEnd = '';
});

describe('DateRangeFilter', () => {
  it('renders the label, From/To pickers, Clear button, and preset chips', () => {
    renderComponent();
    expect(screen.getByText('Due date range')).toBeInTheDocument();
    expect(screen.getByText('This quarter')).toBeInTheDocument();
    expect(screen.getByText('This and next quarter')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('disables Clear when no range is set', () => {
    renderComponent();
    expect(screen.getByText('Clear').closest('button')).toBeDisabled();
  });

  it('clicking a preset sets both the from and to route params', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('This quarter'));

    const updated = routeData as unknown as MockableRouteData;
    expect(updated.scatterDateRangeStart).not.toBe('');
    expect(updated.scatterDateRangeEnd).not.toBe('');
  });

  it('clicking Clear resets both route params', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('This quarter'));
    await user.click(screen.getByText('Clear'));

    const updated = routeData as unknown as MockableRouteData;
    expect(updated.scatterDateRangeStart).toBe('');
    expect(updated.scatterDateRangeEnd).toBe('');
  });

  it('marks the matching preset as selected when the range equals its window', async () => {
    const user = userEvent.setup();
    renderComponent();

    const thisQuarter = screen.getByText('This quarter').closest('button')!;
    const nextQuarter = screen.getByText('This and next quarter').closest('button')!;
    expect(thisQuarter).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByText('This quarter'));

    expect(thisQuarter).toHaveAttribute('aria-pressed', 'true');
    expect(nextQuarter).toHaveAttribute('aria-pressed', 'false');
  });

  it('deselects the preset once the range no longer matches (e.g. after Clear)', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('This quarter'));
    expect(screen.getByText('This quarter').closest('button')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByText('Clear'));
    expect(screen.getByText('This quarter').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
