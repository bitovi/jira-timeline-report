import { value } from "../../../../../can";
import routeData from "../../../../../canjs/routing/route-data";
import { useCanObservable } from "../../../../hooks/useCanObservable";

export const useSelectedStartDate = () => {
  const selectedStartDate = useCanObservable<Date>(value.from(routeData, "selectedStartDate"));

  const setSelectedStartDate = (date: Date | null) => {
    // @ts-expect-error
    routeData.selectedStartDate = date;
  };

  return [selectedStartDate, setSelectedStartDate] as const;
};
