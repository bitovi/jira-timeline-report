import type { FC } from 'react';
import React, { useId } from 'react';
import Select from '@atlaskit/select';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { useRouteData } from '../../../../../../hooks/useRouteData';

const booleanParsing = {
  parse: (x: string) => {
    return { '': true, true: true, false: false }[x];
  },
  stringify: (x: boolean) => '' + x,
};

const sortBy = [
  { label: 'JQL Order', value: 'false' },
  { label: 'Due Date', value: 'true' },
];

const useSortBy = () => {
  const [selectedSortBy, setSelectedSortBy] = useRouteData<boolean, boolean | undefined>('sortByDueDate');

  const handleSelectedSortByChange = (value: string) => {
    setSelectedSortBy(booleanParsing.parse(value));
  };

  return {
    sortBy,
    selectedSortBy: sortBy.find(({ value }) => value === booleanParsing.stringify(selectedSortBy)),
    handleSelectedSortByChange,
  };
};

const SortBy: FC = () => {
  const id = useId();
  const { sortBy, selectedSortBy, handleSelectedSortByChange } = useSortBy();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Sort By</label>
      </VisuallyHidden>
      <Select
        id={id}
        className="flex-1"
        options={sortBy}
        value={selectedSortBy}
        onChange={(option) => handleSelectedSortByChange(option?.value ?? 'false')}
      />
    </div>
  );
};

export default SortBy;
