import type { FC } from "react";

import React from "react";

import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTransition,
} from "@atlaskit/modal-dialog";

import FeatureRequestForm from "./components/FeatureRequestForm";
import FeatureRequestModalHeader from "./components/FeatureRequestModalHeader";

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
            <FeatureRequestModalHeader onClose={onClose} />
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
