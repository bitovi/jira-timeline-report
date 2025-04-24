import type { FC } from "react";

import React from "react";

import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTransition,
} from "@atlaskit/modal-dialog";

import BugReportForm from "./components/BugReportForm";
import BugReportModalHeader from "./components/BugReportModalHeader";

interface FeatureRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BugReportModal: FC<FeatureRequestModalProps> = ({ isOpen, onClose }) => {
  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={onClose}>
          <ModalHeader>
            <BugReportModalHeader onClose={onClose} />
          </ModalHeader>
          <ModalBody>
            <BugReportForm onCancel={onClose} onSubmit={onClose} />
          </ModalBody>
          <ModalFooter />
        </Modal>
      )}
    </ModalTransition>
  );
};

export default BugReportModal;
