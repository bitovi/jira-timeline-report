import type { FC } from 'react';
import React, { useId } from 'react';
import Select from '@atlaskit/select';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { useRouteData } from '../../../../../../hooks/useRouteData';

const secondaryReportTypes = [
  { label: 'None', value: 'none' },
  { label: 'Status', value: 'status' },
  { label: 'Work Breakdown', value: 'breakdown' },
];

const useSecondaryReportType = () => {
  const [selectedSecondaryReportType, setSelectedSecondaryReportType] = useRouteData<string>('secondaryReportType');

  return {
    secondaryReportTypes,
    selectedSecondaryReportType: secondaryReportTypes.find(({ value }) => value === selectedSecondaryReportType),
    setSelectedSecondaryReportType,
  };
};

const SecondaryReportType: FC = () => {
  const id = useId();
  const { secondaryReportTypes, selectedSecondaryReportType, setSelectedSecondaryReportType } =
    useSecondaryReportType();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Secondary Report Type</label>
      </VisuallyHidden>
      <Select
        id={id}
        className="flex-1"
        options={secondaryReportTypes}
        value={selectedSecondaryReportType}
        onChange={(option) => setSelectedSecondaryReportType(option?.value ?? '')}
      />
    </div>
  );
};

export default SecondaryReportType;
