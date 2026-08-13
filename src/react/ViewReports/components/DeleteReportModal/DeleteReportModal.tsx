import type { FC } from 'react';
import type { Report } from '../../../../jira/reports';
import type { ReportsStorageConfig } from '../../../../jira/storage/reports-config';

import React from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button/new';
import Spinner from '@atlaskit/spinner';

interface DeleteReportModalProps {
  isOpen: boolean;
  closeModal: () => void;
  isDeleting: boolean;
  deleteReport: () => void;
  report?: Report;
  /**
   * Where reports are stored, so the space backend can admit what it actually does. Deleting there
   * edits the work item into a tombstone instead of removing it (`jira/reports/backend/space.ts`),
   * which leaves something behind in a space the user can see — better said here, while they still
   * have a Cancel button, than in a settings panel read months earlier.
   */
  storage?: ReportsStorageConfig;
}

const DeleteReportModal: FC<DeleteReportModalProps> = ({
  isOpen,
  closeModal,
  deleteReport,
  isDeleting,
  report,
  storage,
}) => {
  if (!isOpen) {
    return;
  }

  return (
    <ModalTransition>
      <Modal onClose={() => closeModal()}>
        <ModalHeader>
          <ModalTitle>{report?.name} to be deleted</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p>Are you sure you want to delete this report?</p>
          {storage?.kind === 'space' && (
            <p className="pt-2 text-sm text-slate-700">
              Its work item stays in {storage.spaceName}, marked <span className="italic">[Deleted]</span>.
            </p>
          )}
        </ModalBody>
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
