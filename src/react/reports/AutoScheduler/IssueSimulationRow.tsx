import React, { useMemo, useState } from 'react';
import LockLockedIcon from '@atlaskit/icon/core/lock-locked';
import { highlightUpstream, highlightDownstream } from './svg-blockers';

import type {
  StatsUIData,
  SimulationIssueResult,
  MinimalSimulationIssueResult,
  UncertaintyWeight,
} from './scheduler/stats-analyzer';
import type { GridUIData } from './AutoScheduler';

import { IssueSimulationDays } from './IssueSimulationDays';
import { gridLayer } from './z-layers';
import { IssueSummaryLabel } from './IssueSummaryLabel';
import { FreezeToggle } from './components/FreezeToggle';
import { JiraDatesShadow } from './components/JiraDatesShadow';
import { canFreeze } from './scheduler/link-issues';
import { businessDayOffsetToDate, jiraDayOffsets } from './scheduler/business-day-offset';

function isFullSimulationResult(
  issue: MinimalSimulationIssueResult | SimulationIssueResult,
): issue is SimulationIssueResult {
  return 'url' in issue.linkedIssue && typeof issue.linkedIssue.url === 'string';
}
import { TotalWorkingDays } from '../GanttReport/GanttGrid/components/PercentCompleteModal/CalculationBreakdown';
import { Popper } from '@atlaskit/popper';

const monthDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The overall-timing start histogram is mostly one spike at the start date (runs that needed no
 * early start). Cap it so the tail of early starts is drawn at a readable scale.
 */
const OVERALL_START_HISTOGRAM = {
  capDay: 0,
  subject: 'work has to start on or before',
};

/** How a frozen bar shows uncertainty: none when both dates are held, otherwise only on the free side. */
function frozenBarFill(frozen: { startDay: number | null; dueDay: number | null }) {
  if (frozen.startDay != null && frozen.dueDay != null) return 'bg-blue-500';
  if (frozen.dueDay != null) return 'bg-gradient-to-r from-blue-200 to-blue-500 from-0% to-35%';
  return 'bg-gradient-to-r from-blue-500 to-green-300 from-65% to-100%';
}

export const IssueSimulationRow: React.FC<{
  issue: SimulationIssueResult | MinimalSimulationIssueResult;
  gridRowStart: number;
  gridData: GridUIData;
  selectedStartDate: Date;
  uncertaintyWeight: UncertaintyWeight;
  /** Present for team rows; the plan-finish row can't be frozen. */
  isFrozen?: boolean;
  onToggleFreeze?: (key: string, frozen: boolean) => void;
  /** Overall-timing row only: when the plan has to start, drawn as the mirror of the finish band. */
  planStart?: StatsUIData['planStart'];
  /** Controls the histograms from outside, for a parent whose layout depends on them being open. */
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
}> = ({
  issue,
  gridRowStart,
  gridData,
  selectedStartDate,
  uncertaintyWeight,
  isFrozen = false,
  onToggleFreeze,
  planStart,
  detailsOpen,
  onDetailsOpenChange,
}) => {
  // STATE ==============
  const [ownShowDetails, setOwnShowDetails] = useState(false);
  const showDetails = detailsOpen ?? ownShowDetails;
  const setShowDetails = (update: (open: boolean) => boolean) => {
    const next = update(showDetails);
    setOwnShowDetails(next);
    onDetailsOpenChange?.(next);
  };

  const [bigLineElement, setBigLineElement] = useState<HTMLElement | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // UI HELPERS ==============

  // Day offsets are from the start date; the grid can begin before it (`gridStartDay < 0`).
  function percent(value: number) {
    return ((value - gridData.gridStartDay) / gridData.gridNumberOfDays) * 100 + '%';
  }
  function percentWidth(start: number, end: number) {
    return ((end - start) / gridData.gridNumberOfDays) * 100 + '%';
  }

  const fullResult = isFullSimulationResult(issue) ? issue : null;
  const frozen = fullResult?.linkedIssue.frozen ?? null;
  // Frozen items before the start date are just where Jira has them; only scheduled work warns.
  const startsBeforeStartDate = Boolean(fullResult) && !frozen && fullResult!.startDateWithTimeEnoughToFinish < 0;

  // Only items with both Jira dates get a shadow; one date doesn't say where the work sits.
  const derivedTiming = fullResult?.linkedIssue.derivedTiming;
  const shadow = useMemo(
    () => (derivedTiming?.start && derivedTiming?.due ? jiraDayOffsets(selectedStartDate, derivedTiming) : null),
    [derivedTiming, selectedStartDate],
  );

  function rangeBorderClasses() {
    if (fullResult?.isOverflowTrack) {
      return 'border-solid border-2 border-yellow-500';
    }
    if (!isFullSimulationResult(issue)) {
      // Full height either way: a range is a wider bar, a single date a narrow pill. (A 6px white
      // inset used to shrink a range to a 4px stripe, so the more uncertain case looked fainter.)
      if (issue.dueDayBottom === issue.dueDayTop) {
        return 'border-solid border border-x-4 border-green-200';
      } else {
        return 'border-solid border border-white';
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
      <IssueSummaryLabel
        summary={issue.linkedIssue.summary}
        url={isFullSimulationResult(issue) ? issue.linkedIssue.url : undefined}
        openInNewTab
        textClassName="pointer hover:underline"
        gridRowStart={gridRowStart}
        leading={
          fullResult && onToggleFreeze ? (
            <FreezeToggle
              summary={fullResult.linkedIssue.summary}
              isFrozen={isFrozen}
              canFreeze={canFreeze(fullResult.linkedIssue)}
              onToggle={(next) => onToggleFreeze(fullResult.linkedIssue.key, next)}
            />
          ) : undefined
        }
      />

      {/* The Chart. The overall-timing row opens its histograms from anywhere on the row. */}
      <div
        data-testid={isFullSimulationResult(issue) ? undefined : 'overall-timing-row'}
        className={isFullSimulationResult(issue) ? undefined : 'cursor-pointer'}
        style={{
          gridRow: `${gridRowStart} / span 1`,
          gridColumn: `2 / span ${gridData.gridNumberOfDays}`,
        }}
        onClick={isFullSimulationResult(issue) ? undefined : () => setShowDetails((v) => !v)}
        onMouseEnter={() => {
          if (isFullSimulationResult(issue)) {
            highlightUpstream(issue.linkedIssue, true);
            highlightDownstream(issue.linkedIssue, true);
          }
        }}
        onMouseLeave={() => {
          if (isFullSimulationResult(issue)) {
            highlightUpstream(issue.linkedIssue, false);
            highlightDownstream(issue.linkedIssue, false);
          }
        }}
      >
        {/* The plan's start histogram only says something once some run has to start early. */}
        {showDetails && (isFullSimulationResult(issue) || (planStart?.beforeStartPercent ?? 0) > 0) && (
          <IssueSimulationDays
            gridNumberOfDays={gridData.gridNumberOfDays}
            gridStartDay={gridData.gridStartDay}
            issue={issue}
            startOrDue="start"
            selectedStartDate={selectedStartDate}
            {...(isFullSimulationResult(issue) ? {} : OVERALL_START_HISTOGRAM)}
          />
        )}

        <div className="relative block py-0.5" style={{ zIndex: gridLayer.row }}>
          {!isFullSimulationResult(issue) ? (
            <>
              {planStart && (
                <>
                  <div
                    data-testid="overall-start-band"
                    className={`transition-all duration-100 absolute top-0.5 h-4 rounded border-box bg-gradient-to-r from-blue-400 to-blue-200 from-45% to-55% ${
                      // The finish band's look, in blue: a narrow pill for a single day, a wider bar for a range.
                      planStart.startDay === planStart.startDayLate
                        ? 'border-solid border border-x-4 border-blue-200'
                        : 'border-solid border border-white'
                    }`}
                    style={{
                      left: percent(planStart.startDay),
                      width: percentWidth(planStart.startDay, planStart.startDayLate),
                    }}
                    onMouseEnter={(e) => {
                      setBigLineElement(e.currentTarget);
                      setShowTooltip(true);
                    }}
                    onMouseLeave={() => setShowTooltip(false)}
                  />
                </>
              )}
              <div
                id={issue.linkedIssue.key}
                className={`transition-all duration-100 work-item cursor-pointer ${rangeBorderClasses()} relative bg-gradient-to-r from-green-200 to-green-400 from-45% to-55% h-4 border-box rounded`}
                style={{
                  left: percent(issue.dueDayBottom),
                  width: percentWidth(issue.dueDayBottom, issue.dueDayTop),
                }}
                onMouseEnter={(e) => {
                  setBigLineElement(e.currentTarget);
                  setShowTooltip(true);
                }}
                onMouseLeave={() => setShowTooltip(false)}
              />
            </>
          ) : (
            <>
              {shadow?.startDay != null && shadow.dueDay != null && (
                <JiraDatesShadow
                  startDay={shadow.startDay}
                  dueDay={shadow.dueDay}
                  gridNumberOfDays={gridData.gridNumberOfDays}
                  gridStartDay={gridData.gridStartDay}
                  barStartDay={issue.startDateWithTimeEnoughToFinish}
                  barDueDay={issue.dueDayTop}
                />
              )}
              {/* The thin line, under the bar: from when the item might start to its own finish at the
                  slider's risk. Past the bar's end it is the whisker — how far a bad run could go. */}
              {!frozen && (
                <div
                  data-testid="issue-range-line"
                  className="transition-all duration-100 absolute bg-gradient-to-r from-blue-200 to-green-200 from-85% to-95% h-1 top-2.5 border-box"
                  style={{
                    left: percent(Math.min(issue.startDayBottom, issue.startDateWithTimeEnoughToFinish)),
                    width: percentWidth(
                      Math.min(issue.startDayBottom, issue.startDateWithTimeEnoughToFinish),
                      Math.max(issue.ownDueDayTop, issue.dueDayTop),
                    ),
                  }}
                />
              )}
              {/* The BIG Line */}
              <div
                id={issue.linkedIssue.key}
                data-frozen={frozen ? 'true' : undefined}
                className={`transition-all duration-100 work-item cursor-pointer ${rangeBorderClasses()} relative ${
                  frozen
                    ? `${frozenBarFill(frozen)} flex items-center overflow-hidden text-white`
                    : 'bg-gradient-to-r from-blue-500 to-green-400 from-45% to-55%'
                } h-4 border-box rounded`}
                style={{
                  left: percent(issue.startDateWithTimeEnoughToFinish),
                  width: percentWidth(issue.startDateWithTimeEnoughToFinish, issue.dueDayTop),
                }}
                onClick={() => setShowDetails((v) => !v)}
                onMouseEnter={(e) => {
                  setBigLineElement(e.currentTarget);
                  setShowTooltip(true);
                }}
                onMouseLeave={() => setShowTooltip(false)}
              >
                {frozen && (
                  <span className="flex shrink-0 scale-75">
                    <LockLockedIcon label="Frozen" color="currentColor" />
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {showDetails && (
          <IssueSimulationDays
            gridNumberOfDays={gridData.gridNumberOfDays}
            gridStartDay={gridData.gridStartDay}
            issue={issue}
            startOrDue="due"
            selectedStartDate={selectedStartDate}
          />
        )}
      </div>
      {showTooltip && bigLineElement && isFullSimulationResult(issue) && (
        <>
          {
            <Popper referenceElement={bigLineElement} placement="bottom">
              {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => {
                const fullIssue = issue as SimulationIssueResult;
                const issueDates = getDatesFromSimulationIssue(issue, selectedStartDate);
                const velocity = fullIssue.linkedIssue.team.totalPointsPerDay;
                const velocityPerTrack = fullIssue.linkedIssue.team.pointsPerDayPerTrack;
                return (
                  <div className="flex gap-2 items-start z-50" ref={ref} style={style}>
                    <div className="z-50 text-sm rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 border border-white">
                      {frozen && <div className="font-semibold">Frozen at its Jira dates</div>}
                      <div>Must start: {monthDateFormatter.format(issueDates.startDateWithTimeEnoughToFinish)}</div>
                      {!frozen && <div>Might start: {monthDateFormatter.format(issueDates.startDateBottom)}</div>}
                      <FrozenConstraintLines
                        issue={fullIssue}
                        selectedStartDate={selectedStartDate}
                        startsBeforeStartDate={startsBeforeStartDate}
                      />
                    </div>

                    <div className=" text-sm rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 border border-white">
                      <div>{Math.round(issue.adjustedDaysOfWork)} days</div>
                      <div>{Math.round(issue.adjustedDaysOfWork * velocityPerTrack)} adjusted points</div>
                      <div>
                        <span className={fullIssue.linkedIssue.storyPointsMedian == null ? `text-orange-400` : ''}>
                          {fullIssue.linkedIssue.storyPointsMedian == null ? 'defaulted ' : ' '}
                        </span>
                        {fullIssue.linkedIssue.derivedTiming.defaultOrStoryPointsMedian} estimated points
                      </div>
                      <div>
                        <span className={fullIssue.linkedIssue.confidence == null ? `text-orange-400` : ''}>
                          {fullIssue.linkedIssue.confidence == null ? 'defaulted ' + ' ' : ' '}
                        </span>
                        {fullIssue.linkedIssue.derivedTiming.usedConfidence} confidence
                      </div>
                    </div>

                    <div className="z-50 text-sm rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 border border-white">
                      <div>Must end: {monthDateFormatter.format(issueDates.dueDateTop)}</div>
                      {!frozen && issueDates.ownDueDate && (
                        <div>
                          {uncertaintyWeight === 'average'
                            ? `Done by ${monthDateFormatter.format(issueDates.ownDueDate)} on average`
                            : `${uncertaintyWeight}% chance done by ${monthDateFormatter.format(issueDates.ownDueDate)}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            </Popper>
          }
        </>
      )}

      {showTooltip && bigLineElement && !isFullSimulationResult(issue) && (
        <>
          <Popper referenceElement={bigLineElement} placement="bottom">
            {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => {
              const issueDates = getDatesFromSimulationIssue(issue, selectedStartDate);
              return (
                <div ref={ref} style={style} className="z-50 text-sm rounded-[3px] text-white flex gap-2">
                  {planStart && planStart.beforeStartPercent > 0 && (
                    <div className="bg-neutral-801 py-0.5 px-1.5 border border-white">
                      <div>
                        {uncertaintyWeight === 'average' ? 'In the middle run' : `To be ${uncertaintyWeight}% sure`}
                      </div>
                      <div>work has to start by</div>
                      <div>
                        {monthDateFormatter.format(businessDayOffsetToDate(selectedStartDate, planStart.startDay))}
                      </div>
                      <div className="text-orange-400">
                        {Math.max(1, Math.round(planStart.beforeStartPercent))}% of runs start early
                      </div>
                    </div>
                  )}
                  {uncertaintyWeight === 'average' ? (
                    <div className="bg-neutral-801 py-0.5 px-1.5 border border-white">
                      <div>On average</div>
                      <div>work ends after </div>
                      <div>{monthDateFormatter.format(issueDates.dueDateBottom)}</div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-neutral-801 py-0.5 px-1.5 border border-white">
                        <div>{uncertaintyWeight}% chance</div>
                        <div>work ends after </div>
                        <div>{monthDateFormatter.format(issueDates.dueDateBottom)}</div>
                      </div>
                      <div className="bg-neutral-801 py-0.5 px-1.5 border border-white">
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

/** The tooltip lines that only appear once something is frozen. */
const FrozenConstraintLines: React.FC<{
  issue: SimulationIssueResult;
  selectedStartDate: Date;
  /** The bar at the slider's confidence starts before the start date — the only time the share matters. */
  startsBeforeStartDate: boolean;
}> = ({ issue, selectedStartDate, startsBeforeStartDate }) => {
  const lateFor = issue.linkedIssue.linkedBlocks.filter((blocked) => blocked.frozen);
  const { overlapInfo, mustStartByDay } = issue;
  return (
    <>
      {mustStartByDay !== undefined && (
        <div className={mustStartByDay < 0 ? 'text-orange-400' : ''}>
          Must start by {monthDateFormatter.format(businessDayOffsetToDate(selectedStartDate, mustStartByDay))}
          {mustStartByDay < 0 ? ' (before the start date)' : ''}
        </div>
      )}
      {startsBeforeStartDate && issue.beforeStartPercent > 0 && (
        <div className="text-orange-400">
          Starts before the start date in {Math.round(issue.beforeStartPercent)}% of runs
        </div>
      )}
      {issue.lateForFrozenPercent > 0 && lateFor.length > 0 && (
        <div className="text-orange-400">
          Finished after {lateFor.map((blocked) => blocked.summary).join(', ')} started in{' '}
          {Math.round(issue.lateForFrozenPercent)}% of simulations
        </div>
      )}
      {overlapInfo && (
        <div className="text-orange-400">
          Over capacity: {overlapInfo.overlapping} items overlap on {overlapInfo.tracks} track
          {overlapInfo.tracks === 1 ? '' : 's'},{' '}
          {shortDateFormatter.format(businessDayOffsetToDate(selectedStartDate, overlapInfo.startDay))} –{' '}
          {shortDateFormatter.format(businessDayOffsetToDate(selectedStartDate, overlapInfo.endDay))}
        </div>
      )}
    </>
  );
};

export function getDatesFromSimulationIssue(
  issue: SimulationIssueResult | MinimalSimulationIssueResult,
  startDate: Date,
) {
  const isMinimal = !isFullSimulationResult(issue);

  const rangeStartDate = isMinimal ? startDate : businessDayOffsetToDate(startDate, issue.startDayBottom);

  const rangeEndDate = businessDayOffsetToDate(startDate, issue.dueDayTop);

  return {
    additionalPoints: isMinimal ? null : issue.linkedIssue.derivedTiming.deterministicExtraPoints,
    totalPoints: isMinimal ? null : issue.linkedIssue.derivedTiming.deterministicTotalPoints,
    //startDate: rangeStartDate,
    //dueDate: rangeEndDate,
    startDateBottom: rangeStartDate,
    startDateStr: monthDateFormatter.format(rangeStartDate),
    ...(isMinimal
      ? {
          startDateWithTimeEnoughToFinish: businessDayOffsetToDate(startDate, issue.startDateWithTimeEnoughToFinish),
          dueDateTop: rangeEndDate,
          ownDueDate: null,
        }
      : barDates(issue, startDate)),
    dueDateBottom: businessDayOffsetToDate(startDate, issue.dueDayBottom),
    dueDateStr: monthDateFormatter.format(rangeEndDate),
  };
}

/**
 * The dates a bar is written to Jira as. A bar ends at an exclusive offset, while a Jira due date is
 * the last day worked, so the due is one business day before the end. Both ends round the same way,
 * so bars that touch stay touching once written — and freezing them doesn't overlap a track.
 */
function barDates(issue: SimulationIssueResult, startDate: Date) {
  const startDay = Math.round(issue.startDateWithTimeEnoughToFinish);
  const lastDay = (endDay: number) => businessDayOffsetToDate(startDate, Math.max(startDay, Math.round(endDay) - 1));
  return {
    startDateWithTimeEnoughToFinish: businessDayOffsetToDate(startDate, startDay),
    dueDateTop: lastDay(issue.dueDayTop),
    /** The item's own `p`% finish from the simulation, for "p% chance done by". */
    ownDueDate: lastDay(issue.ownDueDayTop),
  };
}
