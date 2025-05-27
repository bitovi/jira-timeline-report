import type { FC } from 'react';

import React, { useId } from 'react';
import Select from '@atlaskit/select';
import VisuallyHidden from '@atlaskit/visually-hidden';
import { useCanObservable } from '../../../../../../hooks/useCanObservable';
import { value } from '../../../../../../../can';
import routeData from '../../../../../../../canjs/routing/route-data';

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
  const selectedSortBy = useCanObservable<boolean>(value.from(routeData, 'sortByDueDate'));

  const setSelectedSortBy = (value: string) => {
    // @ts-expect-error
    routeData.sortByDueDate = booleanParsing.parse(value);
  };

  return {
    sortBy,
    selectedSortBy: sortBy.find(({ value }) => value === booleanParsing.stringify(selectedSortBy)),
    setSelectedSortBy,
  };
};

const SortBy: FC = () => {
  const id = useId();
  const { sortBy, selectedSortBy, setSelectedSortBy } = useSortBy();

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
        onChange={(option) => setSelectedSortBy(option?.value ?? 'false')}
      />
    </div>
  );
};

export default SortBy;
