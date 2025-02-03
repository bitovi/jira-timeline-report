import type { FC } from "react";
import type { Report } from "../../../../../../jira/reports";

import React from "react";
import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTransition,
} from "@atlaskit/modal-dialog";
import Button from "@atlaskit/button/new";
import Spinner from "@atlaskit/spinner";

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
            {isDeleting && <Spinner size="xsmall" />} Delete report
          </Button>
          <Button onClick={() => closeModal()}>Cancel</Button>
        </ModalFooter>
      </Modal>
    </ModalTransition>
  );
};

export default DeleteReportModal;
