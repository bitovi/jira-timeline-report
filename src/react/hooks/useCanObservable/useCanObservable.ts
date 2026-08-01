import { useEffect, useState } from 'react';

export interface CanObservable<TData> {
  value: TData;
  getData(): TData;
  on(handler: () => void): void;
  off(handler: () => void): void;
  set(value: TData): void;
  get(): TData;
}

export type CanPromise<T> = Promise<T> & {
  isResolved: boolean;
  isRejected: boolean;
  isPending: boolean;
  reason: {
    errorMessages: string[];
  };
  value: T;
};

export const useCanObservable = <TData>(observable: CanObservable<TData>): TData => {
  const [value, setValue] = useState<TData>(observable.value);

  useEffect(() => {
    const handler = () => {
      setValue(observable.value);
    };

    observable.on(handler);
    // Re-read now that we're subscribed. The value above was read while rendering, and a CanJS
    // observable is lazy: it holds nothing until something binds to it, and binding materializes
    // the current value silently — no change event, because nothing changed from its point of view.
    // Whatever landed between that render and this line would otherwise never reach the component.
    //
    // The gap is normally microseconds. A report that suspends stretches it across a whole fetch:
    // React discards a suspended render and skips its effects, so nothing is subscribed while the
    // report waits. That is how an embedded Table report — which calls `useJiraIssueFields`
    // (`useSuspenseQuery`) AFTER reading its issue observables — rendered its headers over an empty
    // body whenever its issues arrived before its field catalog did.
    //
    // Costs nothing when nothing was missed: React bails out of a re-render on an unchanged value.
    handler();

    return () => {
      observable.off(handler);
    };
  }, [observable]);

  return value;
};
