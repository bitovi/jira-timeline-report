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
  groupIssues,
} from './helpers';
import type { GroupByOption } from './helpers';
import { useMeasuredTextWidths } from './hooks/useMeasuredTextWidths';
import { QuarterAndMonthHeaders } from './components/QuarterAndMonthHeaders';
import { TodayLine } from './components/TodayLine';
import { GridLines } from './components/GridLines';
import { GroupBand } from './components/GroupBand';

/** Fallback width (px) used before the container has been measured (matches legacy default). */
const DEFAULT_WIDTH = 1230;

/** Stable no-op observable used when `groupByObs` isn't supplied (grouping disabled). */
const NO_GROUP_BY_OBS: CanObservable<string> = {
  value: '',
  getData: () => '',
  get: () => '',
  set: () => undefined,
  on: () => undefined,
  off: () => undefined,
};

/** Fixed width (px) of the group-label gutter column, shown when grouping is active. */
const GUTTER_WIDTH_PX = 160;

export interface ScatterTimelineProps {
  /** Primary issues/releases to plot. */
  primaryIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  /**
   * All issues/releases — used to look up a parent's summary/rank when grouping by `'parent'`
   * (the primary issues only carry their own `parentKey`). Falls back to
   * `primaryIssuesOrReleasesObs` when omitted.
   */
  allIssuesOrReleasesObs?: CanObservable<IssueOrRelease[]>;
  /** `routeData.roundTo` — rounding strategy for due dates. */
  roundToObs: CanObservable<string>;
  /** `routeData.groupBy` — band the plotted issues by parent/team/project. Defaults to `''` (no grouping). */
  groupByObs?: CanObservable<string>;
}

const labelOf = (issue: IssueOrRelease): string => issue.names?.shortVersion || issue.summary;

/**
 * Scatter timeline report (React). Plots each issue/release on a quarter/month grid by its
 * rolled-up due date, packing overlapping labels into stacked rows.
 *
 * All layout math is delegated to pure helpers; the only impurity — text-width measurement —
 * is isolated in {@link useMeasuredTextWidths}. Until widths are measured, no markers render
 * (rows are `[]`), mirroring the legacy "visibleWidth not ready" behavior.
 *
 * When `groupByObs` resolves to a non-empty value, issues are partitioned into labeled bands
 * (see {@link groupIssues}) that each pack their own rows independently while sharing the same
 * quarter/month x-axis.
 */
export const ScatterTimeline: React.FC<ScatterTimelineProps> = (props) => {
  const issues = useCanObservable(props.primaryIssuesOrReleasesObs);
  const roundTo = useCanObservable(props.roundToObs);
  const allIssuesForGrouping = useCanObservable(props.allIssuesOrReleasesObs ?? props.primaryIssuesOrReleasesObs);
  const groupBy = useCanObservable(props.groupByObs ?? NO_GROUP_BY_OBS) as GroupByOption;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const measure = () => setContainerWidth(containerRef.current?.offsetWidth ?? 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const isLotsOfIssues = shouldUseDensityOptimizations(issues.length);
  const showGutter = groupBy !== '';

  const { rangeStart, rangeEnd } = useMemo(() => computeDateRange(issues), [issues]);
  const quartersAndMonths = useMemo(() => computeQuartersAndMonths(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const gridColumnsCSS = useMemo(() => computeGridColumnCSS(quartersAndMonths.months), [quartersAndMonths.months]);
  const todayMargin = calculateTodayMargin(new Date(), quartersAndMonths.firstDay, quartersAndMonths.lastDay);

  const filteredIssues = useMemo(() => filterIssuesWithDates(issues), [issues]);
  const issueTexts = useMemo(() => filteredIssues.map(labelOf), [filteredIssues]);
  const { widthsByText, isMeasured } = useMeasuredTextWidths({ texts: issueTexts, isLotsOfIssues });

  // Percentages are relative to the month-columns' physical width, not the whole container —
  // when a gutter column is showing, subtract it so text-width-to-percent conversion (and thus
  // row-packing collision detection) matches the actual space markers render into.
  const widthOfArea = (containerWidth || DEFAULT_WIDTH) - (showGutter ? GUTTER_WIDTH_PX : 0);
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

  const groups = useMemo(
    () => groupIssues(plottedIssues, allIssuesForGrouping, groupBy, (plotted) => plotted.issue),
    [plottedIssues, allIssuesForGrouping, groupBy],
  );

  const bands = useMemo(
    () => groups.map((group) => ({ ...group, rows: packIssuesIntoRows(sortIssuesByLeftPosition(group.issues)) })),
    [groups],
  );

  const totalRowCount = bands.reduce((sum, band) => sum + band.rows.length, 0);
  const monthCount = quartersAndMonths.months.length;
  const gridTemplateColumns = showGutter ? `${GUTTER_WIDTH_PX}px ${gridColumnsCSS}` : gridColumnsCSS;

  return (
    <div ref={containerRef} className="p-2 mb-10" style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          width: '100%',
          gridTemplateColumns,
          gridTemplateRows: `auto auto repeat(${totalRowCount}, auto)`,
        }}
      >
        <QuarterAndMonthHeaders
          quarters={quartersAndMonths.quarters}
          months={quartersAndMonths.months}
          columnOffset={showGutter ? 1 : 0}
        />

        <TodayLine
          marginLeftPercent={todayMargin}
          monthCount={monthCount}
          rowCount={totalRowCount}
          columnOffset={showGutter ? 1 : 0}
        />

        <GridLines monthCount={monthCount} rowCount={totalRowCount} columnOffset={showGutter ? 1 : 0} />

        {
          bands.reduce<{ elements: React.ReactNode[]; rowOffset: number }>(
            (acc, band, bandIndex) => {
              acc.elements.push(
                <GroupBand
                  key={band.key}
                  title={band.title}
                  rows={band.rows}
                  monthCount={monthCount}
                  rowOffset={acc.rowOffset}
                  showGutter={showGutter}
                  bandIndex={bandIndex}
                  isLotsOfIssues={isLotsOfIssues}
                />,
              );
              acc.rowOffset += band.rows.length;
              return acc;
            },
            { elements: [], rowOffset: 0 },
          ).elements
        }
      </div>
    </div>
  );
};
