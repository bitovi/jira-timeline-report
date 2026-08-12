import { useCallback, useEffect, useRef } from 'react';

/**
 * Debounces an *action* rather than a value: the returned function schedules `callback` with the
 * most recent arguments, `delay` ms after the last call.
 *
 * Prefer this over debouncing state with `useDebounce` when the debounced result is a side effect
 * (saving, requesting) instead of something rendered. Debouncing the value means the effect that
 * consumes it has to work out whether it still needs to fire, and that check tends to be written as
 * a diff against whatever the side effect itself updates — which is a feedback loop. Being called
 * from the event handler that made the change carries that answer for free.
 *
 * A pending call is flushed on unmount, so a change made just before the component goes away still
 * lands. That is the opposite of `useDebounce`, whose timer is simply cleared.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
): (...args: TArgs) => void {
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const pendingArgs = useRef<TArgs>();

  // Kept in a ref so the returned function is stable while still calling the latest callback — it
  // is safe to use in a dependency array, and an inline arrow passed to this hook doesn't reset the
  // timer on every render.
  const latestCallback = useRef(callback);
  latestCallback.current = callback;

  const run = useCallback(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = undefined;
    }

    const args = pendingArgs.current;

    if (!args) {
      return;
    }

    pendingArgs.current = undefined;
    latestCallback.current(...args);
  }, []);

  useEffect(() => {
    // `run` is stable, so this only ever runs on unmount.
    return () => run();
  }, [run]);

  return useCallback(
    (...args: TArgs) => {
      pendingArgs.current = args;

      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      timeout.current = setTimeout(run, delay);
    },
    [delay, run],
  );
}
