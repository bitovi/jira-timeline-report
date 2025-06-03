import type { FC } from 'react';
import React from 'react';
import Button from '@atlaskit/button/new';

import UncertaintySlider from './components/UncertaintySlider';
import { useUncertaintyWeight } from '../../../hooks/useUncertaintyWeight';
import { useSelectedStartDate } from '../../../hooks/useSelectedStartDate/useSelectedStartDate';
import { useSelectedIssueType } from '../../../services/issues';
import { useRouteData } from '../../../hooks/useRouteData';
import { Label } from '@atlaskit/form';

const AutoSchedulerControls: FC = () => {
  const [selectedStartDate, setSelectedStartDate] = useSelectedStartDate();
  const [uncertaintyWeight, setUncertaintyWeight] = useUncertaintyWeight();
  const { selectedIssueType } = useSelectedIssueType();
  const [, setIsOpen] = useRouteData<boolean>('openAutoSchedulerModal');

  return (
    <>
      <UncertaintySlider uncertaintyWeight={uncertaintyWeight} onChange={setUncertaintyWeight} />
      <div className="flex flex-col items-start pt-1 pl-1">
        <Label htmlFor="auto-scheduler-date-picker">Start date</Label>
        <input
          id="auto-scheduler-date-picker"
          className="border border-gray-300 rounded-md px-[11px] pr-[7px] py-[5px] text-sm leading-[18px] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-10 cursor-pointer"
          type="date"
          // format for input
          value={selectedStartDate.toISOString().split('T')[0]}
          onChange={(e) => setSelectedStartDate(e.target.valueAsDate)}
        />
      </div>

      <div className="self-end">
        <Button appearance="primary" onClick={() => setIsOpen(true)}>
          Update {selectedIssueType} Dates
        </Button>
      </div>
    </>
  );
};

export default AutoSchedulerControls;
