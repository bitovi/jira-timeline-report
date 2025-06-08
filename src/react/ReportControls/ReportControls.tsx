import React, { FC, ReactNode } from 'react';
import SelectReportType from './components/SelectReportType';
import SelectIssueType from './components/SelectIssueType';
import CompareSlider from './components/CompareSlider';
import Filters from './components/Filters';
import ViewSettings from './components/ViewSettings';
import { usePrimaryReportType } from './hooks/usePrimaryReportType';
import AutoSchedulerControls from './components/AutoSchedulerControls';

export const ReportControlsWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      <div className="pt-1">
        <SelectReportType />
      </div>
      <div className="pt-1">
        <SelectIssueType />
      </div>
      {children}
    </>
  );
};

export const ReportControls: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  if (primaryReportType === 'estimation-progress' || primaryReportType === 'grouper') {
    return (
      <>
        <SelectReportType />
        <SelectIssueType />
      </>
    );
  }

  if (primaryReportType === 'estimate-analysis') {
    return (
      <>
        <SelectReportType />
        <SelectIssueType />
      </>
    );
  }

  if (primaryReportType === 'auto-scheduler') {
    return (
      <ReportControlsWrapper>
        <AutoSchedulerControls />
      </ReportControlsWrapper>
    );
  }

  return (
    <ReportControlsWrapper>
      <div className="flex-grow px-2">
        <CompareSlider />
      </div>
      <div className="self-end pb-1">
        <Filters />
      </div>

      {primaryReportType !== 'table' ? (
        <div className="self-end pb-1">
          <ViewSettings />
        </div>
      ) : null}
    </ReportControlsWrapper>
  );
};

export default ReportControls;
