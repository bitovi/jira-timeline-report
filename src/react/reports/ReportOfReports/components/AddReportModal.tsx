import type { FC } from 'react';
import type { Report } from '../../../../jira/reports';

import React from 'react';
import Button from '@atlaskit/button/new';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Textfield from '@atlaskit/textfield';

import { ReportRow, useReportSearch } from '../../../components/ReportListing';
import { ValueReportForm } from './ValueReportForm';

export interface AddReportModalProps {
  isOpen: boolean;
  /** The reports offered, already filtered and ordered — see `model/selectable-reports`. */
  reports: Report[];
  onSelect: (reportId: Report['id']) => void;
  /** Receives the expression the Value Report half built; the caller makes the node. */
  onAddValue: (expression: string) => void;
  onClose: () => void;
}

/**
 * Adds a node to a report-of-reports: either a live Jira value, or a saved report to embed.
 *
 * **Two halves with different natures, and that shows in the code.** The saved-report half is pure and
 * prop-driven — the caller supplies the already-filtered list, because every saved report is in memory
 * before React mounts. The Value Report half can't be: a work-item typeahead and a field catalog are
 * fetches no prop can supply, so it lives in `ValueReportForm` with its own tests and this file just
 * places it. Rows and search come from `components/ReportListing`, shared with the Saved Reports page.
 *
 * **Focus stays on the reports search**, as it did before the Value Report row existed: it is the
 * half with keyboard navigation (↑/↓/↵/Esc) and the one most opens are for. Tab reaches the value row.
 *
 * See spec/016-report-of-reports, spec/023-report-modal, and .../009-value-report-modal Phase 6.
 */
export const AddReportModal: FC<AddReportModalProps> = ({ isOpen, reports, onSelect, onAddValue, onClose }) => {
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
            <Subtitle>Value Report</Subtitle>
            <ValueReportForm onAdd={onAddValue} />
            <Subtitle>Saved Report</Subtitle>
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

/**
 * One of the modal's two section headings. Quiet on purpose — the modal already has a title, and these
 * are labels telling two halves apart rather than a second level of shouting.
 */
const Subtitle: FC<{ children: string }> = ({ children }) => (
  <h3 className="pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-801 first:pt-0">{children}</h3>
);

export default AddReportModal;
