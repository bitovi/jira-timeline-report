import React, { FC, ReactNode } from 'react';

import Modal, { ModalBody, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import { IconButton } from '@atlaskit/button/new';
import CrossIcon from '@atlaskit/icon/glyph/cross';

import { SizingExample } from './SizingExample';
import type { WorkSettings } from '../../../../../../jira/rollup/work-size/work-settings';

/**
 * The Work settings next to the sizing explanation, laid out like mockups/sizing-picture.html.
 * `settingsPanel` is the live settings form, so changes apply to the report and redraw the example.
 */
export const SizingExampleModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: WorkSettings;
  settingsPanel: ReactNode;
}> = ({ isOpen, onClose, settings, settingsPanel }) => (
  <ModalTransition>
    {isOpen && (
      <Modal onClose={onClose} width={1200} label="How much work is an epic?">
        <ModalHeader>
          <ModalTitle>How much work is an epic?</ModalTitle>
          <IconButton appearance="subtle" icon={CrossIcon} label="Close" onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <div className="flex gap-6 items-start pb-6">
            <aside className="w-72 shrink-0">{settingsPanel}</aside>
            <div className="min-w-0 flex-1 pt-4">
              <SizingExample settings={settings} />
            </div>
          </div>
        </ModalBody>
      </Modal>
    )}
  </ModalTransition>
);

export default SizingExampleModal;
