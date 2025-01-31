import { useEffect, useState } from "react";

export interface CanObservable<TData> {
  value: TData;
  getData(): TData;
  on(handler: () => void): void;
  off(handler: () => void): void;
  set(value: TData): void;
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

    return () => {
      observable.off(handler);
    };
  }, [observable]);

  return value;
};
