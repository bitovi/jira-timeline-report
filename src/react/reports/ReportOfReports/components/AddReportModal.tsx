import type { FC } from 'react';
import type { Report } from '../../../../jira/reports';

import React from 'react';
import Button from '@atlaskit/button/new';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Textfield from '@atlaskit/textfield';

import { ReportRow, useReportSearch } from '../../../components/ReportListing';

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
 * memory before React mounts. Rows and search come from `components/ReportListing`, shared with the
 * Saved Reports page. See spec/016-report-of-reports and spec/023-report-modal.
 */
export const AddReportModal: FC<AddReportModalProps> = ({ isOpen, reports, onSelect, onClose }) => {
  const { query, setQuery, described, filtered, activeIndex, setActiveIndex, handleKeyDown } = useReportSearch(
    reports,
    { onActivate: (report) => onSelect(report.id), onEscape: onClose },
  );

  return (
    <ModalTransition>
      {isOpen && (
        <Modal onClose={onClose}>
          <ModalHeader>
            <ModalTitle>Add Report</ModalTitle>
          </ModalHeader>
          <ModalBody>
            {described.length === 0 ? (
              <p className="py-2 text-slate-500">
                No other saved reports to add. Save a report first, then compose it here.
              </p>
            ) : (
              <>
                <Textfield
                  autoFocus
                  placeholder="Search reports by name or type…"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  onKeyDown={handleKeyDown}
                />
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-slate-500">
                    <strong className="block text-neutral-800">No reports match &quot;{query}&quot;</strong>
                    Try a different name, or a report type like &quot;gantt&quot; or &quot;table&quot;.
                  </p>
                ) : (
                  <ul className="flex flex-col py-1">
                    {filtered.map((d, index) => (
                      <li key={d.report.id}>
                        <ReportRow
                          described={d}
                          query={query}
                          isActive={index === activeIndex}
                          onMouseEnter={() => setActiveIndex(index)}
                          onSelect={() => onSelect(d.report.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </>
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
