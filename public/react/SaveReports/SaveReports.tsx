import type { FC } from "react";
import type { CanObservable } from "../hooks/useCanObservable";

import React, { useState } from "react";
import DropdownMenu, { DropdownItem } from "@atlaskit/dropdown-menu";
import { v4 as uuidv4 } from "uuid";

import { useAllReports } from "./services/reports/useAllReports";
import { useCreateReport } from "./services/reports/useSaveReports";
import { useRecentReports } from "./services/reports/useRecentReports";
import SaveReportModal from "./components/SaveReportModal";
import SavedReportDropdown from "./components/SavedReportDropdown";
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
  const { selectedReport, updateSelectedReport, isDirty } = useSelectedReport({ reports, queryParamObservable });

  const [name, setName] = useState(selectedReport?.name || "Untitled Report");

  const { recentReports, addReportToRecents } = useRecentReports();

  useQueryParams(queryParamObservable, {
    onChange: (params) => {
      const report = params.get("report");

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

    createReport(
      { id, name, queryParams: window.location.search },
      {
        onSuccess: () => {
          closeModal();
          addReportToRecents(id);
        },
      }
    );
  };

  return (
    <div className="flex gap-1 justify-between items-center">
      <div className="flex gap-3 items-center">
        <EditableTitle name={name} setName={setName} selectedReport={selectedReport} validate={validateName} />
        {isDirty && (
          <DropdownMenu trigger="Save Report">
            <DropdownItem
              onClick={(event) => {
                event.stopPropagation();
                updateSelectedReport();
              }}
            >
              Save changes
            </DropdownItem>
            <DropdownItem
              onClick={(event) => {
                event.stopPropagation();
                openModal();
              }}
            >
              Save new report
            </DropdownItem>
          </DropdownMenu>
        )}
      </div>
      <div>
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
