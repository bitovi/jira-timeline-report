import { useRouteData } from '../useRouteData';

export const useSelectedStartDate = () => {
  const [selectedStartDate, setSelectedStartDate] = useRouteData<Date, Date | null>('selectedStartDate');

  return [selectedStartDate, setSelectedStartDate] as const;
};
