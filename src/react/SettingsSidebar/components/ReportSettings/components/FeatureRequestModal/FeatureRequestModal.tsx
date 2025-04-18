import type { Dispatch, FC, SetStateAction } from "react";

import React, { useCallback, useId, useState } from "react";

import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from "@atlaskit/modal-dialog";
import CrossIcon from "@atlaskit/icon/glyph/cross";
import { IconButton } from "@atlaskit/button/new";

import Textfield from "@atlaskit/textfield";
import { Label } from "@atlaskit/form";
import TextArea from "@atlaskit/textarea";
import Spinner from "@atlaskit/spinner";
import Button from "@atlaskit/button/new";
import { captureFeedback } from "@sentry/react";
import { useMutation } from "@tanstack/react-query";
import SectionMessage from "@atlaskit/section-message";
import { useFlags } from "@atlaskit/flag";

import SuccessIcon from "@atlaskit/icon/core/success";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

const useFeatureRequest = () => {
  const { showFlag } = useFlags();

  const {
    mutate: submitFeatureRequest,
    isPending: isSubmitting,
    error,
  } = useMutation({
    mutationFn: createUnsupportedReportFeedback,
    onSuccess: () => {
      showFlag({
        title: <Text color="color.text.success">Success</Text>,
        description: `Thanks for the feature request!`,
        isAutoDismiss: true,
        icon: <SuccessIcon color={token("color.icon.success")} label="success" />,
      });
    },
  });

  return {
    submitFeatureRequest,
    isSubmitting,
    error,
  };
};

const createUnsupportedReportFeedback = async ({
  files,
  email,
  description,
}: {
  files: File[];
  email: string;
  description: string;
}) => {
  const formattedFiles = await Promise.all(
    files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      return {
        data: new Uint8Array(buffer),
        filename: file.name,
      };
    })
  );

  captureFeedback(
    {
      email,
      message: description,
    },
    {
      captureContext: {
        tags: { type: "feature-request" },
      },
      attachments: formattedFiles,
    }
  );
};

const FeatureRequestForm: FC<{ onCancel: () => void; onSubmit?: () => void }> = ({
  onCancel,
  onSubmit,
}) => {
  const [files, setFiles] = useState<File[]>([]);

  const descriptionId = useId();
  const [description, setDescription] = useState("");

  const emailId = useId();
  const [email, setEmail] = useState("");

  const [formError, setFormError] = useState<string>();

  const { submitFeatureRequest, isSubmitting } = useFeatureRequest();

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setFormError("");

        if (!description) {
          setFormError("You need to add a feature description.");
          return;
        }

        submitFeatureRequest(
          { files, email, description },
          { onSuccess: () => onSubmit?.(), onError: (error) => setFormError(error.message) }
        );
      }}
    >
      <div>
        {formError && <SectionMessage appearance="error">{formError}</SectionMessage>}
        <div>
          <Label htmlFor={emailId}>If you're open to follow-up questions, what's your email?</Label>
          <Textfield
            name="email"
            id={emailId}
            value={email}
            onChange={({ currentTarget }) => setEmail(currentTarget.value)}
          />
        </div>
        <div className="pt-4">
          <Label htmlFor={descriptionId}>
            What are you trying to report on?{" "}
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

interface FeatureRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FeatureRequestModal: FC<FeatureRequestModalProps> = ({ isOpen, onClose }) => {
  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={onClose}>
          <ModalHeader>
            <div className="w-full flex justify-between">
              <div>
                <ModalTitle>
                  <h1 className="text-xl mb-4">Feature Request</h1>
                </ModalTitle>

                <p className="text-sm">
                  We want to support the kinds of reports you actually need. Tell us what you're
                  trying to build — the more detail, the better.
                </p>

                <p className="pt-4 text-sm">
                  If it helps explain the report you're after, you can upload one or more images.
                </p>
              </div>
              <IconButton
                appearance="subtle"
                icon={CrossIcon}
                label="Close Modal"
                onClick={onClose}
              />
            </div>
          </ModalHeader>
          <ModalBody>
            <FeatureRequestForm onCancel={onClose} onSubmit={onClose} />
          </ModalBody>
          <ModalFooter />
        </Modal>
      )}
    </ModalTransition>
  );
};

export default FeatureRequestModal;

interface ImageDropzoneProps {
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
}

const ImageDropzone: FC<ImageDropzoneProps> = ({ files, setFiles }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileId = useId();

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  return (
    <div className="pt-4">
      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((file, i) => (
            <li key={file.name} className="flex justify-between">
              <div className="flex items-center gap-4 ">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-8 h-8 object-cover rounded border"
                />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</p>
                </div>
              </div>
              <button
                className="text-blue-600 hover:underline"
                onClick={() => setFiles((prev) => prev.filter(({ name }) => name !== file.name))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className={`border border-dashed rounded mt-4 p-6 text-center  ${
          isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          id={fileId}
          name="files"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Label htmlFor={fileId}>
          <p className="text-blue-600 underline cursor-pointer">
            {isDragging ? "Drop files here" : "Drag and drop files or click to upload"}
          </p>
          <p className="text-sm text-gray-400">Images only</p>
        </Label>
      </div>
    </div>
  );
};
