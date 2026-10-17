import type { FC, ReactNode, SyntheticEvent } from 'react';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ChevronLeftIcon from '@atlaskit/icon/glyph/chevron-left';
import ChevronRightIcon from '@atlaskit/icon/glyph/chevron-right';

/** How far in from each edge a tab must sit to clear the arrow drawn over it (`w-7`). */
const ARROW_WIDTH = 28;

/**
 * The `scrollLeft` that brings a tab fully into view past the arrows, or `null` when it already is.
 * Positions are viewport coordinates, as `getBoundingClientRect` gives them.
 */
export const scrollLeftToReveal = (
  tab: { left: number; right: number },
  view: { left: number; right: number },
  scrollLeft: number,
): number | null => {
  const overflowsBack = tab.left - (view.left + ARROW_WIDTH);
  if (overflowsBack < 0) return Math.max(0, scrollLeft + overflowsBack);

  const overflowsForward = tab.right - (view.right - ARROW_WIDTH);
  if (overflowsForward > 0) return scrollLeft + overflowsForward;

  return null;
};

/**
 * Wraps an Atlaskit `TabList` so a row of tabs too wide for the panel scrolls sideways, with arrows
 * that appear only when there is more to see in that direction. A tab chosen while partly hidden
 * scrolls into view. Also widens each tab's padding
 * (and its underline, which Atlaskit insets by the same amount).
 */
const ScrollableTabList: FC<{ children: ReactNode }> = ({ children }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;

    setCanScrollBack(element.scrollLeft > 0);
    // A fraction of a pixel is left over at the end on some zoom levels.
    setCanScrollForward(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measure();

    if (typeof ResizeObserver === 'undefined' || !scroller.current) return;

    const observer = new ResizeObserver(measure);
    observer.observe(scroller.current);

    return () => observer.disconnect();
  }, [measure]);

  const pan = (direction: 1 | -1) => {
    const element = scroller.current;
    element?.scrollBy({ left: direction * element.clientWidth * 0.6, behavior: 'smooth' });
  };

  // Clicking a tab focuses it and arrow keys move focus between tabs, so focus covers both; click
  // covers Safari, which does not focus on click. Both aim at the same spot, so firing twice is fine.
  const reveal = (event: SyntheticEvent) => {
    const element = scroller.current;
    const tab = (event.target as HTMLElement).closest?.('[role=tab]');
    if (!element || !tab) return;

    const left = scrollLeftToReveal(tab.getBoundingClientRect(), element.getBoundingClientRect(), element.scrollLeft);
    if (left !== null) element.scrollTo({ left, behavior: 'smooth' });
  };

  const arrowClassName =
    'absolute inset-y-0 z-10 flex w-7 items-center justify-center bg-white text-slate-500 hover:text-slate-800';

  return (
    <div className="relative">
      {canScrollBack && (
        <button
          type="button"
          aria-label="Scroll tabs back"
          className={`${arrowClassName} left-0`}
          onClick={() => pan(-1)}
        >
          <ChevronLeftIcon label="" />
        </button>
      )}
      <div
        ref={scroller}
        onScroll={measure}
        onClick={reveal}
        onFocus={reveal}
        className={[
          'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          // Atlaskit pulls the list 8px left to line the first label up with the content; inside a
          // scroller that would clip the first tab, so the list sits flush and spans its full content.
          '[&_[role=tablist]]:![margin-inline-start:0] [&_[role=tablist]]:w-max [&_[role=tablist]]:min-w-full',
          // Its gray baseline is inset to match and inherits the list's width, which is now `max-content`.
          '[&_[role=tablist]:before]:!inset-x-0 [&_[role=tablist]:before]:!w-auto',
          '[&_[role=tab]]:!px-3 [&_[role=tab]:after]:!inset-x-3',
        ].join(' ')}
      >
        {children}
      </div>
      {canScrollForward && (
        <button
          type="button"
          aria-label="Scroll tabs forward"
          className={`${arrowClassName} right-0`}
          onClick={() => pan(1)}
        >
          <ChevronRightIcon label="" />
        </button>
      )}
    </div>
  );
};

export default ScrollableTabList;
