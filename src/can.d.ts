import { CanObservable } from './react/hooks/useCanObservable/useCanObservable.js';

type Value = {
  from: <T>(object: typeof ObservableObject | CanObservable<any>, keyPath?: string) => CanObservable<T>;
  bind: <T>(object: typeof ObservableObject | CanObservable<any>, keyPath?: string) => CanObservable<T>;
  /**
   * A computed observable — recomputes whenever any observable read inside `getter` changes, so
   * subscribers only hear about changes to the derived value. Already used from .js
   * (canjs/controls/timeline-configuration/state-helpers.js).
   */
  returnedBy: <T>(getter: () => T, context?: unknown, initialValue?: T) => CanObservable<T>;
};

type ObservableObject = Function;

export var value: Value;
export var ObservableObject: ObservableObject;
export var queues: any;

// The rest of the re-export surface. These are only consumed from .js files today (which tsconfig
// excludes), so they are untyped — declared here so this file stays an accurate description of
// what `can.js` actually exports.
export var Reflect: any;
export var route: any;
export var RoutePushstate: any;
export var diff: any;
export var type: any;
export var domEvents: any;
export var domMutateDomEvents: any;
