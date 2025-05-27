import { useRouteData } from '../../../../../hooks/useRouteData';
import { useSelectableStatuses } from '../../../../../services/issues/useSelectableStatuses';

export const useSelectedStatuses = (mode: 'show' | 'hide') => {
  const statuses = useSelectableStatuses();
  const [statusesToShow, setStatusesToShow] = useRouteData<string, string | string[]>('statusesToShow');
  const [statusesToRemove, setStatusesToRemove] = useRouteData<string, string | string[]>('statusesToRemove');

  const selectedStatuses = mode === 'show' ? statusesToShow : statusesToRemove;
  const setSelectedStatus = (newStatuses: Readonly<{ value: string }[]> | { value: string }[]) => {
    const update = newStatuses.map(({ value }) => value);

    if (mode === 'show') {
      setStatusesToShow(update);
    } else {
      setStatusesToRemove(update);
    }
  };

  const swapShowHideStatusesIfNeeded = (newMode: 'show' | 'hide') => {
    if (newMode === 'show') {
      if (statusesToRemove.length) {
        setStatusesToShow(statusesToRemove);
      }

      setStatusesToRemove('');
    } else {
      if (statusesToShow.length) {
        setStatusesToRemove(statusesToShow);
      }

      setStatusesToShow('');
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
  selectedStatuses: string,
) => {
  const decoded = decodeURIComponent(selectedStatuses);
  const members = decoded.split(',').filter(Boolean);

  if (!members.length) {
    return undefined;
  }

  return members.map((member) => ({
    label: allStatuses.find(({ value }) => value === member)?.label ?? '',
    value: member,
  }));
};
