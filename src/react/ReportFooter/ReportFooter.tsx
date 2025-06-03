import React, { FC } from 'react';

import StatusKey from './components/StatusKey';
import AutoSchedulerFooter from './components/AutoSchedulerFooter';
import { PrimaryReportType, usePrimaryReportType } from '../ReportControls/hooks/usePrimaryReportType';

const reportFooterMap = {
  'auto-scheduler': AutoSchedulerFooter,
  'start-due': StatusKey,
} as const satisfies Partial<Record<PrimaryReportType, FC>>;

const ReportFooter: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  if (primaryReportType !== 'auto-scheduler' && primaryReportType !== 'start-due') {
    return null;
  }

  const Footer = reportFooterMap[primaryReportType];

  return <Footer />;
};

export default ReportFooter;
