import React, { FC, ReactNode } from 'react';
import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';

import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import { useReports } from './hooks/useReports';
import { getReportTypeOptions } from './utilities';

interface Features {
  estimationTable: boolean;
  secondaryReport: boolean;
  workBreakdowns: boolean;
}

export interface SelectReportTypeProps {
  features: Features | null;
}

const SelectReportTypeWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Report type</Label>
      {children}
    </div>
  );
};

const SelectReportType: FC<SelectReportTypeProps> = ({ features }) => {
  const [reports] = useReports();
  const [primaryReportType, setPrimaryReportType] = usePrimaryReportType();

  // Find selected Report from all reports and not just the visible options.
  // Although some options are hidden behind a feature flag, these options can
  // still function if the url defaults to that value.
  const selectedReportOption = reports.find((reportTypeOption) => reportTypeOption.key === primaryReportType);

  const reportTypeOptions = features ? getReportTypeOptions(reports, features.estimationTable) : [];

  return (
    <SelectReportTypeWrapper>
      <DropdownMenu trigger={selectedReportOption?.name ?? ''} isLoading={!features}>
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
