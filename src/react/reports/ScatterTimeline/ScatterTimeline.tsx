import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease, PlottedIssue } from './types';
import { computeQuartersAndMonths } from '../../../utils/date/compute-quarters-and-months';
import { roundAndShiftDueDate } from '../../../utils/date/round-and-shift-due-date';
import {
  computeDateRange,
  computeGridColumnCSS,
  calculateTodayMargin,
  calculatePositionPercentages,
  packIssuesIntoRows,
  sortIssuesByLeftPosition,
  getStatusColorClass,
  shouldUseDensityOptimizations,
  filterIssuesWithDates,
} from './helpers';
import { useMeasuredTextWidths } from './hooks/useMeasuredTextWidths';
import { QuarterAndMonthHeaders } from './components/QuarterAndMonthHeaders';
import { TodayLine } from './components/TodayLine';
import { GridLines } from './components/GridLines';
import { IssueMarker } from './components/IssueMarker';

/** Fallback width (px) used before the container has been measured (matches legacy default). */
const DEFAULT_WIDTH = 1230;

export interface ScatterTimelineProps {
  /** Primary issues/releases to plot. */
  primaryIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  /** All issues/releases — kept for base-prop parity; unused by the scatter report. */
  allIssuesOrReleasesObs?: CanObservable<IssueOrRelease[]>;
  /** `routeData.roundTo` — rounding strategy for due dates. */
  roundToObs: CanObservable<string>;
}

const labelOf = (issue: IssueOrRelease): string => issue.names?.shortVersion || issue.summary;

/**
 * Scatter timeline report (React). Plots each issue/release on a quarter/month grid by its
 * rolled-up due date, packing overlapping labels into stacked rows.
 *
 * All layout math is delegated to pure helpers; the only impurity — text-width measurement —
 * is isolated in {@link useMeasuredTextWidths}. Until widths are measured, no markers render
 * (rows are `[]`), mirroring the legacy "visibleWidth not ready" behavior.
 */
export const ScatterTimeline: React.FC<ScatterTimelineProps> = (props) => {
  const issues = useCanObservable(props.primaryIssuesOrReleasesObs);
  const roundTo = useCanObservable(props.roundToObs);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const measure = () => setContainerWidth(containerRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const isLotsOfIssues = shouldUseDensityOptimizations(issues.length);

  const { rangeStart, rangeEnd } = useMemo(() => computeDateRange(issues), [issues]);
  const quartersAndMonths = useMemo(() => computeQuartersAndMonths(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const gridColumnsCSS = useMemo(() => computeGridColumnCSS(quartersAndMonths.months), [quartersAndMonths.months]);
  const todayMargin = calculateTodayMargin(new Date(), quartersAndMonths.firstDay, quartersAndMonths.lastDay);

  const filteredIssues = useMemo(() => filterIssuesWithDates(issues), [issues]);
  const issueTexts = useMemo(() => filteredIssues.map(labelOf), [filteredIssues]);
  const { widthsByText, isMeasured } = useMeasuredTextWidths({ texts: issueTexts, isLotsOfIssues });

  const widthOfArea = containerWidth || DEFAULT_WIDTH;
  const { firstDay, lastDay } = quartersAndMonths;

  const plottedIssues: PlottedIssue[] = useMemo(() => {
    if (!isMeasured) return [];
    return filteredIssues.map((issue) => {
      const label = labelOf(issue);
      const textWidth = widthsByText.get(label) ?? 0;
      const positions = calculatePositionPercentages({
        roundedDueDate: roundAndShiftDueDate(issue.rollupStatuses.rollup.due as Date, roundTo),
        textWidth,
        widthOfArea,
        firstDay,
        lastDay,
      });
      return {
        key: issue.key,
        issue,
        ...positions,
        statusColorClass: getStatusColorClass(issue.rollupStatuses.rollup.status),
        textSize: isLotsOfIssues ? 'text-xs' : '',
        markerRadius: isLotsOfIssues ? 6 : 8,
      };
    });
  }, [isMeasured, filteredIssues, widthsByText, roundTo, widthOfArea, firstDay, lastDay, isLotsOfIssues]);

  const rows = useMemo(() => packIssuesIntoRows(sortIssuesByLeftPosition(plottedIssues)), [plottedIssues]);

  const monthCount = quartersAndMonths.months.length;

  return (
    <div ref={containerRef} className="p-2 mb-10" style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          width: '100%',
          gridTemplateColumns: gridColumnsCSS,
          gridTemplateRows: `auto auto repeat(${rows.length}, auto)`,
        }}
      >
        <QuarterAndMonthHeaders quarters={quartersAndMonths.quarters} months={quartersAndMonths.months} />

        <TodayLine marginLeftPercent={todayMargin} monthCount={monthCount} rowCount={rows.length} />

        <GridLines monthCount={monthCount} rowCount={rows.length} />

        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            style={{ gridColumn: `1 / span ${monthCount}`, gridRow: `${rowIdx + 3} / span 1` }}
            className={`relative ${isLotsOfIssues ? 'h-7' : 'h-10'}`}
          >
            {row.items.map((item) => (
              <IssueMarker key={item.key} item={item} labelSide={item.overflowsLeft ? 'right' : 'left'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
