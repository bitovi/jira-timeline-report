import React from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button/new';
import type { IssueOrRelease } from '../../types';
import { getStatusColorClass } from '../../../shared/timeline';

export interface DateRangeModalProps {
  /** Issues whose due date falls outside the active date range, shown in incoming order. */
  issues: IssueOrRelease[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal listing the Scatter Plot's issues excluded by the active due-date range filter.
 *
 * Each row shows a status-tinted glyph, the issue key, and its summary, and links out to the
 * issue in Jira (opens in a new tab) — mirrors {@link NoDatesModal}.
 */
export const DateRangeModal: React.FC<DateRangeModalProps> = ({ issues, isOpen, onClose }) => (
  <ModalTransition>
    {isOpen && (
      <Modal onClose={onClose} width="medium">
        <ModalHeader>
          <div>
            <ModalTitle>Issues outside date range</ModalTitle>
            <p className="text-sm text-neutral-500 mt-1">
              These issues have a due date outside the selected date range, so they aren&apos;t plotted.
            </p>
          </div>
        </ModalHeader>
        <ModalBody>
          <ul>
            {issues.map((issue) => (
              <li key={issue.key}>
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-2 py-2 rounded hover:bg-neutral-20 no-underline"
                >
                  <span
                    className={`inline-flex items-center justify-center rounded-full w-4 h-4 shrink-0 ${getStatusColorClass(issue.status ?? issue.rollupStatuses?.rollup?.status ?? 'unknown')}`}
                  />
                  <span className="font-semibold text-blue-600 shrink-0">{issue.key}</span>
                  <span className="truncate">{issue.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </ModalBody>
        <ModalFooter>
          <Button appearance="primary" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    )}
  </ModalTransition>
);
