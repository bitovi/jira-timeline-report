import { act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';

import { useDebouncedCallback } from './useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the callback once, after the delay, with the last arguments', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback.mock.calls).toEqual([['c']]);
  });

  it('flushes a pending call on unmount, so a change made just before closing still saves', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => {
      result.current('pending');
    });

    unmount();

    expect(callback.mock.calls).toEqual([['pending']]);
  });

  it('does not call the callback on unmount when nothing is pending', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => {
      result.current('a');
      vi.advanceTimersByTime(500);
    });

    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('keeps a stable identity across renders and calls the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();

    const { result, rerender } = renderHook(({ callback }) => useDebouncedCallback(callback, 500), {
      initialProps: { callback: first },
    });

    const initialIdentity = result.current;

    act(() => {
      result.current('x');
    });

    rerender({ callback: second });

    expect(result.current).toBe(initialIdentity);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second.mock.calls).toEqual([['x']]);
  });
});
