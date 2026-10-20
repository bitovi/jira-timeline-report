import type { Modifier } from '@atlaskit/popper';

/**
 * Popper modifiers that keep the dates tooltip inside the timeline area: it is centered on the bar
 * when it fits, otherwise shifted horizontally just enough to stay within `boundary`.
 * (If the tooltip is wider than the boundary it aligns to the boundary's left edge.)
 */
export const buildDatesTooltipModifiers = (boundary: HTMLElement | null): Modifier<string, object>[] =>
  boundary
    ? [
        {
          name: 'preventOverflow',
          options: { boundary, rootBoundary: 'viewport', padding: 0, mainAxis: true, altAxis: false },
        },
      ]
    : [];
