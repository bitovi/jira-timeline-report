import React, { useMemo, useState } from 'react';
import type { CanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../../hooks/useCanObservable/useCanObservable';
import { computeQuartersAndMonths } from '../../../../utils/date/compute-quarters-and-months';
import {
  QuarterAndMonthHeaders,
  TodayLine,
  GridLines,
  calculateTodayMargin,
  filterIssuesKeepingUndated,
  parseISODateRangeBoundary,
} from '../../shared/timeline';
import {
  computeAxisRange,
  computeGridTemplateColumns,
  buildGanttRows,
  computeDensity,
  densityClasses,
  computeWorkTypesWithWork,
  makeGetChildren,
} from './helpers';
import { IssueRow } from './components/IssueRow';
import { GroupRow } from './components/GroupRow';
import { PercentCompleteModal } from './components/PercentCompleteModal';
import type { GroupByOption, IssueOrRelease } from './types';

/** Stable no-op observable used when `dateRangeStartObs`/`dateRangeEndObs` aren't supplied (range filter disabled). */
const NO_DATE_RANGE_OBS: CanObservable<string> = {
  value: '',
  getData: () => '',
  get: () => '',
  set: () => undefined,
  on: () => undefined,
  off: () => undefined,
};

export interface GanttGridProps {
  primaryIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  allIssuesOrReleasesObs: CanObservable<IssueOrRelease[]>;
  groupByObs: CanObservable<GroupByOption>;
  primaryIssueTypeObs: CanObservable<string>;
  roundToObs: CanObservable<string>;
  breakdownObs: CanObservable<boolean>;
  showPercentCompleteObs: CanObservable<boolean>;
  /**
   * `routeData.scatterDateRangeStart` — ISO `YYYY-MM-DD` lower bound of the due-date range
   * filter (shared with the Scatter Plot). Empty/omitted means unbounded on this side.
   */
  dateRangeStartObs?: CanObservable<string>;
  /**
   * `routeData.scatterDateRangeEnd` — ISO `YYYY-MM-DD` upper bound of the due-date range
   * filter (shared with the Scatter Plot). Empty/omitted means unbounded on this side.
   */
  dateRangeEndObs?: CanObservable<string>;
}

/**
 * The Gantt chart report (React). Renders a CSS grid of issue/group rows against a
 * quarter/month axis, mirroring `ScatterTimeline`'s container shape.
 *
 * Replaces [gantt-grid.js](src/canjs/reports/gantt-grid.js).
 */
export const GanttGrid: React.FC<GanttGridProps> = (props) => {
  const rawPrimaryIssues = useCanObservable(props.primaryIssuesOrReleasesObs);
  const allIssues = useCanObservable(props.allIssuesOrReleasesObs);
  const groupBy = useCanObservable(props.groupByObs);
  const primaryIssueType = useCanObservable(props.primaryIssueTypeObs);
  const roundTo = useCanObservable(props.roundToObs);
  const breakdown = useCanObservable(props.breakdownObs);
  const showPercentComplete = useCanObservable(props.showPercentCompleteObs);
  const dateRangeStart = useCanObservable(props.dateRangeStartObs ?? NO_DATE_RANGE_OBS);
  const dateRangeEnd = useCanObservable(props.dateRangeEndObs ?? NO_DATE_RANGE_OBS);

  const dateRangeFilter = useMemo(
    () => ({
      from: parseISODateRangeBoundary(dateRangeStart),
      to: parseISODateRangeBoundary(dateRangeEnd),
    }),
    [dateRangeStart, dateRangeEnd],
  );
  // Issues without a due date are always kept — the range only judges dated issues (mirrors
  // the Scatter Plot's "N without dates" vs. "N outside date range" distinction).
  const primaryIssues = useMemo(
    () => filterIssuesKeepingUndated(rawPrimaryIssues, dateRangeFilter),
    [rawPrimaryIssues, dateRangeFilter],
  );

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const isExpanded = (key: string) => expandedKeys.has(key);
  const toggle = (issue: IssueOrRelease) => {
    if (issue.reportingHierarchy.childKeys.length === 0) return;
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(issue.key)) {
        next.delete(issue.key);
      } else {
        next.add(issue.key);
      }
      return next;
    });
  };

  const [modalIssue, setModalIssue] = useState<IssueOrRelease | null>(null);

  const getChildren = useMemo(() => makeGetChildren(allIssues), [allIssues]);
  const { axisStart, axisEnd } = useMemo(() => computeAxisRange(primaryIssues), [primaryIssues]);
  const qam = useMemo(() => computeQuartersAndMonths(axisStart, axisEnd), [axisStart, axisEnd]);
  const isDense = computeDensity(primaryIssues.length, breakdown);
  const extraColumns = showPercentComplete ? 1 : 0;
  const gutter = 2 + extraColumns;
  const gridTemplateColumns = useMemo(
    () => computeGridTemplateColumns(qam.months, extraColumns),
    [qam.months, extraColumns],
  );
  const rows = useMemo(
    () => buildGanttRows({ primaryIssues, allIssues, groupBy, primaryIssueType, isExpanded, getChildren }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [primaryIssues, allIssues, groupBy, primaryIssueType, getChildren, expandedKeys],
  );
  const todayMargin = calculateTodayMargin(new Date(), qam.firstDay, qam.lastDay);
  const workTypesWithWork = useMemo(
    () => (breakdown ? computeWorkTypesWithWork(primaryIssues) : []),
    [breakdown, primaryIssues],
  );
  const anyExpanded = expandedKeys.size > 0;
  const monthCount = qam.months.length;
  const range = { firstDay: qam.firstDay, lastDay: qam.lastDay };
  const timelineGridColumn = `${gutter + 1} / span ${monthCount}`;
  const density = densityClasses(isDense);

  const childIssues = modalIssue ? getChildren(modalIssue) : [];

  return (
    <div className="p-2 mb-10" style={{ overflow: 'hidden' }} data-testid="gantt-grid">
      <div
        style={{
          display: 'grid',
          width: '100%',
          gridTemplateColumns,
          gridTemplateRows: `auto auto repeat(${rows.length}, auto)`,
        }}
      >
        <QuarterAndMonthHeaders quarters={qam.quarters} months={qam.months} columnOffset={gutter} />
        <TodayLine
          marginLeftPercent={todayMargin}
          monthCount={monthCount}
          rowCount={rows.length}
          columnOffset={gutter}
        />
        <GridLines monthCount={monthCount} rowCount={rows.length} columnOffset={gutter} />

        {rows.map((row, index) => {
          const gridRow = index + 3;
          if (row.type === 'group') {
            return <GroupRow key={`group-${row.issue.key}`} group={row.issue} gridRow={gridRow} />;
          }
          return (
            <IssueRow
              key={row.issue.key}
              issue={row.issue}
              depth={row.depth}
              isShowingChildren={row.isShowingChildren}
              hasChildren={row.issue.reportingHierarchy.childKeys.length > 0}
              anyExpanded={anyExpanded}
              onToggle={toggle}
              showPercentComplete={showPercentComplete}
              onPercentCompleteClick={setModalIssue}
              range={range}
              roundTo={roundTo}
              isDense={isDense}
              isBreakdown={breakdown}
              workTypesWithWork={workTypesWithWork}
              textSizeClass={density.textSize}
              expandPaddingClass={density.expandPadding}
              gridRow={gridRow}
              timelineGridColumn={timelineGridColumn}
              striped={index % 2 === 1}
            />
          );
        })}
      </div>

      {modalIssue && (
        <PercentCompleteModal
          isOpen={true}
          onClose={() => setModalIssue(null)}
          issue={modalIssue}
          childIssues={childIssues}
        />
      )}
    </div>
  );
};
