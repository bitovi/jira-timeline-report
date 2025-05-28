import { useMemo } from 'react';

import { useRouteData } from '../../../../../hooks/useRouteData';
import type { IssueType } from '../../../../../../utils/timing/helpers';
import { getTimingLevels } from '../../../../../../utils/timing/helpers';

const DEFAULT_CALCULATION_METHOD = 'widestRange';

export const useTimingCalculations = () => {
  const [issueHierarchy] = useRouteData<IssueType[]>('simplifiedIssueHierarchy');
  const [timingCalculations, setTimingCalculations] = useRouteData<Record<string, string>>('timingCalculations');

  const selectableTimingLevels = useMemo(() => {
    if (!issueHierarchy) {
      return [];
    } else {
      const allLevels = getTimingLevels(issueHierarchy, timingCalculations);
      return allLevels.slice(0, allLevels.length - 1);
    }
  }, [issueHierarchy]);

  const updateCalculation = (type: string, value: string) => {
    const current = { ...timingCalculations };
    if (value === DEFAULT_CALCULATION_METHOD) {
      delete current[type];
    } else {
      current[type] = value;
    }

    setTimingCalculations(current);
  };

  return {
    selectableTimingLevels,
    updateCalculation,
  };
};
