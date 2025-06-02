import { FC, useEffect } from 'react';
import React, { useState, useRef } from 'react';

import type { StatsUIData, SimulationIssueResult, MinimalSimulationIssueResult } from './scheduler/stats-analyzer';
import type { GridUIData } from './AutoScheduler';

import { IssueSimulationDays } from './IssueSimulationDays';
import { getUTCEndDateFromStartDateAndBusinessDays } from '../../../utils/date/business-days';

function hasUrl(issue: MinimalSimulationIssueResult | SimulationIssueResult): issue is SimulationIssueResult {
  return 'url' in issue.linkedIssue && typeof issue.linkedIssue.url === 'string';
}

export const IssueSimulationRow: React.FC<{
  issue: SimulationIssueResult | MinimalSimulationIssueResult;
  gridRowStart: number;
  gridData: GridUIData;
  selectedStartDate: Date;
}> = ({ issue, gridRowStart, gridData, selectedStartDate }) => {
  const [showDetails, setShowDetails] = useState(false);

  function percent(value: number) {
    return (value / gridData.gridNumberOfDays) * 100 + '%';
  }
  function percentWidth(start: number, end: number) {
    return ((end - start) / gridData.gridNumberOfDays) * 100 + '%';
  }

  function rangeBorderClasses() {
    if (!hasUrl(issue)) {
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
          {hasUrl(issue) ? (
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
        {hasUrl(issue) && showDetails && (
          <IssueSimulationDays
            gridNumberOfDays={gridData.gridNumberOfDays}
            issue={issue}
            startOrDue="start"
            selectedStartDate={selectedStartDate}
          />
        )}

        <div className="relative block py-0.5 z-50">
          {!hasUrl(issue) ? (
            <div
              id={issue.linkedIssue.key}
              className={`work-item cursor-pointer ${rangeBorderClasses()} relative bg-gradient-to-r from-blue-200 to-green-400 from-45% to-55% h-4 border-box rounded`}
              style={{
                left: percent(issue.dueDayBottom),
                width: percentWidth(issue.dueDayBottom, issue.dueDayTop),
              }}
              onClick={() => setShowDetails((v) => !v)}
            ></div>
          ) : (
            <>
              {/* The Little Line */}
              <div
                className="absolute bg-gradient-to-r from-blue-200 to-green-200 from-85% to-95% h-1 top-2.5 border-box"
                style={{
                  left: percent(issue.startDayBottom),
                  width: percentWidth(issue.startDayBottom, issue.dueDayTop),
                }}
              />
              {/* The BIG Line */}
              <div
                id={issue.linkedIssue.key}
                className={`work-item cursor-pointer ${rangeBorderClasses()} relative bg-gradient-to-r from-blue-500 to-green-400 from-45% to-55% h-4 border-box rounded`}
                style={{
                  left: percent(issue.startDateWithTimeEnoughToFinish),
                  width: percentWidth(issue.startDateWithTimeEnoughToFinish, issue.dueDayTop),
                }}
                onClick={() => setShowDetails((v) => !v)}
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
    </>
  );
};

const monthDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function getDatesFromSimulationIssue(
  issue: SimulationIssueResult | MinimalSimulationIssueResult,
  startDate: Date,
) {
  const isMinimal = !hasUrl(issue);

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
    dueDateStr: monthDateFormatter.format(rangeEndDate),
  };
}
