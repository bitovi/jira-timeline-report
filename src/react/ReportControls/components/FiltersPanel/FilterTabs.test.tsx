import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import FilterTabs from './FilterTabs';
import type { FilterTab } from '../Filters/hooks/useFilterTabs';

const tabs: FilterTab[] = [
  { key: 'all', label: 'All items', count: 0 },
  { key: 'Epic', label: 'Epics', count: 2 },
  { key: 'Story', label: 'Stories', count: 0 },
];

const Harness = () => {
  const [selectedKey, setSelectedKey] = useState('all');
  return <FilterTabs tabs={tabs} selectedKey={selectedKey} onSelect={setSelectedKey} />;
};

// jsdom has no scrolling; `ScrollableTabList` scrolls a focused tab into view.
beforeAll(() => {
  Element.prototype.scrollTo ??= vi.fn() as unknown as Element['scrollTo'];
  Element.prototype.scrollBy ??= vi.fn() as unknown as Element['scrollBy'];
});

describe('<FilterTabs />', () => {
  it('shows a badge only on tabs with active filters', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Epics 2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Stories' })).toBeInTheDocument();
  });

  it('moves selection and focus with the arrow keys, wrapping around', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('tab', { name: 'All items' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Epics 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Epics 2' })).toHaveFocus();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Stories' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All items' })).toHaveAttribute('tabindex', '-1');
  });

  it('shows the scroll arrow only while the strip overflows', () => {
    render(<Harness />);
    const scroller = screen.getByRole('tablist').parentElement as HTMLElement;
    const size = (scrollWidth: number) => {
      Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 });
      Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: scrollWidth });
      fireEvent.scroll(scroller);
    };

    size(300);
    expect(screen.queryByRole('button', { name: 'Scroll tabs forward' })).not.toBeInTheDocument();

    size(600);
    expect(screen.getByRole('button', { name: 'Scroll tabs forward' })).toBeInTheDocument();
  });
});
