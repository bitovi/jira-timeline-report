import type { FC } from "react";

import React, { useState, useId } from "react";
import TextArea from "@atlaskit/textarea";
import Spinner from "@atlaskit/spinner";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import Textfield from "@atlaskit/textfield";
import { Label } from "@atlaskit/form";

import ImageDropzone from "../../../../shared/components/ImageDropzone/ImageDropzone";
import { useFeedback } from "../../../../shared/hooks";

interface BugReportFormProps {
  onCancel: () => void;
  onSubmit?: () => void;
}

const BugReportForm: FC<BugReportFormProps> = ({ onCancel, onSubmit }) => {
  const [files, setFiles] = useState<File[]>([]);

  const descriptionId = useId();
  const [description, setDescription] = useState("");

  const nameId = useId();
  const [name, setName] = useState("");

  const emailId = useId();
  const [email, setEmail] = useState("");

  const [formError, setFormError] = useState<string>();

  const { submitFeatureRequest, isSubmitting } = useFeedback();

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setFormError("");

        if (!description) {
          setFormError("You need to add a description.");
          return;
        }

        submitFeatureRequest(
          { name, files, email, description, tags: { type: "bug" } },
          { onSuccess: () => onSubmit?.(), onError: (error) => setFormError(error.message) }
        );
      }}
    >
      <div>
        {formError && <SectionMessage appearance="error">{formError}</SectionMessage>}
        <div>
          <Label htmlFor={nameId}>Name</Label>
          <Textfield
            name="name"
            id={nameId}
            value={name}
            onChange={({ currentTarget }) => setName(currentTarget.value)}
          />
        </div>
        <div>
          <Label htmlFor={emailId}>Email</Label>
          <Textfield
            name="email"
            id={emailId}
            value={email}
            onChange={({ currentTarget }) => setEmail(currentTarget.value)}
          />
        </div>
        <div className="pt-4">
          <Label htmlFor={descriptionId}>
            Description{" "}
            <span className="text-rose-600" aria-hidden="true" title="required">
              *
            </span>
          </Label>
          <TextArea
            name="description"
            id={descriptionId}
            value={description}
            onChange={({ target }) => setDescription(target.value)}
            rows={8}
            resize="auto"
            placeholder="I want a weekly breakdown of dev vs QA time across all epics..."
          />
        </div>
        <ImageDropzone files={files} setFiles={setFiles} />
      </div>
      <div className="flex justify-end items-center gap-4 pt-6">
        <Button onClick={onCancel} isDisabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" appearance="primary" isDisabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : "Submit"}
        </Button>
      </div>
    </form>
  );
};

export default BugReportForm;
