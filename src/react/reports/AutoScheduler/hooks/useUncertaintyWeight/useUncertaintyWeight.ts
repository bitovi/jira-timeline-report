import { value } from "../../../../../can";
import routeData from "../../../../../canjs/routing/route-data";
import { pushStateObservable } from "../../../../../canjs/routing/state-storage";
import { useCanObservable } from "../../../../hooks/useCanObservable";
import { useQueryParams } from "../../../../hooks/useQueryParams";

export type UncertaintyWeight = number | "average";

export const useUncertaintyWeight = () => {
  const uncertaintyWeight = useCanObservable<UncertaintyWeight>(
    value.from(routeData, "uncertaintyWeight")
  );

  const setUncertaintyWeight = (weight: UncertaintyWeight | null) => {
    const value = weight || "average";

    // @ts-expect-error
    routeData.uncertaintyWeight = value;
  };

  return [uncertaintyWeight, setUncertaintyWeight] as const;
};
