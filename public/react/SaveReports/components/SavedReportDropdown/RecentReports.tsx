import type { FC } from "react";
import type { Reports } from "../../../../jira/reports";

import React, { forwardRef } from "react";

import { DropdownItem, DropdownItemGroup } from "@atlaskit/dropdown-menu";
import Hr from "../../../components/Hr";

interface RecentReportsProps {
  recentReports: string[];
  reports: Reports;
  onViewReportsButtonClicked: () => void;
  setIsOpen: (isOpen: boolean) => void;
}

const RecentReports: FC<RecentReportsProps> = ({
  recentReports,
  reports,
  onViewReportsButtonClicked,
  setIsOpen,
}) => {
  return (
    <>
      <DropdownItemGroup>
        <p className="p-4 text-xs text-slate-400 font-semibold uppercase">Recent</p>
        {recentReports.map((reportId) => (
          <ReportListItem key={reportId} reportId={reportId} reports={reports} />
        ))}
      </DropdownItemGroup>
      <Hr className="!my-1" />
      <DropdownItemGroup>
        <DropdownItem
          onClick={(event) => {
            // needed to not interfere with can routing
            event.stopPropagation();

            onViewReportsButtonClicked();
            setIsOpen(false);
          }}
        >
          View all saved reports
        </DropdownItem>
      </DropdownItemGroup>
    </>
  );
};

export default RecentReports;

interface ReportListItemProps {
  reports: Reports;
  reportId: string;
}

const ReportListItem: FC<ReportListItemProps> = ({ reports, reportId }) => {
  const matched = Object.values(reports).find((report) => report?.id === reportId);

  if (!matched) {
    return null;
  }

  return (
    <DropdownItem
      key={reportId}
      // @ts-expect-error types for component overrides on ADS don't work
      component="a"
      href={"?" + matched.queryParams}
    >
      {matched.name}
    </DropdownItem>
  );
};
