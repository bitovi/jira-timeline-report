import type { FC } from "react";

import React, { useMemo, useState } from "react";

import { v4 as uuidv4 } from "uuid";
import Heading from "@atlaskit/heading";
import InlineEdit from "@atlaskit/inline-edit";

import { useAllReports } from "./services/reports/useAllReports";
import { useCreateReport, useUpdateReport } from "./services/reports/useSaveReports";
import LinkButton from "../components/LinkButton";

import { useRecentReports } from "./services/reports/useRecentReports";

import SaveReportModal from "./components/SaveReportModal";
import SavedReportDropdown from "./components/SavedReportDropdown";

import { css, jsx } from "@emotion/react";
import { token } from "@atlaskit/tokens";
import Textfield from "@atlaskit/textfield";
import { xcss } from "@atlaskit/primitives";
import { ErrorMessage } from "@atlaskit/form";
import { Report } from "../../jira/reports";
import Spinner from "@atlaskit/spinner";

interface SaveReportProps {
  onViewReportsButtonClicked: () => void;
}

const readViewContainerStyles = xcss({
  font: "font.heading.large",
  paddingBlock: "space.100",
  paddingInline: "space.075",
  wordBreak: "break-word",
});

const SaveReport: FC<SaveReportProps> = ({ onViewReportsButtonClicked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const reports = useAllReports();
  const { recentReports, addReportToRecents } = useRecentReports();
  const { createReport, isCreating } = useCreateReport();
  const { updateReport, isUpdating } = useUpdateReport();

  const selectedReport = useMemo<Report | undefined>(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedReport = params.get("report");

    if (!selectedReport) {
      return;
    }

    return Object.values(reports)
      .filter((r) => !!r)
      .find(({ id }) => id === selectedReport);
  }, []);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(selectedReport?.name || "Untitled Report");

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
        <InlineEdit
          isEditing={!!selectedReport && editing}
          onEdit={() => setEditing((prev) => !prev)}
          defaultValue={name}
          editButtonLabel={name}
          validate={(value) => validateName(value).message}
          editView={({ errorMessage, ...fieldProps }) => (
            <>
              <Textfield
                {...fieldProps}
                autoFocus
                autoComplete="new-password"
                className="[&>input]:!font-semibold [&>input]:!text-[29px] [&>input]:!p-0"
              />
              {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}
            </>
          )}
          readView={() => (
            <div className="flex gap-1 items-center">
              <Heading size="xlarge">{name}</Heading>
              {isUpdating && <Spinner size="small" />}
            </div>
          )}
          onConfirm={(newName) => {
            setEditing(false);

            if (!selectedReport) {
              console.warn("Tried to update report but couldn't determine the selected report");
              return;
            }

            updateReport(
              selectedReport.id,
              { name: newName },
              {
                onSettled: () => {
                  setName(newName);
                },
              }
            );
          }}
        />
        <LinkButton onClick={openModal} disabled={editing}>
          Save Report
        </LinkButton>
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
