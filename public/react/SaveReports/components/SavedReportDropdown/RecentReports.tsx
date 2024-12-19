import type { FC } from "react";
import type { Report, Reports } from "../../../../jira/reports";

import React, { useMemo } from "react";

import { DropdownItem, DropdownItemGroup } from "@atlaskit/dropdown-menu";
import Hr from "../../../components/Hr";
import { pushStateObservable } from "@routing-observable";
import { notEmpty } from "../../../../jira/shared/helpers";

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
  const reportsToShow = useMemo(
    () =>
      recentReports
        .map((id) => reports[id])
        .filter(notEmpty)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [recentReports, reports]
  );
  
  return (
    <>
      <DropdownItemGroup>
        <p className="p-4 text-xs text-slate-400 font-semibold uppercase">Recent</p>
        {reportsToShow.map((report) => (
          <ReportListItem key={report.id} report={report} />
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

const ReportListItem: FC<{ report: Report }> = ({ report }) => (
  <DropdownItem
    key={report.id}
    // @ts-expect-error types for component overrides on ADS don't work
    component="a"
    href={"?" + report.queryParams}
  >
    {report.name}
  </DropdownItem>
);
