import type { FC } from 'react';
import type {
  ConnectMigrationGroupId,
  ConnectMigrationProbe,
  MigrationProgress,
} from '../../../../../services/reports-storage';

import React from 'react';
import Button from '@atlaskit/button/new';
import { Checkbox } from '@atlaskit/checkbox';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';

import { connectMigrationGroups } from '../../../../../services/reports-storage';

export interface MigrateConnectDataModalProps {
  isOpen: boolean;
  probe: ConnectMigrationProbe;
  selected: ConnectMigrationGroupId[];
  progress: MigrationProgress;
  onToggle: (id: ConnectMigrationGroupId, isChecked: boolean) => void;
  onMigrate: () => void;
  onClose: () => void;
}

/**
 * The one-time copy of Connect app-property data into Forge's own store, one checkbox per group.
 *
 * Same structure as `MigrateReportsModal`, and safe for the same reason: the Connect store is never
 * written, and every group overwrites its destination, so a failure is repaired by trying again.
 *
 * See spec/021-forge/resolver-storage/migration-option.plan.md.
 */
const MigrateConnectDataModal: FC<MigrateConnectDataModalProps> = ({
  isOpen,
  probe,
  selected,
  progress,
  onToggle,
  onMigrate,
  onClose,
}) => {
  const { isMigrating, copied, total, failures } = progress;

  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={isMigrating ? () => {} : onClose}>
          <ModalHeader>
            <ModalTitle>Copy your existing data</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">
              Choose what to bring over from the previous version of Status Reports. Anything already saved here is
              replaced. Your previous data is not deleted.
            </p>
            <div className="flex flex-col gap-2 pt-4">
              {connectMigrationGroups.map((group) => {
                const isAvailable = probe.available.includes(group.id);

                return (
                  <Checkbox
                    key={group.id}
                    label={groupLabel(group.id, group.label, probe, isAvailable)}
                    isChecked={isAvailable && selected.includes(group.id)}
                    isDisabled={!isAvailable || isMigrating}
                    onChange={(event) => onToggle(group.id, event.target.checked)}
                  />
                );
              })}
            </div>
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
            <Button appearance="subtle" onClick={onClose} isDisabled={isMigrating}>
              Cancel
            </Button>
            <Button appearance="primary" onClick={onMigrate} isDisabled={isMigrating || !selected.length}>
              {isMigrating ? 'Copying…' : 'Copy'}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </ModalTransition>
  );
};

export default MigrateConnectDataModal;

const groupLabel = (
  id: ConnectMigrationGroupId,
  label: string,
  probe: ConnectMigrationProbe,
  isAvailable: boolean,
): string => {
  if (!isAvailable) {
    return `${label} (nothing to copy)`;
  }

  if (id !== 'reports') {
    return label;
  }

  // With a space pointer, the reports that matter are the space's — counting the dormant blob would
  // describe reports the user will not see.
  if (probe.reportsConfig.kind === 'space') {
    return `${label} (in ${probe.reportsConfig.spaceName})`;
  }

  return `${label} (${probe.reportCount})`;
};
