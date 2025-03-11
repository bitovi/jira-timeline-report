import type { IssueType } from "../../../../../../utils/timing/helpers";

import { useMemo } from "react";

import { value } from "../../../../../../can";
import routeData from "../../../../../../canjs/routing/route-data";
import { useCanObservable } from "../../../../../hooks/useCanObservable";
import { getTimingLevels } from "../../../../../../utils/timing/helpers";

const DEFAULT_CALCULATION_METHOD = "widestRange";

export const useTimingCalculations = () => {
  const issueHierarchy = useCanObservable<IssueType[]>(
    value.from(routeData, "simplifiedIssueHierarchy")
  );
  const timingCalculations = useCanObservable<Record<string, string>>(
    value.from(routeData, "timingCalculations")
  );

  const selectableTimingLevels = useMemo(() => {
    if (!issueHierarchy) {
      return [];
    } else {
      const allLevels = getTimingLevels(issueHierarchy, timingCalculations);
      return allLevels.slice(0, allLevels.length - 1);
    }
  }, [issueHierarchy]);

  const updateCalculation = (type: string, value: string) => {
    let current = { ...routeData.timingCalculations };
    if (value === DEFAULT_CALCULATION_METHOD) {
      delete current[type];
    } else {
      current[type] = value;
    }

    routeData.timingCalculations = current;
  };

  return {
    selectableTimingLevels,
    updateCalculation,
  };
};
