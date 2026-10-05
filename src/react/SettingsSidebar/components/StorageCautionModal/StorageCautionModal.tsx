import type { FC, ReactNode } from 'react';

import React from 'react';
import Button from '@atlaskit/button/new';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';

export interface StorageCautionModalProps {
  isOpen: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** The one thing this particular choice does, said before the caution the two share. */
  children: ReactNode;
}

/**
 * The "are you sure" in front of the two doors into reports storage: the Features toggle that
 * reveals the panel, and the panel's own radio that points this site at a space.
 *
 * Both are asked only on the way *in*. Turning the feature back off just hides the panel, and moving
 * the radio off a space stops listing what is there rather than changing it — neither needs
 * permissions the app doesn't already have, so neither earns a confirm. Going the other way commits
 * the whole site to a store that has to be administered, which is what this says out loud.
 */
const StorageCautionModal: FC<StorageCautionModalProps> = ({ isOpen, title, onConfirm, onCancel, children }) => {
  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={onCancel}>
          <ModalHeader>
            <ModalTitle appearance="warning">{title}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">{children}</p>
            <p className="pt-3 text-sm">
              This is a <span className="font-semibold">site-wide</span> setting. It changes where saved reports are
              read and written for everyone using Status Reports on this site, not just for you.
            </p>
            <p className="pt-3 text-sm">
              Only a <span className="font-semibold">Jira admin</span> should change it. Reports are stored as work
              items in a space you nominate, so it needs permission to create and edit work items there, and reports
              saved under one setting are not listed under another.
            </p>
            <p className="pt-3 text-sm">Proceed only if you understand what this affects.</p>
          </ModalBody>
          <ModalFooter>
            <Button appearance="subtle" onClick={onCancel}>
              Cancel
            </Button>
            <Button appearance="warning" onClick={onConfirm}>
              Continue
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </ModalTransition>
  );
};

export default StorageCautionModal;
