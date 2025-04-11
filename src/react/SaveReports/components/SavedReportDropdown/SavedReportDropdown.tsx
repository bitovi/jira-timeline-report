import type { FC } from "react";
import type { Report, Reports } from "../../../../jira/reports";

import React, { useMemo, useState } from "react";

import DropdownMenu from "@atlaskit/dropdown-menu";
import EmptyView from "./EmptyView";
import RecentReports from "./RecentReports";

interface SavedReportDropdownProps {
  onViewReportsButtonClicked: () => void;
  recentReports: string[];
  reports: Reports;
}

const numberOfRecentReportsToShow = 5;

const SavedReportDropdown: FC<SavedReportDropdownProps> = ({
  onViewReportsButtonClicked,
  recentReports: recentReportsProp,
  reports,
}) => {
  // Need to control so not to interfere with can routing
  const [isOpen, setIsOpen] = useState(false);

  const recentReports = useMemo(() => {
    if (recentReportsProp.length >= numberOfRecentReportsToShow) {
      return recentReportsProp;
    }

    // User could have reports but no recents
    const allReports = Object.values(reports) as Array<Report>;

    return [
      ...recentReportsProp,
      ...allReports.filter((report) => !recentReportsProp.includes(report.id)).map(({ id }) => id),
    ].slice(0, numberOfRecentReportsToShow);
  }, [reports, recentReportsProp]);

  return (
    <DropdownMenu
      isOpen={isOpen}
      onOpenChange={() => setIsOpen((prev) => !prev)}
      trigger="Saved reports"
      shouldRenderToParent
    >
      {recentReports?.length === 0 ? (
        <EmptyView />
      ) : (
        <RecentReports
          recentReports={recentReports}
          reports={reports}
          onViewReportsButtonClicked={onViewReportsButtonClicked}
          setIsOpen={setIsOpen}
        />
      )}
    </DropdownMenu>
  );
};

export default SavedReportDropdown;
