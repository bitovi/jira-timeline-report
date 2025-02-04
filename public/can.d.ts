import { CanObservable } from "./react/hooks/useCanObservable/useCanObservable.js";

type Value = {
  from: <T>(
    object: typeof ObservableObject | CanObservable<any>,
    keyPath?: string
  ) => CanObservable<T>;
  bind: <T>(
    object: typeof ObservableObject | CanObservable<any>,
    keyPath?: string
  ) => CanObservable<T>;
};

type ObservableObject = Function;

class Observation<T> {
  constructor(fn: () => T) {}
}

class SimpleObservable<T> {
  constructor(init: T) {}

  getData: () => T;
  value: T;
  on: (handler: () => void) => void;
  off: (handler: () => void) => void;
  set: (value: TData) => void;
  get(): TData;
}

export var value: Value;
export var ObservableObject: ObservableObject;
export var queues: any;
export var Observation: Observation;
export var SimpleObservable: SimpleObservable;
