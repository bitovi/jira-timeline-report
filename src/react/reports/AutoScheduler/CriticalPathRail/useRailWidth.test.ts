import type React from 'react';

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RAIL_DEFAULT_WIDTH, RAIL_MAX_WIDTH, RAIL_MIN_WIDTH, useRailWidth } from './useRailWidth';

/** jsdom implements neither pointer capture nor `PointerEvent`, so events are hand-rolled. */
function pointerEvent(clientX: number) {
  return {
    clientX,
    pointerId: 1,
    preventDefault: vi.fn(),
    currentTarget: {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
  } as unknown as React.PointerEvent<HTMLElement>;
}

function setup() {
  const onCollapse = vi.fn();
  const rendered = renderHook(() => useRailWidth({ onCollapse }));
  return { onCollapse, ...rendered };
}

describe('useRailWidth', () => {
  it('starts at the default width', () => {
    const { result } = setup();
    expect(result.current.width).toBe(RAIL_DEFAULT_WIDTH);
    expect(result.current.isDragging).toBe(false);
  });

  it('grows the rail when dragging left', () => {
    const { result } = setup();
    act(() => result.current.dividerProps.onPointerDown(pointerEvent(1000)));
    expect(result.current.isDragging).toBe(true);
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(950)));
    expect(result.current.width).toBe(RAIL_DEFAULT_WIDTH + 50);
  });

  it('shrinks the rail when dragging right', () => {
    const { result } = setup();
    act(() => result.current.dividerProps.onPointerDown(pointerEvent(1000)));
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(1040)));
    expect(result.current.width).toBe(RAIL_DEFAULT_WIDTH - 40);
  });

  it('clamps at both bounds', () => {
    const { result } = setup();
    act(() => result.current.dividerProps.onPointerDown(pointerEvent(1000)));
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(0)));
    expect(result.current.width).toBe(RAIL_MAX_WIDTH);
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(5000)));
    expect(result.current.width).toBe(RAIL_MIN_WIDTH);
  });

  it('ignores pointer moves that did not start with a pointer down', () => {
    const { result } = setup();
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(500)));
    expect(result.current.width).toBe(RAIL_DEFAULT_WIDTH);
  });

  it('treats a press that never travelled as a click and collapses', () => {
    const { result, onCollapse } = setup();
    act(() => result.current.dividerProps.onPointerDown(pointerEvent(1000)));
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(1002)));
    act(() => result.current.dividerProps.onPointerUp(pointerEvent(1002)));
    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(result.current.width).toBe(RAIL_DEFAULT_WIDTH);
    expect(result.current.isDragging).toBe(false);
  });

  it('does not collapse after a real drag', () => {
    const { result, onCollapse } = setup();
    act(() => result.current.dividerProps.onPointerDown(pointerEvent(1000)));
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(960)));
    act(() => result.current.dividerProps.onPointerUp(pointerEvent(960)));
    expect(onCollapse).not.toHaveBeenCalled();
    expect(result.current.width).toBe(RAIL_DEFAULT_WIDTH + 40);
  });

  it('keeps the dragged width across a later collapse click', () => {
    const { result, onCollapse } = setup();
    act(() => result.current.dividerProps.onPointerDown(pointerEvent(1000)));
    act(() => result.current.dividerProps.onPointerMove(pointerEvent(900)));
    act(() => result.current.dividerProps.onPointerUp(pointerEvent(900)));

    act(() => result.current.dividerProps.onPointerDown(pointerEvent(900)));
    act(() => result.current.dividerProps.onPointerUp(pointerEvent(900)));
    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(result.current.width).toBe(RAIL_DEFAULT_WIDTH + 100);
  });
});
