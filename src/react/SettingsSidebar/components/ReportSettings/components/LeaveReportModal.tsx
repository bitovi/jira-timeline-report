import type { FC } from 'react';

import React from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button/new';

interface LeaveReportModalProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}

/** Asked before New Report drops a report with unsaved changes. See `hasUnsavedReport`. */
const LeaveReportModal: FC<LeaveReportModalProps> = ({ isOpen, onStay, onLeave }) => (
  <ModalTransition>
    {isOpen && (
      <Modal onClose={onStay}>
        <ModalHeader>
          <ModalTitle appearance="warning">Leave this report?</ModalTitle>
        </ModalHeader>
        <ModalBody>This report has unsaved changes. Starting a new report won&apos;t keep them.</ModalBody>
        <ModalFooter>
          <Button appearance="subtle" onClick={onStay}>
            Stay
          </Button>
          <Button appearance="warning" onClick={onLeave} autoFocus>
            Leave
          </Button>
        </ModalFooter>
      </Modal>
    )}
  </ModalTransition>
);

export default LeaveReportModal;
