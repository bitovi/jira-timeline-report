import { useRouteData } from "../../../hooks/useRouteData";

export const useCompareToType = () => {
  return useRouteData<"date" | "seconds">("compareToType");
};
