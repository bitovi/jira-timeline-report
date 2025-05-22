import { value } from "../../../can"
import routeData from "../../../canjs/routing/route-data"
import { useCanObservable } from "../useCanObservable"

export const useRouteData = <Value, SetValueArgument = Value>(keyPath: string) => {
  const observableValue = useCanObservable<Value>(value.from(routeData, keyPath));

  const setObservableValue = (value: SetValueArgument) => {
    // @ts-expect-error
    routeData[keyPath] = value;
  };

  return [observableValue, setObservableValue] as const;
}
