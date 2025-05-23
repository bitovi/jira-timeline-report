import { useState } from 'react';
import { useSelectedStatuses } from './useSelectedStatuses';

export const useStatusFilters = () => {
  const [statusFilterType, setStatusFilterType] = useState<'show' | 'hide'>('show');
  const { statuses, selectedStatuses, setSelectedStatus, swapShowHideStatusesIfNeeded } =
    useSelectedStatuses(statusFilterType);

  const handleStatusFilterChange = (newStatus: 'show' | 'hide') => {
    setStatusFilterType(newStatus);
    swapShowHideStatusesIfNeeded(newStatus);
  };

  return {
    statuses,
    selectedStatuses,
    setSelectedStatus,
    setStatusFilterType: handleStatusFilterChange,
    statusFilterType,
  };
};
