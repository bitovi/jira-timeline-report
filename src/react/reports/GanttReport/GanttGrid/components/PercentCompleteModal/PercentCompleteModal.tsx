import React from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import CrossIcon from '@atlaskit/icon/glyph/cross';
import { IconButton } from '@atlaskit/button/new';
import { computeKnownPercentComplete, computePercentComplete } from '../../helpers/percentComplete';
import { SelfCalculationBox } from './CalculationBreakdown';
import { JiraImage } from '../../../../../components/JiraImage';
import type { IssueOrRelease } from '../../types';
import { useCachedFeatureFlag } from '../../../../../services/features/useCachedFeatureFlag';
import { ROLLUP_CALCULATION_FEATURE_FLAG } from '../../../../../../configuration/features';

export interface PercentCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: IssueOrRelease;
  childIssues: IssueOrRelease[];
  /**
   * Show the known/averaged breakdown (spec/046). Defaults to the `rollupCalculation` feature flag;
   * pass it to override (tests, stories).
   */
  showWorkBreakdown?: boolean;
}

function formatPercent(percent: number | null): string {
  return percent === null ? '—' : `${percent}%`;
}

const SIZE_FROM_LABELS: Record<string, string> = {
  teamTime: 'team time over its dates',
  estimate: 'its estimate',
  dates: 'its date span',
};

/**
 * "N of M working days are averaged · K items have no size", plus how the issue's own size was
 * picked when it has one.
 */
export const WorkBreakdownSummary: React.FC<{ issue: IssueOrRelease }> = ({ issue }) => {
  const rollup = issue.completionRollup;
  const averaged = Math.round(rollup.averagedWorkingDays ?? 0);
  const total = Math.round(rollup.workingDaysWithAverages);
  const unsized = rollup.unsizedIssueKeys?.length ?? 0;
  const sizeFrom = issue.workSize?.sizeFrom;
  return (
    <div className="text-sm py-1" data-testid="work-breakdown-summary">
      <p>
        {averaged} of {total} working days are averaged · {unsized} {unsized === 1 ? 'item has' : 'items have'} no size
      </p>
      {rollup.source === 'self' && sizeFrom && (
        <p className="text-xs text-gray-600">
          Sized by {SIZE_FROM_LABELS[sizeFrom]}
          {issue.workSize?.legacy ? " (the team's Spread effort setting decides dates vs. estimate)" : ''}.
        </p>
      )}
    </div>
  );
};

const Row: React.FC<{ issue: IssueOrRelease; indent?: boolean; showWork?: boolean }> = ({
  issue,
  indent,
  showWork,
}) => (
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
    <div className="text-right">{formatPercent(computePercentComplete(issue))}</div>
    {showWork && <div className="text-right">{formatPercent(computeKnownPercentComplete(issue))}</div>}
    <div className="text-right">{Math.round(issue.completionRollup.completedWorkingDaysWithAverages)}</div>
    <div className="text-right">
      {Math.round(
        issue.completionRollup.remainingWorkingDaysWithAverages ??
          issue.completionRollup.workingDaysWithAverages - issue.completionRollup.completedWorkingDaysWithAverages,
      )}
    </div>
    <div className="text-right">{Math.round(issue.completionRollup.workingDaysWithAverages)}</div>
    {showWork && <div className="text-right">{Math.round(issue.completionRollup.averagedWorkingDays ?? 0)}</div>}
  </>
);

const SelfAndChildrenValues: React.FC<{
  issue: IssueOrRelease;
  childIssues: IssueOrRelease[];
  showWork?: boolean;
}> = ({ issue, childIssues, showWork }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `auto repeat(${showWork ? 6 : 4}, auto)` }}>
    <div className="font-bold">Summary</div>
    <div className="font-bold">Percent Complete</div>
    {showWork && <div className="font-bold">Known %</div>}
    <div className="font-bold">Completed Working Days</div>
    <div className="font-bold">Remaining Working Days</div>
    <div className="font-bold">Total Working Days</div>
    {showWork && <div className="font-bold">Averaged Days</div>}
    <Row issue={issue} showWork={showWork} />
    {childIssues.map((child) => (
      <Row key={child.key} issue={child} indent showWork={showWork} />
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
export const PercentCompleteModal: React.FC<PercentCompleteModalProps> = (props) => {
  const flagOn = useCachedFeatureFlag(ROLLUP_CALCULATION_FEATURE_FLAG);
  return <PercentCompleteModalView {...props} showWorkBreakdown={props.showWorkBreakdown ?? flagOn} />;
};

const PercentCompleteModalView: React.FC<PercentCompleteModalProps> = ({
  isOpen,
  onClose,
  issue,
  childIssues,
  showWorkBreakdown,
}) => (
  <ModalTransition>
    {isOpen && (
      <Modal onClose={onClose} width={issue.completionRollup.source === 'self' ? 'large' : 'x-large'}>
        <ModalHeader>
          <div className="w-full flex justify-between">
            <div>
              <p className="py-2 flex gap-1 text-xs items-center">
                {issue.issue?.fields?.['Issue Type']?.iconUrl ? (
                  <JiraImage src={issue.issue.fields['Issue Type'].iconUrl} alt="" />
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
          {showWorkBreakdown && <WorkBreakdownSummary issue={issue} />}
          {issue.completionRollup.source === 'self' && <SelfCalculationBox issue={issue} />}
          {issue.completionRollup.source === 'unsized' && (
            <p className="py-2 text-sm">No size, and the report leaves unsized items at 0 days.</p>
          )}
          {issue.completionRollup.source === 'average' && (
            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, auto)' }}>
              <div className="flex-col justify-items-center px-1 py-3 rounded-md border border-[#94C748] bg-[#EFFFD6]">
                <div className="text-sm font-semibold">{(issue.type ?? 'Issue') + ' average days'}</div>
                <div className="flex justify-center gap-1 items-baseline">
                  <div>{Math.round(issue.completionRollup.workingDaysWithAverages)}</div>
                </div>
              </div>
            </div>
          )}
          {(issue.completionRollup.source === 'children' || !issue.completionRollup.source) && (
            <SelfAndChildrenValues issue={issue} childIssues={childIssues} showWork={showWorkBreakdown} />
          )}
        </ModalBody>
        <ModalFooter />
      </Modal>
    )}
  </ModalTransition>
);
