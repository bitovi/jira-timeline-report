import type { FC, ReactNode } from 'react';

import React from 'react';
import { IconButton } from '@atlaskit/button/new';
import ArrowLeftIcon from '@atlaskit/icon/core/arrow-left';
import Heading from '@atlaskit/heading';

interface ViewReportsLayoutProps {
  onBackButtonClicked: () => void;
  /** The report Back returns to, named in the button's label and tooltip. */
  reportName?: string;
  /** Buttons on the right of the title row, e.g. "Create new report". */
  actions?: ReactNode;
  children?: ReactNode;
}

const ViewReportsLayout: FC<ViewReportsLayoutProps> = ({ onBackButtonClicked, reportName, actions, children }) => {
  return (
    <div className="p-6 flex flex-col h-screen">
      <div className="pb-4 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton
            icon={ArrowLeftIcon}
            label={reportName ? `Back to ${reportName}` : 'Back to report'}
            appearance="subtle"
            onClick={onBackButtonClicked}
            isTooltipDisabled={false}
          />
          <Heading size="large">Saved Reports</Heading>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
};

export default ViewReportsLayout;
