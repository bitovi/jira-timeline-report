import React, { FC, useEffect, useState } from 'react';
import SelectReportType from './components/SelectReportType';
import SelectIssueType from './components/SelectIssueType';
import CompareSlider from './components/CompareSlider';
import Filters from './components/Filters';
import ViewSettings from './components/ViewSettings';
import { usePrimaryReportType } from './hooks/usePrimaryReportType';
import UncertaintyControls from './components/UncertaintyControls';

export const ReportControls: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  return (
    <>
      <div className="pt-1">
        <SelectReportType />
      </div>
      <div className="pt-1">
        <SelectIssueType />
      </div>
      <UncertaintyControls
        toggle={() => {
          console.log('toggle');
        }}
      />

      {/* <div className="flex-grow px-2">
        <CompareSlider />
      </div>
      <div className="self-end pb-1">
        <Filters />
      </div>
      {primaryReportType !== 'table' ? (
        <div className="self-end pb-1">
          <ViewSettings />
        </div>
      ) : null} */}
    </>
  );
};

export default ReportControls;
