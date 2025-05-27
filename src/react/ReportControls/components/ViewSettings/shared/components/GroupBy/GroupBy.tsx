import type { FC } from 'react';
import React, { useId } from 'react';
import Select from '@atlaskit/select';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { useRouteData } from '../../../../../../hooks/useRouteData';

const groupBy = [
  { label: 'None', value: '' },
  { label: 'Parent', value: 'parent' },
  { label: 'Team', value: 'team' },
];

const useGroupBy = () => {
  const [selectedGroupBy, setSelectedGroupBy] = useRouteData<string>('groupBy');

  return {
    groupBy,
    selectedGroupBy: groupBy.find(({ value }) => value === selectedGroupBy),
    setSelectedGroupBy,
  };
};

const GroupBy: FC = () => {
  const id = useId();
  const { groupBy, selectedGroupBy, setSelectedGroupBy } = useGroupBy();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Group By</label>
      </VisuallyHidden>
      <Select
        id={id}
        className="flex-1"
        options={groupBy}
        value={selectedGroupBy}
        onChange={(option) => setSelectedGroupBy(option?.value ?? '')}
      />
    </div>
  );
};

export default GroupBy;
