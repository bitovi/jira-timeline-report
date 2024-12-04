import type { Report } from "../../../../jira/reports";
import type { FC } from "react";

import React, { useState } from "react";

import Heading from "@atlaskit/heading";
import InlineEdit from "@atlaskit/inline-edit";
import Textfield from "@atlaskit/textfield";
import { ErrorMessage } from "@atlaskit/form";
import Spinner from "@atlaskit/spinner";

import { useUpdateReport } from "../../../services/reports";

interface EditableTitleProps {
  validate: (name: string) => { isValid: boolean; message: string };
  selectedReport?: Report;
  name: string;
  setName: (newName: string) => void;
}

const EditableTitle: FC<EditableTitleProps> = ({ validate, selectedReport, name, setName }) => {
  const [editing, setEditing] = useState(false);
  const { updateReport, isUpdating } = useUpdateReport();

  const edit = (newName: string) => {
    if (!selectedReport) {
      console.warn("Tried to update report but couldn't determine the selected report");
      return;
    }

    if (newName === selectedReport.name) {
      return;
    }

    updateReport(
      selectedReport.id,
      { name: newName },
      {
        onSuccess: () => {
          setName(newName);
        },
      }
    );
  };

  return (
    // Cannot override styles inside InLineEdit thorugh props. This removes excess margin
    <div className="[&>form>div]:!m-0">
      <InlineEdit
        isEditing={!!selectedReport && editing}
        onEdit={() => setEditing((prev) => !prev)}
        defaultValue={name}
        validate={(value) => {
          value === selectedReport?.name ? "" : validate(value).message;
        }}
        onConfirm={(value) => {
          setEditing(false);
          edit(value);
        }}
        onCancel={() => setEditing(false)}
        editButtonLabel={name}
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
      />
    </div>
  );
};

export default EditableTitle;
