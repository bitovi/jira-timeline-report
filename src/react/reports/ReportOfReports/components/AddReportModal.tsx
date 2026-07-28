import type { FC } from 'react';
import type { Report } from '../../../../jira/reports';

import React from 'react';
import Button from '@atlaskit/button/new';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';

export interface AddReportModalProps {
  isOpen: boolean;
  /** The reports offered, already filtered and ordered — see `model/selectable-reports`. */
  reports: Report[];
  onSelect: (reportId: Report['id']) => void;
  onClose: () => void;
}

/**
 * Picks a saved report to embed in a report-of-reports. Pure and prop-driven: the caller supplies
 * the (already filtered) list, so the picker itself needs no fetch — every saved report is in
 * memory before React mounts. See spec/016-report-of-reports.
 */
export const AddReportModal: FC<AddReportModalProps> = ({ isOpen, reports, onSelect, onClose }) => {
  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={onClose}>
          <ModalHeader>
            <ModalTitle>Add Report</ModalTitle>
          </ModalHeader>
          <ModalBody>
            {reports.length === 0 ? (
              <p className="py-2 text-slate-500">
                No other saved reports to add. Save a report first, then compose it here.
              </p>
            ) : (
              <ul className="flex flex-col py-1">
                {reports.map((report) => (
                  <li key={report.id}>
                    <Button appearance="subtle" shouldFitContainer onClick={() => onSelect(report.id)}>
                      {report.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ModalBody>
          <ModalFooter>
            <Button appearance="subtle" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </ModalTransition>
  );
};

export default AddReportModal;
