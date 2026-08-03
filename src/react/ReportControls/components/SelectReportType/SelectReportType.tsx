import React, { FC } from 'react';
import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';

import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import { getReportTypeOptions } from './utilities';
import { useAsyncFeatures } from '../../../services/features';
import { SECTIONS_PARAM } from '../../../reports/ReportOfReports/model/documentParam';
import { deleteUrlParam } from '../../../../canjs/routing/state-storage';

import { reports as REPORTS } from '../../../../configuration/reports';

const REPORT_OF_REPORTS = 'report-of-reports';

const SelectReportType: FC = () => {
  //const [reports] = useReports();
  const [primaryReportType, setPrimaryReportType] = usePrimaryReportType();
  const { features, isLoading } = useAsyncFeatures();

  /**
   * A report-type switch deliberately leaves every other param in the URL, so the settings reports
   * share — the JQL, the issue type, the filters — survive the move instead of being re-entered.
   *
   * `sections` is the one param that must not come along. It *is* the report-of-reports document
   * (kilobytes of encoded tree), it means nothing to any other report, and left behind it bloats
   * every URL it rides on and makes the open saved report read as dirty.
   *
   * Dropped after the switch rather than before, so the entry the type change pushed is the one the
   * removal amends (see `deleteUrlParam`) and Back still returns to the document as it was. Removing
   * the param is also what discards the tree: `ReportLayoutProvider` reads an absent `sections` as
   * "the document is whatever the open report has saved", so an in-progress one is gone. That is the
   * consequence of the URL *being* the document rather than mirroring it — there is nowhere else the
   * live tree is kept.
   */
  const selectReportType = (reportType: string) => {
    setPrimaryReportType(reportType);

    if (reportType !== REPORT_OF_REPORTS) {
      deleteUrlParam(SECTIONS_PARAM);
    }
  };

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
              onClick={() => selectReportType(reportTypeOption.key)}
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
