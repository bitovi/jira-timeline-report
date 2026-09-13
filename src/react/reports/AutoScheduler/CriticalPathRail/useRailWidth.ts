import React from 'react';

export const RAIL_MIN_WIDTH = 260;
export const RAIL_MAX_WIDTH = 560;
export const RAIL_DEFAULT_WIDTH = 340;

/** Below this the press is a click on the grip, not a resize. */
const CLICK_SLOP = 3;

interface Drag {
  startX: number;
  startWidth: number;
  travelled: number;
}

/**
 * Width is in-memory only — a refresh resets the rail to closed at its default width, which is
 * intended. See the plan's "decisions already made".
 */
export function useRailWidth(options: { onCollapse: () => void }) {
  const { onCollapse } = options;
  const [width, setWidth] = React.useState(RAIL_DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragRef = React.useRef<Drag | null>(null);

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { startX: event.clientX, startWidth: width, travelled: 0 };
      setIsDragging(true);
    },
    [width],
  );

  const onPointerMove = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    drag.travelled = Math.max(drag.travelled, Math.abs(delta));
    // The rail is on the right, so dragging left (a negative delta) makes it wider.
    setWidth(Math.min(RAIL_MAX_WIDTH, Math.max(RAIL_MIN_WIDTH, drag.startWidth - delta)));
  }, []);

  const onPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);
      if (!drag) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (drag.travelled <= CLICK_SLOP) {
        setWidth(drag.startWidth);
        onCollapse();
      }
    },
    [onCollapse],
  );

  return {
    width,
    isDragging,
    dividerProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}
