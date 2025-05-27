import React, { FC, ReactNode, useEffect, useId, useState } from 'react';
import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';

import { usePrimaryReportType } from './hooks/usePrimaryReportType';
import { useReports } from './hooks/useReports';
import { getReportTypeOptions } from './utilities';

interface Features {
  estimationTable: boolean;
  secondaryReport: boolean;
  workBreakdowns: boolean;
}

export interface SelectReportTypeProps {
  features: Promise<Features>;
}

const SelectReportTypeWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Report type</Label>
      {children}
    </div>
  );
};

const SelectReportType: FC<SelectReportTypeProps> = ({ features: featuresProp }) => {
  const [features, setFeatures] = useState<null | Features>(null);

  useEffect(() => {
    featuresProp.then((features) => {
      setFeatures(features);
    });
  }, [featuresProp]);

  const [reports] = useReports();
  const [primaryReportType, setPrimaryReportType] = usePrimaryReportType();

  if (!features) {
    return (
      <SelectReportTypeWrapper>
        <DropdownMenu trigger="Loading..." isLoading />
      </SelectReportTypeWrapper>
    );
  }

  const reportTypeOptions = getReportTypeOptions(reports, features.estimationTable);
  const selectedReportOption = reportTypeOptions.find((reportTypeOption) => reportTypeOption.key === primaryReportType);

  return (
    <SelectReportTypeWrapper>
      <DropdownMenu trigger={selectedReportOption?.name ?? ''}>
        <DropdownItemGroup>
          {reportTypeOptions.map((reportTypeOption) => (
            <DropdownItem
              key={reportTypeOption.key}
              isSelected={reportTypeOption.key === primaryReportType}
              onClick={() => setPrimaryReportType(reportTypeOption.key)}
            >
              {reportTypeOption.name}
            </DropdownItem>
          ))}
        </DropdownItemGroup>
      </DropdownMenu>
    </SelectReportTypeWrapper>
  );
};

export default SelectReportType;
