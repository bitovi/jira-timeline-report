import type { FC } from "react";
import type { Report } from "../../jira/reports";

import React, { useMemo, useState } from "react";
import DynamicTable from "@atlaskit/dynamic-table";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";

import DropdownMenu, { DropdownItem } from "@atlaskit/dropdown-menu";
import { IconButton } from "@atlaskit/button/new";

import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button/new";
import Spinner from "@atlaskit/spinner";

import ViewReportsLayout from "./components/ViewReportsLayout";
import { useAllReports, useDeleteReport, useRecentReports } from "../services/reports";

interface ViewReportProps {
  onBackButtonClicked: () => void;
}

const ViewReports: FC<ViewReportProps> = ({ onBackButtonClicked }) => {
  const reports = useAllReports();

  const { deleteReport, isDeleting } = useDeleteReport();
  const [managedReport, setManagedReport] = useState<Report>();

  const { removeFromRecentReports } = useRecentReports();

  const selectedReport = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedReport = params.get("report");

    if (!selectedReport) {
      return "";
    }

    return (
      Object.values(reports)
        .filter((report) => !!report)
        .find(({ id }) => id === selectedReport)?.name || ""
    );
  }, [reports]);

  const reportRows = Object.values(reports)
    .filter((r) => !!r)
    .map((report) => {
      return {
        key: report.id,
        cells: [
          {
            key: `${report.id}-report`,
            content: (
              <a
                href={"?" + report.queryParams}
                className="flex items-center font-normal text-sm leading-5 h-10"
              >
                Report name {report.name}
              </a>
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
        reportInfo={selectedReport ? <p>{selectedReport}</p> : null}
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

interface DeleteReportModalProps {
  isOpen: boolean;
  closeModal: () => void;
  isDeleting: boolean;
  deleteReport: () => void;
  report?: Report;
}

const DeleteReportModal: FC<DeleteReportModalProps> = ({
  isOpen,
  closeModal,
  deleteReport,
  isDeleting,
  report,
}) => {
  if (!isOpen) {
    return;
  }

  return (
    <ModalTransition>
      <Modal>
        <ModalHeader>
          <ModalTitle>{report?.name} to be deleted</ModalTitle>
        </ModalHeader>
        <ModalBody>Are you sure you want to delete this report?</ModalBody>
        <ModalFooter>
          <Button appearance="danger" isDisabled={isDeleting} onClick={() => deleteReport()}>
            {isDeleting ? <Spinner size="xsmall" /> : "Delete report"}
          </Button>
          <Button onClick={() => closeModal()}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
};
