import { pushStateObservable } from "../../../../../canjs/routing/state-storage";
import { useQueryParams } from "../../../../hooks/useQueryParams";

export type UncertaintyWeight = number | "average";

export const useUncertaintyWeight = () => {
  const { queryParamString, queryParams } = useQueryParams(pushStateObservable);

  const uncertaintyWeight = queryParams.get("uncertaintyWeight") as UncertaintyWeight;

  const setUncertaintyWeight = (weight: UncertaintyWeight | null) => {
    const value = weight || "average";

    const updated = new URLSearchParams(queryParamString);
    updated.delete("uncertaintyWeight");
    updated.set("uncertaintyWeight", value.toString());

    pushStateObservable.set(updated.toString());
  };

  return [uncertaintyWeight, setUncertaintyWeight] as const;
};
