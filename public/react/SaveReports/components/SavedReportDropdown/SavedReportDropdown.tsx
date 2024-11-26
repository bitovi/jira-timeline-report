import type { FC } from "react";
import type { Reports } from "../../../../jira/reports";

import React, { useState } from "react";

import DropdownMenu, { DropdownItem, DropdownItemGroup } from "@atlaskit/dropdown-menu";
import Hr from "../../../components/Hr";

interface SavedReportDropdownProps {
  onViewReportsButtonClicked: () => void;
  recentReports: string[];
  reports: Reports;
}

const SavedReportDropdown: FC<SavedReportDropdownProps> = ({ onViewReportsButtonClicked, recentReports, reports }) => {
  // needed to not interfer with can routing
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu
      isOpen={isOpen}
      onOpenChange={() => setIsOpen((prev) => !prev)}
      trigger="Saved Reports"
      shouldRenderToParent
    >
      {recentReports?.length === 0 ? (
        <EmptyView />
      ) : (
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
                // needed to not interfer with can routing

                event.stopPropagation();

                onViewReportsButtonClicked();
                setIsOpen(false);
              }}
            >
              View all saved reports
            </DropdownItem>
          </DropdownItemGroup>
        </>
      )}
    </DropdownMenu>
  );
};

export default SavedReportDropdown;

const EmptyView = () => {
  return (
    <DropdownItemGroup>
      <div className="max-w-64 flex flex-col items-center gap-4 p-4 text-center">
        <img src="/assets/no-reports.png" />
        <p className="text-xl font-semibold">You don't have any saved reports</p>
        <p className="text-sm">When you save your first report, you will be able to access it here.</p>
      </div>
    </DropdownItemGroup>
  );
};

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
      onClick={(event) => {
        // needed to not interfer with can routing
        window.location.search = "?" + matched.queryParams;
        event.stopPropagation();
      }}
    >
      Report name {matched.name}
    </DropdownItem>
  );
};
