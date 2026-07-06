import React from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import CrossIcon from '@atlaskit/icon/glyph/cross';
import { IconButton } from '@atlaskit/button/new';
import { computePercentComplete } from '../../helpers/percentComplete';
import { SelfCalculationBox } from './CalculationBreakdown';
import type { IssueOrRelease } from '../../types';

export interface PercentCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: IssueOrRelease;
  childIssues: IssueOrRelease[];
}

function formatPercent(issue: IssueOrRelease): string {
  const percent = computePercentComplete(issue);
  return percent === null ? '—' : `${percent}%`;
}

const Row: React.FC<{ issue: IssueOrRelease; indent?: boolean }> = ({ issue, indent }) => (
  <>
    <div className={`truncate max-w-96 ${indent ? 'pl-4' : ''}`}>
      {issue.url ? (
        <a href={issue.url} target="_blank" rel="noreferrer" className="link">
          {issue.summary}
        </a>
      ) : (
        issue.summary
      )}
    </div>
    <div className="text-right">{formatPercent(issue)}</div>
    <div className="text-right">{Math.round(issue.completionRollup.completedWorkingDays)}</div>
    <div className="text-right">
      {Math.round(
        issue.completionRollup.remainingWorkingDays ??
          issue.completionRollup.totalWorkingDays - issue.completionRollup.completedWorkingDays,
      )}
    </div>
    <div className="text-right">{Math.round(issue.completionRollup.totalWorkingDays)}</div>
  </>
);

const SelfAndChildrenValues: React.FC<{ issue: IssueOrRelease; childIssues: IssueOrRelease[] }> = ({
  issue,
  childIssues,
}) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: 'auto repeat(4, auto)' }}>
    <div className="font-bold">Summary</div>
    <div className="font-bold">Percent Complete</div>
    <div className="font-bold">Completed Working Days</div>
    <div className="font-bold">Remaining Working Days</div>
    <div className="font-bold">Total Working Days</div>
    <Row issue={issue} />
    {childIssues.map((child) => (
      <Row key={child.key} issue={child} indent />
    ))}
  </div>
);

/**
 * Modal showing an issue's percent-complete breakdown, branching on `completionRollup.source`
 * exactly like the legacy modal it replaces
 * ([PercentComplete.tsx](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L277-L311)):
 * - `self` — the issue's own timing/estimate calculation ({@link SelfCalculationBox}).
 * - `average` — a single "{type} average days" box.
 * - `children` — a table of the issue plus each child's percent complete.
 */
export const PercentCompleteModal: React.FC<PercentCompleteModalProps> = ({ isOpen, onClose, issue, childIssues }) => (
  <ModalTransition>
    {isOpen && (
      <Modal onClose={onClose} width={issue.completionRollup.source === 'self' ? 'large' : 'x-large'}>
        <ModalHeader>
          <div className="w-full flex justify-between">
            <div>
              <p className="py-2 flex gap-1 text-xs items-center">
                {issue.issue?.fields?.['Issue Type']?.iconUrl ? (
                  <img src={issue.issue.fields['Issue Type'].iconUrl} alt="" />
                ) : (
                  issue.type
                )}
                <a href={issue.url} className="hover:underline" target="_blank" rel="noreferrer">
                  {issue.key}
                </a>
              </p>
              <ModalTitle>Remaining Work Calculation Summary</ModalTitle>
            </div>
            <IconButton appearance="subtle" icon={CrossIcon} label="Close Modal" onClick={onClose} />
          </div>
        </ModalHeader>
        <ModalBody>
          <p className="py-2">Calculation Source: {issue.completionRollup.source ?? 'children'}</p>
          {issue.completionRollup.source === 'self' && <SelfCalculationBox issue={issue} />}
          {issue.completionRollup.source === 'average' && (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, auto)' }}>
              <div className="flex-col justify-items-center px-1 py-3 rounded-md border border-[#94C748] bg-[#EFFFD6]">
                <div className="text-sm font-semibold">{(issue.type ?? 'Issue') + ' average days'}</div>
                <div className="flex justify-center gap-1 items-baseline">
                  <div>{Math.round(issue.completionRollup.totalWorkingDays)}</div>
                </div>
              </div>
            </div>
          )}
          {(issue.completionRollup.source === 'children' || !issue.completionRollup.source) && (
            <SelfAndChildrenValues issue={issue} childIssues={childIssues} />
          )}
        </ModalBody>
        <ModalFooter />
      </Modal>
    )}
  </ModalTransition>
);
