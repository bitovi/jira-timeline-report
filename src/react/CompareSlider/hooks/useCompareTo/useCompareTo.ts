import { useRouteData } from "../../../hooks/useRouteData";

export const useCompareTo = () => {
  return useRouteData<number, number | string>("compareTo");
};

export type CompareTo = ReturnType<typeof useCompareTo>[0];
export type SetCompareTo = ReturnType<typeof useCompareTo>[1];
