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
import { useSelectedReport } from "./hooks/useSelectedReports";
import routeDataObservable, { pushStateObservable as queryParamObservable } from "@routing-observable";
import { useHistoryState, useHistoryStateValue, useHistoryValueCallback } from "../hooks/history";
import { param } from "../../can";

export interface SaveReportProps {
  onViewReportsButtonClicked: () => void;
}

const SaveReport: FC<SaveReportProps> = ({ onViewReportsButtonClicked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const reports = useAllReports();

  const { createReport, isCreating } = useCreateReport();
  const { selectedReport, updateSelectedReport, isDirty } = useSelectedReport({
    reports,
  });

  const [name, setName] = useState(selectedReport?.name ?? "Untitled Report");

  const [jql] = useHistoryStateValue("jql");

  useEffect(() => {
    if (!selectedReport) {
      return;
    }

    setName(selectedReport.name);
  }, [selectedReport]);

  const { recentReports, addReportToRecents } = useRecentReports();

  const [queryParams] = useHistoryState();
  useHistoryValueCallback("report", (report: string | undefined) => {
    // TODO: If confirm `report` exists in `reports` before adding
    // TODO: Reconcile deleted reports with whats there

    if (report) {
      addReportToRecents(report);
    }
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
    const params = {
      ...routeDataObservable.get(),
      report: id,
    };

    createReport(
      { id, name, queryParams: param(params) },
      {
        onSuccess: () => {
          closeModal();
          addReportToRecents(id);

          const url = new URL(window.location.toString());
          url.searchParams.set("report", id);
          queryParamObservable.set(url.search);
        },
      },
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
            key={selectedReport.id}
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
        {!selectedReport && !!jql && (
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
