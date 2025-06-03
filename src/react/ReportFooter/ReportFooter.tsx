import React, { FC } from 'react';

import StatusKey from './components/StatusKey';
import AutoSchedulerFooter from './components/AutoSchedulerFooter';
import { PrimaryReportType, usePrimaryReportType } from '../ReportControls/hooks/usePrimaryReportType';

const reportFooterMap: Partial<Record<PrimaryReportType, FC>> = {
  'auto-scheduler': AutoSchedulerFooter,
  'start-due': StatusKey,
};

const ReportFooter: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  const Footer = reportFooterMap[primaryReportType];

  if (!Footer) {
    return null;
  }

  return <Footer />;
};

export default ReportFooter;
