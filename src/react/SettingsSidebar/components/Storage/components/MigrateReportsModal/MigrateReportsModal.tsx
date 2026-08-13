import type { FC } from 'react';
import type { MigrationProgress } from '../../../../../services/reports-storage';

import React from 'react';
import Button from '@atlaskit/button/new';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';

export interface MigrateReportsModalProps {
  isOpen: boolean;
  spaceName: string;
  reportCount: number;
  progress: MigrationProgress;
  onMigrate: () => void;
  onStartEmpty: () => void;
  onClose: () => void;
}

/**
 * The whole migration UI: one question, asked once, when the setting is switched to a space that the
 * user's existing reports are not in yet.
 *
 * Both answers are safe, which is why this is a confirm rather than a wizard — the legacy record is
 * never deleted or rewritten either way, so "No, start empty" is reversible by switching the setting
 * back, and "Yes" can simply be run again if it fails partway.
 */
const MigrateReportsModal: FC<MigrateReportsModalProps> = ({
  isOpen,
  spaceName,
  reportCount,
  progress,
  onMigrate,
  onStartEmpty,
  onClose,
}) => {
  const { isMigrating, copied, total, failures } = progress;

  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={isMigrating ? () => {} : onClose}>
          <ModalHeader>
            <ModalTitle>Migrate your saved reports?</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">
              You&rsquo;re moving saved report storage to <span className="font-semibold">{spaceName}</span>. Would you
              like to copy your {reportCount} existing saved {reportCount === 1 ? 'report' : 'reports'} into that space?
              Your current data is not deleted either way.
            </p>
            {isMigrating && (
              <p className="pt-4 text-sm">
                Copying {copied} of {total}&hellip;
              </p>
            )}
            {!!failures.length && (
              <p className="pt-4 text-red-500 text-sm">
                Could not copy: {failures.join(', ')}. Try again to retry them.
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button appearance="subtle" onClick={onStartEmpty} isDisabled={isMigrating}>
              No, start empty
            </Button>
            <Button appearance="primary" onClick={onMigrate} isDisabled={isMigrating}>
              {isMigrating ? 'Migrating…' : 'Yes, migrate'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </ModalTransition>
  );
};

export default MigrateReportsModal;
