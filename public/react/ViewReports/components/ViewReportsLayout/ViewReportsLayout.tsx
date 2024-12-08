import type { FC, ReactNode } from "react";

import React from "react";

import SidebarButton from "../../../components/SidebarButton";
import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button/new";

interface ViewReportsLayoutProps {
  onBackButtonClicked: () => void;
  reportInfo?: ReactNode;
  children?: ReactNode;
}

const ViewReportsLayout: FC<ViewReportsLayoutProps> = ({ onBackButtonClicked, reportInfo, children }) => {
  return (
    <div className="p-6">
      <SidebarButton className="flex items-center" onClick={onBackButtonClicked}>
        <ArrowLeftCircleIcon label="go back" />
        <div className="flex-col gap-1">
          Back to report
          {reportInfo}
        </div>
      </SidebarButton>
      <div className="py-4 flex justify-between">
        <Heading size="large">Saved Reports</Heading>
        <Button appearance="primary" onClick={onBackButtonClicked}>
          Create new report
        </Button>
      </div>
      {children}
    </div>
  );
};

export default ViewReportsLayout;
