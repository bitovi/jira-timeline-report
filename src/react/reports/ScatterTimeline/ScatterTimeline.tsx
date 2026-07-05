import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueOrRelease } from './types';
import { computeQuartersAndMonths } from '../../../utils/date/compute-quarters-and-months';
import {
  computeDateRange,
  computeGridColumnCSS,
  calculateTodayMargin,
  packIssuesIntoRowsWithSides,
  shouldUseDensityOptimizations,
  partitionIssuesByDate,
  computePlottedIssues,
  computeOccupiedDateExtent,
  groupIssues,
  filterIssuesByDateRange,
  parseISODateRangeBoundary,
} from './helpers';
import type { GroupByOption } from './helpers';
import { useMeasuredTextWidths } from './hooks/useMeasuredTextWidths';
import { QuarterAndMonthHeaders } from './components/QuarterAndMonthHeaders';
import { TodayLine } from './components/TodayLine';
import { GridLines } from './components/GridLines';
import { GroupBand } from './components/GroupBand';
import { NoDatesKey } from './components/NoDatesKey';
import { DateRangeKey } from './components/DateRangeKey';
import { StatusLegend } from './components/StatusLegend';

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

/** Stable no-op observable used when `dateRangeStartObs`/`dateRangeEndObs` aren't supplied (range filter disabled). */
const NO_DATE_RANGE_OBS: CanObservable<string> = {
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
  /**
   * `routeData.scatterDateRangeStart` — ISO `YYYY-MM-DD` lower bound of the due-date range
   * filter. Empty/omitted means unbounded on this side.
   */
  dateRangeStartObs?: CanObservable<string>;
  /**
   * `routeData.scatterDateRangeEnd` — ISO `YYYY-MM-DD` upper bound of the due-date range
   * filter. Empty/omitted means unbounded on this side.
   */
  dateRangeEndObs?: CanObservable<string>;
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
  const dateRangeStart = useCanObservable(props.dateRangeStartObs ?? NO_DATE_RANGE_OBS);
  const dateRangeEnd = useCanObservable(props.dateRangeEndObs ?? NO_DATE_RANGE_OBS);

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

  const { dated: datedIssues, undated: undatedIssues } = useMemo(() => partitionIssuesByDate(issues), [issues]);

  const dateRangeFilter = useMemo(
    () => ({
      from: parseISODateRangeBoundary(dateRangeStart),
      to: parseISODateRangeBoundary(dateRangeEnd),
    }),
    [dateRangeStart, dateRangeEnd],
  );

  // A range is "active" once either side is populated, even if the other side is
  // open-ended — this drives the key/count-hint visibility rule (spec §4.1, Questions #8).
  const hasDateRange = dateRangeStart !== '' || dateRangeEnd !== '';

  const { insideRange: filteredIssues, outsideRange: outsideRangeIssues } = useMemo(
    () => filterIssuesByDateRange(datedIssues, dateRangeFilter),
    [datedIssues, dateRangeFilter],
  );

  // The bounded window can exclude every dated issue — show a friendly empty state instead of
  // an empty-looking chart (spec §5 Step 6).
  const showEmptyRangeState = hasDateRange && datedIssues.length > 0 && filteredIssues.length === 0;

  // When a range is active, clamp the visible axis to the user's chosen boundary on each bounded
  // side (open sides still auto-fit to content). This makes e.g. "This quarter" actually zoom to
  // that quarter instead of auto-fitting to the surviving content — whose wide labels would
  // otherwise spill into, and snap up, neighboring quarters (spec §4.4 clamp variant).
  const contentRange = useMemo(() => computeDateRange(filteredIssues), [filteredIssues]);
  const rangeStart = dateRangeFilter.from ?? contentRange.rangeStart;
  const rangeEnd = dateRangeFilter.to ?? contentRange.rangeEnd;
  const initialQuartersAndMonths = useMemo(
    () => computeQuartersAndMonths(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const issueTexts = useMemo(() => filteredIssues.map(labelOf), [filteredIssues]);
  const { widthsByText, isMeasured } = useMeasuredTextWidths({ texts: issueTexts, isLotsOfIssues });

  // Percentages are relative to the month-columns' physical width, not the whole container —
  // when a gutter column is showing, subtract it so text-width-to-percent conversion (and thus
  // row-packing collision detection) matches the actual space markers render into.
  const widthOfArea = (containerWidth || DEFAULT_WIDTH) - (showGutter ? GUTTER_WIDTH_PX : 0);

  // Position + pack into rows for a given range. Choosing each label's side (left/right of its
  // date-anchored marker) both minimizes rows and pulls edge labels inward. Runs twice: pass 1
  // against the padded range to find the real content extent, pass 2 against the trimmed range.
  const layoutBands = (firstDay: Date, lastDay: Date) => {
    const plotted = computePlottedIssues(filteredIssues, {
      widthsByText,
      roundTo,
      widthOfArea,
      firstDay,
      lastDay,
      isLotsOfIssues,
    });
    const groups = groupIssues(plotted, allIssuesForGrouping, groupBy, (p) => p.issue);
    return groups.map((group) => ({ ...group, rows: packIssuesIntoRowsWithSides(group.issues) }));
  };

  // Pass 1: discover the horizontal extent actually occupied by content.
  const pass1Bands = useMemo(
    () => (isMeasured ? layoutBands(initialQuartersAndMonths.firstDay, initialQuartersAndMonths.lastDay) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isMeasured,
      filteredIssues,
      widthsByText,
      roundTo,
      widthOfArea,
      isLotsOfIssues,
      initialQuartersAndMonths,
      allIssuesForGrouping,
      groupBy,
    ],
  );

  // Trim leading/trailing empty quarters by re-snapping the range to that content extent.
  // Skipped while a range is active: the axis is already pinned to the user's window, and
  // re-snapping to the label-inclusive content extent would spill wide labels back out into
  // adjacent quarters — the very over-extension the clamp exists to prevent.
  const quartersAndMonths = useMemo(() => {
    if (hasDateRange) {
      return initialQuartersAndMonths;
    }
    const extent = computeOccupiedDateExtent(
      pass1Bands,
      initialQuartersAndMonths.firstDay,
      initialQuartersAndMonths.lastDay,
    );
    return extent ? computeQuartersAndMonths(extent.start, extent.end) : initialQuartersAndMonths;
  }, [hasDateRange, pass1Bands, initialQuartersAndMonths]);

  const { firstDay, lastDay } = quartersAndMonths;

  // Pass 2 (final): re-position + re-pack against the trimmed range.
  const bands = useMemo(
    () => (isMeasured ? layoutBands(firstDay, lastDay) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isMeasured,
      filteredIssues,
      widthsByText,
      roundTo,
      widthOfArea,
      isLotsOfIssues,
      firstDay,
      lastDay,
      allIssuesForGrouping,
      groupBy,
    ],
  );

  const gridColumnsCSS = useMemo(() => computeGridColumnCSS(quartersAndMonths.months), [quartersAndMonths.months]);
  const todayMargin = calculateTodayMargin(new Date(), quartersAndMonths.firstDay, quartersAndMonths.lastDay);

  const totalRowCount = bands.reduce((sum, band) => sum + band.rows.length, 0);
  const monthCount = quartersAndMonths.months.length;
  const gridTemplateColumns = showGutter ? `${GUTTER_WIDTH_PX}px ${gridColumnsCSS}` : gridColumnsCSS;

  return (
    <div ref={containerRef} className="p-2 mb-10" style={{ overflow: 'hidden' }}>
      {showEmptyRangeState ? (
        <div className="flex items-center justify-center text-center text-neutral-500 text-sm py-16 border border-dashed border-neutral-80 rounded">
          No issues are due in the selected date range.
        </div>
      ) : (
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
      )}
      {(filteredIssues.length > 0 || undatedIssues.length > 0 || hasDateRange) && (
        <div className="mt-2 pt-2 border-t border-neutral-80 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <StatusLegend issues={filteredIssues} />
            {hasDateRange && (
              <span className="text-xs text-neutral-500">
                Showing {filteredIssues.length} of {datedIssues.length}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <NoDatesKey issues={undatedIssues} />
            <DateRangeKey issues={outsideRangeIssues} hasDateRange={hasDateRange} />
          </div>
        </div>
      )}
    </div>
  );
};
