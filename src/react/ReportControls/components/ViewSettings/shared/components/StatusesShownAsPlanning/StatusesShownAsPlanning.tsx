import type { FC } from 'react';

import React, { useId } from 'react';
import Select from '@atlaskit/select';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { useSelectableStatuses } from '../../../../../../services/issues';
import { useRouteData } from '../../../../../../hooks/useRouteData';

const useSelectedStatuses = () => {
  const statuses = useSelectableStatuses();
  const [selectedStatuses, setSelectedStatuses] = useRouteData<string[]>('planningStatuses');

  return {
    statuses,
    selectedStatuses: statuses.filter(({ value }) => selectedStatuses.includes(value)),
    setSelectedStatuses,
  };
};

const StatusesShownAsPlanning: FC = () => {
  const id = useId();
  const { statuses, selectedStatuses, setSelectedStatuses } = useSelectedStatuses();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Statuses Shown as Planning</label>
      </VisuallyHidden>
      <Select
        isMulti
        isSearchable
        id={id}
        className="flex-1"
        options={statuses}
        value={selectedStatuses}
        onChange={(options) => setSelectedStatuses(options.map(({ value }) => value))}
      />
    </div>
  );
};

export default StatusesShownAsPlanning;
