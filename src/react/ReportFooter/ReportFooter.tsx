import React, { FC } from 'react';

import StatusKey from './components/StatusKey';
import AutoSchedulerFooter from './components/AutoSchedulerFooter';
import { usePrimaryReportType } from '../ReportControls/hooks/usePrimaryReportType';

const Footer: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  if (primaryReportType === 'start-due') {
    return <StatusKey />;
  }

  if (primaryReportType === 'auto-scheduler') {
    return <AutoSchedulerFooter />;
  }

  return null;
};

export default Footer;
