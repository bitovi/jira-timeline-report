import { pushStateObservable } from "../../../../../canjs/routing/state-storage";
import { nowUTC } from "../../../../../utils/date/utc";
import { useQueryParams } from "../../../../hooks/useQueryParams";

function deserialize(date: string | null | undefined): Date {
  if (!date) {
    return nowUTC();
  }

  return new Date(date);
}

function serialize(date: Date): string {
  return date.toISOString();
}

export const useSelectedStartDate = () => {
  const { queryParamString, queryParams } = useQueryParams(pushStateObservable);

  const selectedStartDate = deserialize(queryParams.get("selectedStartDate"));

  const setSelectedStartDate = (date: Date | null) => {
    const serialized = serialize(date ?? nowUTC());

    const updated = new URLSearchParams(queryParamString);
    updated.delete("selectedStartDate");
    updated.set("selectedStartDate", serialized);

    pushStateObservable.set(updated.toString());
  };

  return [selectedStartDate, setSelectedStartDate] as const;
};
