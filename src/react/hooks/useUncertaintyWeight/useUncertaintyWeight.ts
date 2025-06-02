import { useRouteData } from '../useRouteData';
import { UncertaintyWeight } from '../../reports/AutoScheduler/scheduler/stats-analyzer';

export const useUncertaintyWeight = () => {
  const [uncertaintyWeight, setUncertaintyWeight] = useRouteData<UncertaintyWeight>('uncertaintyWeight');

  const handleUncertaintyWeightChange = (weight: UncertaintyWeight | null) => {
    setUncertaintyWeight(weight || 'average');
  };

  return [uncertaintyWeight, handleUncertaintyWeightChange] as const;
};
