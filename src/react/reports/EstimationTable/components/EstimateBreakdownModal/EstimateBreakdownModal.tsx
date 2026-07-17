import React, { FC, ReactNode } from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import CrossIcon from '@atlaskit/icon/glyph/cross';
import { IconButton } from '@atlaskit/button/new';
import { getPath, round, formatPercent, usedStoryPointsMedian, teamsAreTheSame } from '../../helpers/breakdown';
import type { EstimationIssue } from '../../types';

/** The "Current: / Last:" label gutter repeated before each equation row. */
const LabelsColumn: FC = () => (
  <div className="flex-col">
    <div className="text-base text-neutral-801">&nbsp;</div>
    <div className="text-right">Current:</div>
    <div className="text-right text-xs">Last:</div>
  </div>
);

/** A titled equation term wrapping its value(s). */
const ValueColumn: FC<{ title: string; titleClass?: string; children: ReactNode }> = ({
  title,
  titleClass = 'text-neutral-801',
  children,
}) => (
  <div className="flex-col">
    <div className={`text-base ${titleClass}`}>{title}</div>
    {children}
  </div>
);

/**
 * Renders a value's current reading over its prior-period reading, greying out either when its
 * validity flag is false. Ports table-grid.js's `makeCurrentAndPreviousHTML`.
 */
const CurrentAndPrevious: FC<{
  issue: EstimationIssue;
  valueKey: string;
  validKey?: string;
  format?: (value: number | string) => number | string;
}> = ({ issue, valueKey, validKey, format = (x) => x }) => {
  const currentValue = getPath(issue, valueKey);
  const lastValue = issue.issueLastPeriod ? getPath(issue.issueLastPeriod, valueKey) : undefined;

  let isCurrentValueValid: unknown = true;
  let lastValueValid: unknown = true;
  if (validKey) {
    isCurrentValueValid = getPath(issue, validKey);
    lastValueValid = issue.issueLastPeriod ? getPath(issue.issueLastPeriod, validKey) : undefined;
  }

  return (
    <>
      <div className={`text-right ${isCurrentValueValid === false ? 'bg-neutral-100' : ''}`}>
        {format(round(currentValue, 1))}
      </div>
      <div className={`text-right text-xs ${lastValueValid === false ? 'bg-neutral-100' : ''}`}>
        {issue.issueLastPeriod ? format(round(lastValue, 1)) : '🚫'}
      </div>
    </>
  );
};

/** The estimate-calculation breakdown body — the two estimate branches plus the team-config row. */
const EstimateBreakdownBody: FC<{ issue: EstimationIssue }> = ({ issue }) => {
  const showMedian = usedStoryPointsMedian(issue);
  const sameTeams = teamsAreTheSame(issue);

  return (
    <div className="p-4">
      {showMedian ? (
        <>
          <div className="flex gap-4 items-center mb-2 items-stretch">
            <LabelsColumn />
            <div className="flex-col">
              <div className="text-base font-bold">Estimated Days</div>
              <CurrentAndPrevious issue={issue} valueKey="derivedTiming.deterministicTotalDaysOfWork" />
            </div>
            <div className="text-center">=</div>
            <ValueColumn title="Adjusted Estimate" titleClass="text-green-300">
              <CurrentAndPrevious issue={issue} valueKey="derivedTiming.deterministicTotalPoints" />
            </ValueColumn>
            <div className="align-middle"> ÷ </div>
            <ValueColumn title="Points per Day per Parallel Track" titleClass="text-blue-200">
              <CurrentAndPrevious issue={issue} valueKey="team.pointsPerDayPerTrack" />
            </ValueColumn>
          </div>

          <div className="flex gap-4 items-center my-4 items-stretch">
            <LabelsColumn />
            <ValueColumn title="Adjusted Estimate" titleClass="text-green-300">
              <CurrentAndPrevious issue={issue} valueKey="derivedTiming.deterministicTotalPoints" />
            </ValueColumn>
            <div>=</div>
            <ValueColumn title="Median Estimate">
              <CurrentAndPrevious
                issue={issue}
                valueKey="storyPointsMedian"
                validKey="derivedTiming.isStoryPointsMedianValid"
              />
            </ValueColumn>
            <div>× LOGNORMINV(</div>
            <ValueColumn title="Confidence">
              <CurrentAndPrevious
                issue={issue}
                valueKey="derivedTiming.usedConfidence"
                validKey="derivedTiming.isConfidenceValid"
                format={formatPercent}
              />
            </ValueColumn>
            <div>)</div>
          </div>
        </>
      ) : (
        <div className="flex gap-4 items-center mb-2 items-stretch">
          <LabelsColumn />
          <div className="flex-col">
            <div className="text-base font-bold">Estimated Days</div>
            <CurrentAndPrevious issue={issue} valueKey="derivedTiming.deterministicTotalDaysOfWork" />
          </div>
          <div className="text-center">=</div>
          <ValueColumn title="Estimate" titleClass="text-green-300">
            <CurrentAndPrevious issue={issue} valueKey="derivedTiming.deterministicTotalPoints" />
          </ValueColumn>
          <div className="align-middle"> ÷ </div>
          <ValueColumn title="Points per Day per Parallel Track" titleClass="text-blue-200">
            <CurrentAndPrevious issue={issue} valueKey="team.pointsPerDayPerTrack" />
          </ValueColumn>
        </div>
      )}

      {sameTeams ? (
        <div className="flex gap-4 items-center mt-4 items-stretch">
          <ValueColumn title="Points per Day per Track" titleClass="text-blue-200">
            <div className="text-right">{round(issue.team?.pointsPerDayPerTrack, 2)}</div>
          </ValueColumn>
          <div className="text-center">=</div>
          <ValueColumn title="Estimate Points Per Sprint">
            <div className="text-right">{issue.team?.velocity}</div>
          </ValueColumn>
          <div>÷</div>
          <ValueColumn title="Days Per Sprint">
            <div className="text-right">{issue.team?.daysPerSprint}</div>
          </ValueColumn>
          <div>÷</div>
          <ValueColumn title="Parallel Work Tracks">
            <div className="text-right">{issue.team?.parallelWorkLimit}</div>
          </ValueColumn>
        </div>
      ) : (
        <div className="flex gap-4 items-center mt-4 items-stretch">
          <ValueColumn title="Points per Day per Track" titleClass="text-blue-200">
            <CurrentAndPrevious issue={issue} valueKey="team.pointsPerDayPerTrack" />
          </ValueColumn>
          <div className="text-center">=</div>
          <ValueColumn title="Estimate Points Per Sprint">
            <CurrentAndPrevious issue={issue} valueKey="team.velocity" />
          </ValueColumn>
          <div>÷</div>
          <ValueColumn title="Parallel Work Tracks">
            <CurrentAndPrevious issue={issue} valueKey="team.parallelWorkLimit" />
          </ValueColumn>
          <div>÷</div>
          <ValueColumn title="Days Per Sprint">
            <CurrentAndPrevious issue={issue} valueKey="team.daysPerSprint" />
          </ValueColumn>
        </div>
      )}
    </div>
  );
};

export interface EstimateBreakdownModalProps {
  /** The issue whose breakdown to show, or `null` when closed. */
  issue: EstimationIssue | null;
  onClose: () => void;
}

/**
 * Modal showing the estimate-calculation breakdown for one issue, opened by clicking an
 * "Estimated Days" cell. Replaces table-grid.js's `EstimateBreakdown` `SimpleTooltip` popup;
 * follows the [PercentCompleteModal](../../../GanttReport/GanttGrid/components/PercentCompleteModal)
 * pattern.
 */
export const EstimateBreakdownModal: FC<EstimateBreakdownModalProps> = ({ issue, onClose }) => (
  <ModalTransition>
    {issue && (
      <Modal onClose={onClose} width="x-large">
        <ModalHeader>
          <div className="w-full flex justify-between">
            <div>
              <p className="py-2 flex gap-1 text-xs items-center">
{issue.issue?.fields?.['Issue Type']?.iconUrl && (
  <img src={issue.issue?.fields?.['Issue Type']?.iconUrl} alt="" />
)}
                {issue.url ? (
                  <a href={issue.url} className="hover:underline" target="_blank" rel="noreferrer">
                    {issue.key}
                  </a>
                ) : (
                  <span>{issue.key}</span>
                )}
              </p>
              <ModalTitle>Estimate Breakdown</ModalTitle>
            </div>
            <IconButton appearance="subtle" icon={CrossIcon} label="Close Modal" onClick={onClose} />
          </div>
        </ModalHeader>
        <ModalBody>
          <EstimateBreakdownBody issue={issue} />
        </ModalBody>
        <ModalFooter />
      </Modal>
    )}
  </ModalTransition>
);
