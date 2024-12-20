import type { FC } from "react";
import type { Report } from "../../jira/reports";

import React, { useMemo, useState } from "react";
import DynamicTable from "@atlaskit/dynamic-table";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import DropdownMenu, { DropdownItem } from "@atlaskit/dropdown-menu";
import { IconButton } from "@atlaskit/button/new";

import ViewReportsLayout from "./components/ViewReportsLayout";
import { useAllReports, useDeleteReport, useRecentReports } from "../services/reports";
import DeleteReportModal from "./components/DeleteReportModal";
import { RoutingLink } from "../components/RoutingLink";
import routeDataObservable from "@routing-observable";
import { useHistoryStateValue } from "../hooks/history";

interface ViewReportProps {
  onBackButtonClicked: () => void;
}

const ViewReports: FC<ViewReportProps> = ({ onBackButtonClicked }) => {
  const reports = useAllReports();

  const { deleteReport, isDeleting } = useDeleteReport();
  const [managedReport, setManagedReport] = useState<Report>();

  const { removeFromRecentReports } = useRecentReports();

  const [selectedReportId] = useHistoryStateValue("report");
  const selectedReportName = useMemo(() => {
    if (!selectedReportId) {
      return "";
    }

    return (
      Object.values(reports)
        .filter((report) => !!report)
        .find(({ id }) => id === selectedReportId)?.name || ""
    );
  }, [reports, selectedReportId]);

  const reportRows = Object.values(reports)
    .filter((r) => !!r)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((report) => {
      return {
        key: report.id,
        cells: [
          {
            key: `${report.id}-report`,
            content: (
              <RoutingLink
                href={"?" + report.queryParams}
                className="flex items-center font-normal text-sm leading-5 h-10"
                replaceAll
              >
                {report.name}
              </RoutingLink>
            ),
          },
          {
            key: `${report.id}-manager`,
            content: (
              <DropdownMenu
                shouldRenderToParent
                trigger={({ triggerRef, ...props }) => (
                  <IconButton
                    icon={ShowMoreHorizontalIcon}
                    label={`manage report, ${report.name}`}
                    ref={triggerRef}
                    {...props}
                  />
                )}
              >
                <DropdownItem
                  onClick={() => {
                    setManagedReport(report);
                  }}
                >
                  Delete
                </DropdownItem>
              </DropdownMenu>
            ),
          },
        ],
      };
    });

  return (
    <>
      <ViewReportsLayout
        onBackButtonClicked={onBackButtonClicked}
        reportInfo={selectedReportName ? <p>{selectedReportName}</p> : null}
      >
        <DynamicTable
          head={{
            cells: [
              { key: "report-heading", content: "Report" },
              { key: " manage-reports", content: "Manage" },
            ],
          }}
          rows={reportRows}
        />
      </ViewReportsLayout>
      <DeleteReportModal
        isOpen={!!managedReport}
        isDeleting={isDeleting}
        closeModal={() => setManagedReport(undefined)}
        deleteReport={() => {
          if (!managedReport) {
            return;
          }

          deleteReport(managedReport.id, {
            onSuccess: () => {
              removeFromRecentReports(managedReport.id);
            },
            onSettled: () => setManagedReport(undefined),
          });
        }}
        report={managedReport}
      />
    </>
  );
};

export default ViewReports;
