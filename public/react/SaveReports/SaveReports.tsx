import type { FC } from "react";
import type { CanObservable } from "../hooks/useCanObservable";

import React, { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import Button from "@atlaskit/button/new";

import { useAllReports, useCreateReport, useRecentReports } from "../services/reports";
import SaveReportModal from "./components/SaveReportModal";
import SavedReportDropdown from "./components/SavedReportDropdown";
import ReportControls from "./components/ReportControls";
import EditableTitle from "./components/EditableTitle";
import { useQueryParams } from "../hooks/useQueryParams";
import { useSelectedReport } from "./hooks/useSelectedReports";

interface SaveReportProps {
  onViewReportsButtonClicked: () => void;
  queryParamObservable: CanObservable<string>;
}

const SaveReport: FC<SaveReportProps> = ({ queryParamObservable, onViewReportsButtonClicked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const reports = useAllReports();

  const { createReport, isCreating } = useCreateReport();
  const { selectedReport, updateSelectedReport, isDirty } = useSelectedReport({
    reports,
    queryParamObservable,
  });

  const [name, setName] = useState(selectedReport?.name ?? "Untitled Report");

  useEffect(() => {
    if (!selectedReport) {
      return;
    }

    setName(selectedReport.name);
  }, [selectedReport]);

  const { recentReports, addReportToRecents } = useRecentReports();

  const { queryParams } = useQueryParams(queryParamObservable, {
    onChange: (params) => {
      const report = params.get("report");

      // TODO: If confirm `report` exists in `reports` before adding
      // TODO: Reconcile deleted reports with whats there

      if (report) {
        addReportToRecents(report);
      }
    },
  });

  const validateName = (name: string) => {
    const match = Object.values(reports).find((report) => report?.name === name);

    return {
      isValid: !match,
      message: !match ? "" : "That name already exists. Please input a unique report name.",
    };
  };

  const handleCreate = (name: string) => {
    const id = uuidv4();
    const params = new URLSearchParams(window.location.search);
    params.set("report", id);

    createReport(
      { id, name, queryParams: params.toString() },
      {
        onSuccess: () => {
          closeModal();
          addReportToRecents(id);

          const url = new URL(window.location.toString());
          url.searchParams.set("report", id);
          queryParamObservable.set(url.search);
        },
      }
    );
  };

  const resetChanges = () => {
    if (!selectedReport) {
      return;
    }

    queryParamObservable.set(`?${selectedReport.queryParams}`);
  };

  return (
    <div className="flex gap-1 justify-between items-center">
      <div className="flex gap-3 items-center">
        {selectedReport && (
          <EditableTitle
            name={name}
            setName={setName}
            selectedReport={selectedReport}
            validate={validateName}
          />
        )}
        <ReportControls
          hasSelectedReport={!!selectedReport}
          isDirty={isDirty}
          updateSelectedReport={updateSelectedReport}
          openModal={openModal}
          resetChanges={resetChanges}
        />
      </div>
      <div className="flex gap-4">
        {!selectedReport && !!queryParams.get("jql") && (
          <Button appearance="primary" onClick={openModal}>
            Create new report
          </Button>
        )}
        <SavedReportDropdown
          onViewReportsButtonClicked={onViewReportsButtonClicked}
          recentReports={recentReports}
          reports={reports}
        />
      </div>
      <SaveReportModal
        isOpen={isOpen}
        isCreating={isCreating}
        closeModal={closeModal}
        name={name}
        setName={setName}
        onCreate={handleCreate}
        validate={validateName}
      />
    </div>
  );
};

export default SaveReport;
