import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ScrollableTabList, { scrollLeftToReveal } from './ScrollableTabList';

/** jsdom does no layout, so give the scroller the sizes a browser would. */
const sizeScroller = (scroller: HTMLElement, { scrollLeft = 0, clientWidth = 300, scrollWidth = 300 }) => {
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: scrollWidth });
  scroller.scrollLeft = scrollLeft;
  fireEvent.scroll(scroller);
};

const renderTabs = () => {
  render(
    <ScrollableTabList>
      <div role="tablist">tabs</div>
    </ScrollableTabList>,
  );

  return screen.getByRole('tablist').parentElement as HTMLElement;
};

describe('<ScrollableTabList />', () => {
  it('shows no arrows when the tabs fit', () => {
    sizeScroller(renderTabs(), {});

    expect(screen.queryByRole('button', { name: /Scroll tabs/ })).not.toBeInTheDocument();
  });

  it('shows only the forward arrow at the start of an overflowing row', () => {
    sizeScroller(renderTabs(), { scrollWidth: 600 });

    expect(screen.getByRole('button', { name: 'Scroll tabs forward' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scroll tabs back' })).not.toBeInTheDocument();
  });

  it('shows only the back arrow once scrolled to the end', () => {
    sizeScroller(renderTabs(), { scrollWidth: 600, scrollLeft: 300 });

    expect(screen.getByRole('button', { name: 'Scroll tabs back' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scroll tabs forward' })).not.toBeInTheDocument();
  });
});

describe('scrollLeftToReveal', () => {
  const view = { left: 100, right: 400 };

  it('leaves a tab clear of both arrows where it is', () => {
    expect(scrollLeftToReveal({ left: 150, right: 250 }, view, 50)).toBeNull();
  });

  it('scrolls forward until a tab cut off on the right clears the arrow', () => {
    expect(scrollLeftToReveal({ left: 350, right: 420 }, view, 50)).toBe(50 + 48);
  });

  it('scrolls back until a tab cut off on the left clears the arrow', () => {
    expect(scrollLeftToReveal({ left: 90, right: 160 }, view, 50)).toBe(50 - 38);
  });

  it('stops at the start rather than past it', () => {
    expect(scrollLeftToReveal({ left: 100, right: 160 }, view, 10)).toBe(0);
  });
});
