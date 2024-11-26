import type { FC } from "react";

import React, { useState } from "react";

import { v4 as uuidv4 } from "uuid";

import { useAllReports } from "./services/reports/useAllReports";
import { useCreateReport } from "./services/reports/useSaveReports";
import Heading from "@atlaskit/heading";

import LinkButton from "../components/LinkButton";

import { useRecentReports } from "./services/reports/useRecentReports";

import SaveReportModal from "./components/SaveReportModal";
import SavedReportDropdown from "./components/SavedReportDropdown";

interface SaveReportProps {
  onViewReportsButtonClicked: () => void;
}

const SaveReport: FC<SaveReportProps> = ({ onViewReportsButtonClicked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const reports = useAllReports();
  const { recentReports, addReportToRecents } = useRecentReports();
  const { createReport, isCreating } = useCreateReport();

  const [name, setName] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedReport = params.get("report");

    if (!selectedReport) {
      return "Untitled Report";
    }

    return (
      Object.values(reports)
        .filter((r) => !!r)
        .find(({ id }) => id === selectedReport)?.name || "Untitled Report"
    );
  });

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
        {name && <Heading size="xlarge">{name}</Heading>}
        <LinkButton onClick={openModal}>Save Report</LinkButton>
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
        validate={(name) => {
          const match = Object.values(reports).find((report) => report?.name === name);

          return {
            isValid: !match,
            message: !match ? "" : "That name already exists. Please input a unique report name.",
          };
        }}
      />
    </div>
  );
};

export default SaveReport;
