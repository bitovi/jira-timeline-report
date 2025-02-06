import { allStatusesSorted } from "../../../../../../../../jira/normalized/normalize";
import { CanObservable } from "../../../../../../../hooks/useCanObservable";
import routeData from "../../../../../../../../canjs/routing/route-data";
import { value } from "../../../../../../../../can";
import { useMemo } from "react";

const useExcludedStatusSelect = () => {
  const derivedIssuesObservable: CanObservable<{ status: string; team: { name: string } }[]> =
    value.from(routeData, "derivedIssues");

  const processStatuses = () => {
    if (derivedIssuesObservable.get()) {
      return allStatusesSorted(derivedIssuesObservable.get());
    } else {
      return [];
    }
  };

  const allStatuses = processStatuses();
  const allStatusesOptions = useMemo(
    () => allStatuses.map((status) => ({ label: status, value: status })),
    [allStatuses]
  );

  return {
    allStatusesOptions,
  };
};
export default useExcludedStatusSelect;
