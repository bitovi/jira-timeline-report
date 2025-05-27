import React, { FC, useEffect, useState } from 'react';
import SelectReportType from './components/SelectReportType';
import { Features } from './utilities';
import SelectIssueType from './components/SelectIssueType';
import CompareSlider from './components/CompareSlider';
import Filters from './components/Filters';
import ViewSettings from './components/ViewSettings';
import { usePrimaryReportType } from './hooks/usePrimaryReportType';

export interface ReportControlsProps {
  features: Promise<Features>;
}

export const ReportControls: FC<ReportControlsProps> = ({ features: featuresProp }) => {
  const [features, setFeatures] = useState<null | Features>(null);
  const [primaryReportType] = usePrimaryReportType();

  useEffect(() => {
    featuresProp.then((features) => {
      setFeatures(features);
    });
  }, [featuresProp]);

  return (
    <>
      <div className="pt-1">
        <SelectReportType features={features} />
      </div>
      <div className="pt-1">
        <SelectIssueType />
      </div>
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
    </>
  );
};

export default ReportControls;
