import type { FC, ReactNode } from 'react';

import React from 'react';

import SidebarButton from '../../../components/SidebarButton';
import ArrowLeftCircleIcon from '@atlaskit/icon/glyph/arrow-left-circle';
import Heading from '@atlaskit/heading';

interface ViewReportsLayoutProps {
  onBackButtonClicked: () => void;
  reportInfo?: ReactNode;
  /** Buttons on the right of the title row, e.g. "Create new report". */
  actions?: ReactNode;
  children?: ReactNode;
}

const ViewReportsLayout: FC<ViewReportsLayoutProps> = ({ onBackButtonClicked, reportInfo, actions, children }) => {
  return (
    <div className="p-6 flex flex-col h-screen">
      <SidebarButton className="flex items-center" onClick={onBackButtonClicked}>
        <ArrowLeftCircleIcon label="go back" />
        <div className="flex-col gap-1">
          Back to report
          {reportInfo}
        </div>
      </SidebarButton>
      <div className="py-4 flex items-center justify-between gap-4">
        <Heading size="large">Saved Reports</Heading>
        {actions}
      </div>
      {children}
    </div>
  );
};

export default ViewReportsLayout;
