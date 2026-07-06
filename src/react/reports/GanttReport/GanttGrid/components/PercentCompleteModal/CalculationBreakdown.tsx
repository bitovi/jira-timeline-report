import React, { FC } from 'react';
import cn from 'classnames';
import type { DerivedTimingSlice } from '../../types';

/**
 * Minimal shape `SelfCalculationBox`/`TotalWorkingDays` need — deliberately decoupled from the
 * Gantt's full `IssueOrRelease` so `AutoScheduler` (which has its own, differently-shaped issue
 * type) can reuse `TotalWorkingDays` without depending on Gantt-specific types.
 *
 * Ports the "self" calculation view from
 * [PercentComplete.tsx](src/react/reports/GanttReport/PercentComplete/PercentComplete.tsx#L70-L120).
 */
export interface TimingIssue {
  team?: {
    spreadEffortAcrossDates?: boolean;
    pointsPerDayPerTrack?: number;
    velocity?: number;
    parallelWorkLimit?: number;
    daysPerSprint?: number;
  } | null;
  derivedTiming?: DerivedTimingSlice;
}

function timingMethod(issue: TimingIssue): 'dates' | 'points-and-confidence' | 'points' | 'unknown' {
  const derivedTiming = issue.derivedTiming;
  if (!derivedTiming) return 'unknown';
  if (!issue.team?.spreadEffortAcrossDates && derivedTiming.datesDaysOfWork != null) {
    return 'dates';
  } else if (derivedTiming.isStoryPointsMedianValid) {
    return 'points-and-confidence';
  } else if (derivedTiming.isStoryPointsValid) {
    return 'points';
  } else if (derivedTiming.datesDaysOfWork != null) {
    return 'dates';
  } else {
    return 'unknown';
  }
}

function percent(numerator: number, denominator: number): string {
  return Math.round((numerator * 100) / (denominator || 1)) + '%';
}

interface CalculationBoxProps {
  className?: string;
  currentValue: string | number;
  title: string;
}

const CalculationBox: FC<CalculationBoxProps> = ({ className, currentValue, title }) => (
  <div className={cn('flex-col justify-items-center px-1 py-3 rounded-md border', className)}>
    <div className="text-sm font-semibold">{title}</div>
    <div className="flex justify-center gap-1 items-baseline">
      <div>{currentValue}</div>
    </div>
  </div>
);

const EquationEqual: FC = () => <div className="self-center justify-self-center">=</div>;

export function TotalWorkingDays({ issue }: { issue: TimingIssue }) {
  const derivedTiming = issue.derivedTiming;
  const issueTimingMethod = timingMethod(issue);
  return (
    <>
      <CalculationBox title="Total working days" currentValue={Math.round(derivedTiming?.totalDaysOfWork || 0)} />
      <EquationEqual />
      {(() => {
        switch (issueTimingMethod) {
          case 'points-and-confidence':
            return (
              <>
                <CalculationBox
                  title="Adjusted estimate"
                  currentValue={Math.round(derivedTiming?.deterministicTotalPoints || 0)}
                  className="border-[#6CC3E0] bg-[#E7F9FF]"
                />
                <div className="self-center justify-self-center">÷</div>
                <CalculationBox
                  title="Points per day per parallel track"
                  currentValue={issue.team?.pointsPerDayPerTrack ?? 0}
                  className="border-[#9F8FEF] bg-[#F3F0FF]"
                />
              </>
            );
          case 'dates':
            return (
              <>
                <CalculationBox
                  title="Start date – End date"
                  currentValue={(derivedTiming?.datesDaysOfWork ?? 0) + ' days'}
                />
                <div style={{ gridColumn: '4 / span 2' }} />
              </>
            );
          default:
            return <div style={{ gridColumn: '3 / span 3' }}>TBD</div>;
        }
      })()}

      {issueTimingMethod === 'points-and-confidence' && (
        <>
          <CalculationBox
            title="Adjusted estimate"
            currentValue={Math.round(derivedTiming?.deterministicTotalPoints || 0)}
            className="border-[#6CC3E0] bg-[#E7F9FF]"
          />
          <div className="self-center justify-self-center">=</div>
          <CalculationBox title="Median estimate" currentValue={derivedTiming?.defaultOrStoryPointsMedian ?? 0} />
          <div className="self-center justify-self-center">*</div>
          <CalculationBox title="LOGNORMINV × Confidence" currentValue={(derivedTiming?.usedConfidence ?? 0) + '%'} />
        </>
      )}
      {issueTimingMethod === 'points-and-confidence' && (
        <>
          <CalculationBox
            title="Points per day per parallel track"
            currentValue={issue.team?.pointsPerDayPerTrack ?? 0}
            className="border-[#9F8FEF] bg-[#F3F0FF]"
          />
          <div className="self-center justify-self-center">=</div>
          <div className="flex justify-evenly" style={{ gridColumn: '3 / span 3' }}>
            <CalculationBox title="Velocity per sprint" currentValue={issue.team?.velocity ?? 0} />
            <div className="self-center justify-self-center">÷</div>
            <CalculationBox title="Parallel work tracks" currentValue={issue.team?.parallelWorkLimit ?? 0} />
            <div className="self-center justify-self-center">÷</div>
            <CalculationBox title="Days per sprint" currentValue={issue.team?.daysPerSprint ?? 0} />
          </div>
        </>
      )}
    </>
  );
}

/**
 * The full "self" percent-complete calculation breakdown shown when
 * `completionRollup.source === 'self'` — the issue's own timing/estimate math, with no
 * children to roll up.
 */
export const SelfCalculationBox: FC<{ issue: TimingIssue }> = ({ issue }) => {
  const derivedTiming = issue.derivedTiming;
  const issueTimingMethod = timingMethod(issue);

  return (
    <>
      <p className="py-2">Calculation method: {issueTimingMethod}</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, auto)' }}>
        <CalculationBox
          title="Completed working days"
          currentValue={Math.round(derivedTiming?.completedDaysOfWork || 0)}
        />
        <EquationEqual />
        <CalculationBox
          title="Completed percent"
          className="border-[#F5CD47] bg-[#FFF7D6]"
          currentValue={percent(derivedTiming?.completedDaysOfWork || 0, derivedTiming?.totalDaysOfWork || 0)}
        />
        <div className="self-center justify-self-center">x</div>
        <CalculationBox
          title="Total working days"
          className="border-[#94C748] bg-[#EFFFD6]"
          currentValue={Math.round(derivedTiming?.totalDaysOfWork || 0)}
        />
        <CalculationBox
          title="Completed percent"
          className="border-[#F5CD47] bg-[#FFF7D6]"
          currentValue={percent(derivedTiming?.completedDaysOfWork || 0, derivedTiming?.totalDaysOfWork || 0)}
        />
        <EquationEqual />
        {derivedTiming?.datesDaysOfWork ? (
          <>
            <CalculationBox title="Start date – Now" currentValue={derivedTiming.datesCompletedDaysOfWork + ' days'} />
            <div className="self-center justify-self-center">÷</div>
            <CalculationBox title="Start date – End date" currentValue={derivedTiming.datesDaysOfWork + ' days'} />
          </>
        ) : (
          <div style={{ gridColumn: '3 / span 3' }}>
            <CalculationBox title="No Dates" currentValue="0" />
          </div>
        )}
        <TotalWorkingDays issue={issue} />
      </div>
    </>
  );
};
