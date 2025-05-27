import type { FC } from 'react';

import React, { useId } from 'react';
import Select from '@atlaskit/select';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { useSelectableStatuses } from '../../../../../../services/issues';
import { useCanObservable } from '../../../../../../hooks/useCanObservable';
import { value } from '../../../../../../../can';
import routeData from '../../../../../../../canjs/routing/route-data';

const useSelectedStatuses = () => {
  const statuses = useSelectableStatuses();

  const selectedStatuses = useCanObservable<string[]>(value.from(routeData, 'planningStatuses'));

  const setSelectedStatuses = (newValue: string[]) => {
    // @ts-expect-error
    routeData.planningStatuses = newValue;
  };

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
