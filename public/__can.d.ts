

export var value: Value;
export var ObservableObject: ObservableObject;
export var queues: any;
export var Observation: any;

type Value = {
  from: <T>(object: typeof ObservableObject | CanObservable<any>, keyPath?: string) => CanObservable<T>
  bind: <T>(object: typeof ObservableObject | CanObservable<any>, keyPath?: string) => CanObservable<T>
}


type ObservableObject = Function;

