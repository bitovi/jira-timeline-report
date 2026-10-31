/**
 * A modal listing issues as links — what the Estimation Progress report opens from a bar segment,
 * and the Table report's grouped Estimate Progress bar reuses (spec/044-planning-health-mvp).
 */
import React from 'react';
import ModalDialog, { ModalHeader, ModalBody, ModalFooter } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button';

export interface IssueListModalIssue {
  key?: string;
  url?: string;
  summary?: string;
}

interface IssueListModalProps {
  title: string;
  issues: readonly IssueListModalIssue[];
  onClose: () => void;
  testId?: string;
}

export const IssueListModal: React.FC<IssueListModalProps> = ({ title, issues, onClose, testId }) => (
  <ModalDialog testId={testId} onClose={onClose} width="medium">
    <ModalHeader>
      <h2 className="text-lg pb-4">{title}</h2>
    </ModalHeader>
    <ModalBody>
      <ul>
        {issues.map((issue, idx) => (
          <li key={issue.key ?? idx}>
            <a target="_blank" rel="noopener noreferrer" href={issue.url}>
              {issue.summary}
            </a>
          </li>
        ))}
      </ul>
    </ModalBody>
    <ModalFooter>
      <Button appearance="default" onClick={onClose} autoFocus>
        Close
      </Button>
    </ModalFooter>
  </ModalDialog>
);
