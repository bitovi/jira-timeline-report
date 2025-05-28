import { value } from '../../../can';
import routeData from '../../../canjs/routing/route-data';
import { useCanObservable } from '../useCanObservable';

export type SetRouteData<T> = (value: T) => void;

export const useRouteData = <Value, SetValueArgument = Value>(
  keyPath: string,
): readonly [Value, SetRouteData<SetValueArgument>] => {
  // TODO: these can all be set on a global scope, that way there's only one
  // observable. This would be a performance improvement as there doesn't need
  // to be a separate subscription for each use of the hook.
  const observableValue = useCanObservable<Value>(value.from(routeData, keyPath));

  const setObservableValue: SetRouteData<SetValueArgument> = (value: SetValueArgument) => {
    // types are tricky for dealing with getter/setters which are needed for
    // updating can Observables
    // @ts-expect-error
    routeData[keyPath] = value;
  };

  return [observableValue, setObservableValue] as const;
};
