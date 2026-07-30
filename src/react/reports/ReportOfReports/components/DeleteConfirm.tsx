import type { FC } from 'react';

import React, { useState } from 'react';
import Button from '@atlaskit/button/new';
import Popup from '@atlaskit/popup';
import DeleteIcon from '@atlaskit/icon/core/delete';

import { RowButton } from './RowButton';

export interface DeleteConfirmProps {
  /** Names the node in the trigger's accessible label and in the confirm copy. */
  label: string;
  /** Whether the node holds anything, which is the difference between the two wordings. */
  hasChildren?: boolean;
  onConfirm: () => void;
  /**
   * Told when the popover opens and closes. The row uses it to keep its controls visible while the
   * confirm is up — otherwise moving the pointer to the popover hides the button it's anchored to.
   */
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * Delete, with a confirm popover anchored under the button.
 *
 * The trigger keeps the accessible name the one-click version had (`Remove <label>`), so it stays the
 * button a screen reader — or a test — already knows; the copy names the node again, and says out loud
 * when children are going with it. See spec/016-report-of-reports/004-redesign §5.
 */
export const DeleteConfirm: FC<DeleteConfirmProps> = ({ label, hasChildren = false, onConfirm, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  return (
    <Popup
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      placement="bottom-end"
      content={() => (
        <div className="flex w-64 flex-col gap-3 p-3" data-testid="delete-confirm">
          <p className="text-sm text-neutral-800">
            {hasChildren ? `Delete "${label}" and everything inside it?` : `Delete "${label}"?`}
          </p>
          <div className="flex justify-end gap-2">
            <Button appearance="subtle" spacing="compact" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              appearance="danger"
              spacing="compact"
              testId="confirm-delete"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
      trigger={(triggerProps) => (
        <RowButton
          {...triggerProps}
          icon={DeleteIcon}
          label={`Remove ${label}`}
          tone="danger"
          onClick={() => setOpen(!isOpen)}
        />
      )}
    />
  );
};

export default DeleteConfirm;
