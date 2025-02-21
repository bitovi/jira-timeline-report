import { value } from "../../../../can";
import routeData from "../../../../canjs/routing/route-data";
import { useCanObservable } from "../../../hooks/useCanObservable";
import { useSelectableStatuses } from "./useSelectableStatuses";

export const useSelectedStatuses = (mode: "show" | "hide") => {
  const statuses = useSelectableStatuses();
  const statusesToShow = useCanObservable<string>(value.from(routeData, "statusesToShow"));
  const statusesToRemove = useCanObservable<string>(value.from(routeData, "statusesToRemove"));

  const selectedStatuses = mode === "show" ? statusesToShow : statusesToRemove;
  const setSelectedStatus = (newStatuses: Readonly<{ value: string }[]> | { value: string }[]) => {
    //@ts-expect-error
    routeData[mode === "show" ? "statusesToShow" : "statusesToRemove"] = newStatuses
      .map(({ value }) => value)
      .join(",");
  };

  const swapShowHideStatusesIfNeeded = (newMode: "show" | "hide") => {
    if (newMode === "show") {
      if (statusesToRemove.length) {
        // @ts-expect-error
        routeData.statusesToShow = statusesToRemove;
      }
      // @ts-expect-error
      routeData.statusesToRemove = "";
    } else {
      if (statusesToShow.length) {
        // @ts-expect-error
        routeData.statusesToRemove = statusesToShow;
      }
      // @ts-expect-error
      routeData.statusesToShow = "";
    }
  };

  return {
    statuses,
    selectedStatuses: convertToSelectValue(statuses, selectedStatuses),
    setSelectedStatus,
    swapShowHideStatusesIfNeeded,
  };
};

const convertToSelectValue = (
  allStatuses: {
    label: string;
    value: string;
  }[],
  selectedStatuses: string
) => {
  const decoded = decodeURIComponent(selectedStatuses);
  const members = decoded.split(",").filter(Boolean);

  if (!members.length) {
    return undefined;
  }

  return members.map((member) => ({
    label: allStatuses.find(({ value }) => value === member)?.label ?? "",
    value: member,
  }));
};
