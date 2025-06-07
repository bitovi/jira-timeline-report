import React, { FC } from 'react';
import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';

import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import { getReportTypeOptions } from './utilities';
import { useAsyncFeatures } from '../../../services/features';

import { reports as REPORTS } from '../../../../configuration/reports';

const SelectReportType: FC = () => {
  //const [reports] = useReports();
  const [primaryReportType, setPrimaryReportType] = usePrimaryReportType();
  const { features, isLoading } = useAsyncFeatures();

  // Find selected Report from all reports and not just the visible options.
  // Although some options are hidden behind a feature flag, these options can
  // still function if the url defaults to that value.
  const selectedReportOption = REPORTS.find((reportTypeOption) => reportTypeOption.key === primaryReportType);

  const reportTypeOptions = features ? getReportTypeOptions(REPORTS, features) : [];

  return (
    <div className="flex flex-col items-start">
      <Label htmlFor="">Report type</Label>
      <DropdownMenu trigger={selectedReportOption?.name ?? ''} isLoading={isLoading}>
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
    </div>
  );
};

export default SelectReportType;
