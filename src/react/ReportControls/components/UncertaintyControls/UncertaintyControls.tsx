import type { FC } from 'react';
import React from 'react';
import Button from '@atlaskit/button/new';

import UncertaintySlider from './components/UncertaintySlider';
import { useUncertaintyWeight } from '../../../reports/AutoScheduler/hooks/useUncertaintyWeight';
import { useSelectedStartDate } from '../../../reports/AutoScheduler/hooks/useSelectedStartDate/useSelectedStartDate';
import { useSelectedIssueType } from '../../../services/issues';
import { useRouteData } from '../../../hooks/useRouteData';

export type UncertaintyWeight = number | 'average';

const Controls: FC = () => {
  const [selectedStartDate, setSelectedStartDate] = useSelectedStartDate();
  const [uncertaintyWeight, setUncertaintyWeight] = useUncertaintyWeight();
  const { selectedIssueType } = useSelectedIssueType();
  const [, setIsOpen] = useRouteData<boolean>('openAutoSchedulerModal');

  return (
    <>
      <UncertaintySlider uncertaintyWeight={uncertaintyWeight} onChange={setUncertaintyWeight} />
      <label htmlFor="date-picker">Start Date:</label>
      <input
        className="border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-white/10 dark:text-white"
        type="date"
        // format for input
        value={selectedStartDate.toISOString().split('T')[0]}
        onChange={(e) => setSelectedStartDate(e.target.valueAsDate)}
      />
      <Button appearance="primary" onClick={() => setIsOpen(true)}>
        Update {selectedIssueType} Dates
      </Button>
    </>
  );
};

export default Controls;
