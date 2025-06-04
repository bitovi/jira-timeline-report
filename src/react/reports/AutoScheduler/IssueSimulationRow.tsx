import { FC, useEffect } from 'react';
import React, { useState, useRef } from 'react';

import type {
  StatsUIData,
  SimulationIssueResult,
  MinimalSimulationIssueResult,
  UncertaintyWeight,
} from './scheduler/stats-analyzer';
import type { GridUIData } from './AutoScheduler';

import { IssueSimulationDays } from './IssueSimulationDays';
import { getUTCEndDateFromStartDateAndBusinessDays } from '../../../utils/date/business-days';

function isFullSimulationResult(
  issue: MinimalSimulationIssueResult | SimulationIssueResult,
): issue is SimulationIssueResult {
  return 'url' in issue.linkedIssue && typeof issue.linkedIssue.url === 'string';
}
import { TotalWorkingDays } from '../GanttReport/PercentComplete/PercentComplete';
import { Popper } from '@atlaskit/popper';

const monthDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export const IssueSimulationRow: React.FC<{
  issue: SimulationIssueResult | MinimalSimulationIssueResult;
  gridRowStart: number;
  gridData: GridUIData;
  selectedStartDate: Date;
  uncertaintyWeight: UncertaintyWeight;
}> = ({ issue, gridRowStart, gridData, selectedStartDate, uncertaintyWeight }) => {
  // STATE ==============
  const [showDetails, setShowDetails] = useState(false);

  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // UI HELPERS ==============

  function percent(value: number) {
    return (value / gridData.gridNumberOfDays) * 100 + '%';
  }
  function percentWidth(start: number, end: number) {
    return ((end - start) / gridData.gridNumberOfDays) * 100 + '%';
  }

  function rangeBorderClasses() {
    if (!isFullSimulationResult(issue)) {
      if (issue.dueDayBottom === issue.dueDayTop) {
        return 'border-solid border border-x-4 border-green-200';
      } else {
        return 'border-solid border border-[6px] border-white';
      }
    } else {
      if (
        !issue.linkedIssue.derivedTiming.isConfidenceValid ||
        (!issue.linkedIssue.derivedTiming.isStoryPointsValid &&
          !issue.linkedIssue.derivedTiming.isStoryPointsMedianValid)
      ) {
        return 'border-solid border-2 border-yellow-500';
      } else {
        return 'border-solid border';
      }
    }
  }

  return (
    <>
      <div
        className="pl-5 self-center pr-2 truncate max-w-sm"
        style={{ gridRow: gridRowStart, gridColumnStart: 'what' }}
      >
        <div className="text-gray-600">
          {isFullSimulationResult(issue) ? (
            <a href={issue.linkedIssue.url}>{issue.linkedIssue.summary}</a>
          ) : (
            <div>{issue.linkedIssue.summary}</div>
          )}
        </div>
      </div>

      {/* The Chart */}
      <div
        onMouseEnter={() => {
          console.log({
            issue,
            ...getDatesFromSimulationIssue(issue, selectedStartDate),
          });
        }}
        style={{
          gridRow: `${gridRowStart} / span 1`,
          gridColumn: `2 / span ${gridData.gridNumberOfDays}`,
        }}
      >
        {isFullSimulationResult(issue) && showDetails && (
          <IssueSimulationDays
            gridNumberOfDays={gridData.gridNumberOfDays}
            issue={issue}
            startOrDue="start"
            selectedStartDate={selectedStartDate}
          />
        )}

        <div className="relative block py-0.5 z-30">
          {!isFullSimulationResult(issue) ? (
            <div
              id={issue.linkedIssue.key}
              className={`transition-all duration-100 work-item cursor-pointer ${rangeBorderClasses()} relative bg-gradient-to-r from-green-200 to-green-400 from-45% to-55% h-4 border-box rounded`}
              style={{
                left: percent(issue.dueDayBottom),
                width: percentWidth(issue.dueDayBottom, issue.dueDayTop),
              }}
              onMouseEnter={(e) => {
                setAnchorElement(e.currentTarget);
                setShowTooltip(true);
              }}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowDetails((v) => !v)}
            ></div>
          ) : (
            <>
              {/* The Little Line */}
              <div
                className="transition-all duration-100 absolute bg-gradient-to-r from-blue-200 to-green-200 from-85% to-95% h-1 top-2.5 border-box"
                style={{
                  left: percent(issue.startDayBottom),
                  width: percentWidth(issue.startDayBottom, issue.dueDayTop),
                }}
              />
              {/* The BIG Line */}
              <div
                id={issue.linkedIssue.key}
                className={`transition-all duration-100 work-item cursor-pointer ${rangeBorderClasses()} relative bg-gradient-to-r from-blue-500 to-green-400 from-45% to-55% h-4 border-box rounded`}
                style={{
                  left: percent(issue.startDateWithTimeEnoughToFinish),
                  width: percentWidth(issue.startDateWithTimeEnoughToFinish, issue.dueDayTop),
                }}
                onClick={() => setShowDetails((v) => !v)}
                onMouseEnter={(e) => {
                  setAnchorElement(e.currentTarget);
                  setShowTooltip(true);
                }}
                onMouseLeave={() => setShowTooltip(false)}
              ></div>
            </>
          )}
        </div>
        {showDetails && (
          <IssueSimulationDays
            gridNumberOfDays={gridData.gridNumberOfDays}
            issue={issue}
            startOrDue="due"
            selectedStartDate={selectedStartDate}
          />
        )}
      </div>
      {showTooltip && anchorElement && isFullSimulationResult(issue) && (
        <>
          <Popper referenceElement={anchorElement} placement="left">
            {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => {
              const issueDates = getDatesFromSimulationIssue(issue, selectedStartDate);
              return (
                <div
                  ref={ref}
                  style={style}
                  className="z-50 text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 border border-white"
                >
                  {monthDateFormatter.format(issueDates.startDateWithTimeEnoughToFinish)}
                </div>
              );
            }}
          </Popper>
          <Popper referenceElement={anchorElement} placement="right">
            {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => {
              const issueDates = getDatesFromSimulationIssue(issue, selectedStartDate);
              return (
                <div
                  ref={ref}
                  style={style}
                  className="z-50 text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 border border-white"
                >
                  {monthDateFormatter.format(issueDates.dueDateTop)}
                </div>
              );
            }}
          </Popper>
          {
            <Popper referenceElement={anchorElement} placement="bottom">
              {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => {
                const fullIssue = issue as SimulationIssueResult;
                return (
                  <div
                    ref={ref}
                    style={style}
                    className="z-50 text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 border border-white"
                  >
                    <div>{Math.round(issue.linkedIssue.derivedTiming.deterministicTotalDaysOfWork)} days</div>
                    <div>
                      {Math.round(fullIssue.linkedIssue.derivedTiming.deterministicTotalPoints)} adjusted points
                    </div>
                    <div>
                      <span className={fullIssue.linkedIssue.storyPointsMedian == null ? `text-orange-400` : ''}>
                        {fullIssue.linkedIssue.storyPointsMedian == null
                          ? 'missing '
                          : fullIssue.linkedIssue.storyPointsMedian}
                      </span>
                      estimated points
                    </div>
                    <div>{fullIssue.linkedIssue.confidence} confidence</div>
                  </div>
                );
                /*return (
              <div ref={ref} style={style} 
                className="z-50 text-xs rounded-[3px] bg-white py-0.5 px-1.5 border border-black">
                  <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, auto)' }}>
                    <TotalWorkingDays issue={issue.linkedIssue}></TotalWorkingDays>
                  </div>
              </div>
            )*/
              }}
            </Popper>
          }
        </>
      )}

      {showTooltip && anchorElement && !isFullSimulationResult(issue) && (
        <>
          <Popper referenceElement={anchorElement} placement="bottom">
            {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => {
              const issueDates = getDatesFromSimulationIssue(issue, selectedStartDate);
              return (
                <div
                  ref={ref}
                  style={style}
                  className="z-50 text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 border border-white flex gap-2"
                >
                  {uncertaintyWeight === 'average' ? (
                    <div>
                      <div>On average</div>
                      <div>work ends after </div>
                      <div>{monthDateFormatter.format(issueDates.dueDateBottom)}</div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div>{uncertaintyWeight}% chance</div>
                        <div>work ends after </div>
                        <div>{monthDateFormatter.format(issueDates.dueDateBottom)}</div>
                      </div>
                      <div>
                        <div>{uncertaintyWeight}% chance</div>
                        <div>work ends before </div>
                        <div>{monthDateFormatter.format(issueDates.dueDateTop)}</div>
                      </div>
                    </>
                  )}
                </div>
              );
            }}
          </Popper>
        </>
      )}
    </>
  );
};

export function getDatesFromSimulationIssue(
  issue: SimulationIssueResult | MinimalSimulationIssueResult,
  startDate: Date,
) {
  const isMinimal = !isFullSimulationResult(issue);

  const rangeStartDate = isMinimal
    ? startDate
    : getUTCEndDateFromStartDateAndBusinessDays(startDate, issue.startDayBottom);

  const rangeEndDate = getUTCEndDateFromStartDateAndBusinessDays(startDate, issue.dueDayTop);

  return {
    additionalPoints: isMinimal ? null : issue.linkedIssue.derivedTiming.deterministicExtraPoints,
    totalPoints: isMinimal ? null : issue.linkedIssue.derivedTiming.deterministicTotalPoints,
    //startDate: rangeStartDate,
    //dueDate: rangeEndDate,
    startDateBottom: rangeStartDate,
    startDateStr: monthDateFormatter.format(rangeStartDate),
    startDateWithTimeEnoughToFinish: getUTCEndDateFromStartDateAndBusinessDays(
      startDate,
      issue.startDateWithTimeEnoughToFinish,
    ),
    dueDateTop: rangeEndDate,
    dueDateBottom: getUTCEndDateFromStartDateAndBusinessDays(startDate, issue.dueDayBottom),
    dueDateStr: monthDateFormatter.format(rangeEndDate),
  };
}
