import type {
  SimulationData,
  StatsUIData,
  SimulationIssueResult,
  MinimalSimulationIssueResult,
} from './scheduler/stats-analyzer';
import type { LogSpread } from './scheduler/log-spread';
import type { DerivedIssue } from '../../../jira/derived/derive';
import type { CriticalPathSelection } from './CriticalPathRail';

import React, { FC, Suspense, useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@sentry/react';
import { FlagsProvider } from '@atlaskit/flag';
import Tooltip from '@atlaskit/tooltip';
import SectionMessage from '@atlaskit/section-message';
import Link from '@atlaskit/link';
import { IssueSimulationRow } from './IssueSimulationRow';
import UpdateModal from './components/UpdateModal/UpdateModal';
import { StatsAnalyzer } from './scheduler/stats-analyzer';
import { BlocksCycleError, canFreeze } from './scheduler/link-issues';
import { useFrozenIssues } from './hooks/useFrozenIssues';
import { CanObservable } from '../../hooks/useCanObservable/useCanObservable.js';
import { useCanObservable } from '../../hooks/useCanObservable';
import { useUncertaintyWeight } from '../../hooks/useUncertaintyWeight/useUncertaintyWeight.js';
import { useSelectedStartDate } from '../../hooks/useSelectedStartDate/useSelectedStartDate.js';
import { JiraProvider } from '../../services/jira/JiraProvider';
import { queryClient } from '../../services/query/queryClient';
import { bestFitRanges } from '../../../utils/date/best-fit-ranges';
import routeData from '../../../canjs/routing/route-data/index';
import { getUTCEndDateFromStartDateAndBusinessDays } from '../../../utils/date/business-days.js';
import { businessDayOffsetToDate } from './scheduler/business-day-offset';
import {
  buildCriticalPathEpics,
  CriticalPathEpicsTable,
  CriticalPathRail,
  CriticalPathRoutesTable,
  highlightKeysForSelection,
  summariseFloor,
} from './CriticalPathRail';
import { makeInsertBlockers } from './svg-blockers';
import { roundTo } from '../../../utils/number/number';
import { gridLayer } from './z-layers';
import { IssueSummaryLabel } from './IssueSummaryLabel';
import { TruncatedText } from './TruncatedText';
import { StorageProvider } from '../../services/storage';
import { TeamCapacityInputs, TeamCapacityOutputs, useTeamIsDirty } from './components/TeamCapacityControls';

type RolledUpIssue = DerivedIssue & {
  completionRollup: { totalWorkingDays: number };
};

type ObservableOfIssues = CanObservable<Array<RolledUpIssue>>;
// `gridUIData` returns null when there are no time ranges to build a grid from; the report
// early-returns a message in that case, so everything downstream only ever sees the real grid.
export type GridUIData = NonNullable<ReturnType<typeof gridUIData>>;

interface AutoSchedulerProps {
  primaryIssuesOrReleasesObs: CanObservable<Array<RolledUpIssue>>;
  allIssuesOrReleasesObs: ObservableOfIssues;
}

/**
 * The timeline never compresses below this, however narrow the report gets — past it the grid
 * scrolls horizontally instead. A total rather than a per-column minimum: a per-column floor would
 * force a 120-day plan to scroll on a screen that fits it today.
 */
const MIN_TIMELINE_WIDTH = 480;

// The quartile range is quoted empirically rather than as `median ×÷ gsd`, which would assert a
// lognormal shape the plan finish (a maximum over competing chains) does not have.
const PlanSpreadSummary: FC<{ spread: LogSpread }> = ({ spread }) => {
  const gsd = roundTo(spread.gsd, 2);
  // Dotted underline is the `<abbr>` convention for "this term has a definition", and `tabIndex`
  // makes the tooltip reachable by keyboard — Atlaskit only opens on focus for focusable children.
  const hint = 'underline decoration-dotted underline-offset-2 cursor-help';
  return (
    <>
      <Tooltip content="The same spread expressed on the 0–100 scale used for per-issue confidence.">
        <div className={`text-neutral-500 ${hint}`} tabIndex={0}>
          Confidence: {roundTo(spread.confidence, 0)}%
        </div>
      </Tooltip>
      <Tooltip
        content={
          <div className="grid gap-1">
            <div className="font-semibold">Geometric standard deviation</div>
            <div>
              The multiplicative spread of simulated finish dates — ×÷ {gsd} around the median, the multiplicative
              analogue of ±.
            </div>
            <div>
              The middle 50% of runs finish in {Math.round(spread.q25)}–{Math.round(spread.q75)} working days.
            </div>
          </div>
        }
      >
        <div className={hint} tabIndex={0}>
          GSD {gsd}
        </div>
      </Tooltip>
    </>
  );
};

const BlocksCycleMessage: FC<{ cycle: BlocksCycleError['cycle'] }> = ({ cycle }) => (
  <div className="p-4">
    <SectionMessage title="This plan can't be simulated" appearance="error">
      <p>
        Each issue below <code>Blocks</code> the next, and the last blocks the first again — a cycle with no
        well-defined schedule. Fix any one of these links in Jira, then reload.
      </p>
      {/* `cycle`'s last entry repeats the first, so the numbered list visibly loops back to where it
          started instead of just trailing off. */}
      <ol className="list-decimal pl-5">
        {cycle.map((issue, i) => (
          <li key={i}>
            <Link href={issue.url} target="_blank">
              {issue.key}
            </Link>{' '}
            — {issue.summary}
          </li>
        ))}
      </ol>
    </SectionMessage>
  </div>
);

const EmptyTimeRangeMessage: FC = () => (
  <div className="p-4">
    <SectionMessage title="There's no timeline to show" appearance="warning">
      <p>
        The report couldn't work out a range of days to lay this plan across. That usually means the selected start date
        leaves the plan no working days to span — a start date on a weekend with everything finishing immediately — or
        that a team's sprint length or capacity is blank or non-numeric, which leaves the schedule without a usable end
        date.
      </p>
    </SectionMessage>
  </div>
);

const AutoScheduler: FC<AutoSchedulerProps> = ({ primaryIssuesOrReleasesObs, allIssuesOrReleasesObs }) => {
  const primaryRaw = useCanObservable(primaryIssuesOrReleasesObs);
  const allIssues = useCanObservable(allIssuesOrReleasesObs);

  // `primaryIssuesOrReleases` re-emits a NEW array on every URL change — including moving the
  // uncertainty slider — even though the issue objects inside are unchanged. (Empty JSON URL params
  // such as `filterRows` resolve a fresh reference on each `pushState`; `primaryIssuesOrReleases`
  // reads them while filtering, so its `.filter()` produces a new array of the same items.) Without
  // this guard the `[primary]` effect below tears down and re-runs the whole Monte-Carlo simulation
  // on every slider tick. Keep the previous reference while the set of issue objects is identical so
  // the simulation is reused and only the percentile selection updates; a genuine data change (rollup
  // recompute) yields new issue objects and correctly restarts the run.
  const primaryRef = useRef(primaryRaw);
  if (
    primaryRef.current !== primaryRaw &&
    (primaryRef.current.length !== primaryRaw.length || primaryRef.current.some((issue, i) => issue !== primaryRaw[i]))
  ) {
    primaryRef.current = primaryRaw;
  }
  const primary = primaryRef.current;

  const [selectedStartDate] = useSelectedStartDate();
  const [uncertaintyWeight] = useUncertaintyWeight();
  const [frozenIssues, setFrozenIssues] = useFrozenIssues();

  // The frozen keys that actually apply to this data. Keys for issues that aren't loaded (or have no
  // Jira dates) stay in the URL but don't restart the simulation.
  const frozenSignature = useMemo(
    () =>
      primary
        .filter((issue) => frozenIssues.has(issue.key) && canFreeze(issue))
        .map((issue) => issue.key)
        .sort()
        .join(','),
    [primary, frozenIssues],
  );
  // Frozen items' day offsets are relative to the start date, so it only restarts the run while
  // something is frozen; otherwise it only changes how results are drawn.
  const frozenStartTime = frozenSignature ? selectedStartDate.getTime() : null;

  const toggleFrozen = useCallback(
    (keys: string[], frozen: boolean) => {
      const next = new Set(frozenIssues);
      for (const key of keys) {
        if (frozen) next.add(key);
        else next.delete(key);
      }
      setFrozenIssues(next);
    },
    [frozenIssues, setFrozenIssues],
  );
  const onToggleFreeze = useCallback((key: string, frozen: boolean) => toggleFrozen([key], frozen), [toggleFrozen]);

  // `workItemsToHighlight` is derived below (from `selection` and `routes`), not stored, so it can
  // never go stale relative to the live simulation data.
  const [selection, setSelection] = useState<CriticalPathSelection>(null);
  // While the overall-timing histograms are open the grid reaches back to the earliest run's start,
  // so the early-start tail is drawn rather than cut off at the left edge.
  const [overallTimingOpen, setOverallTimingOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  // stuff to get the monte-carlo data going
  const statsAnalyzerRef = useRef<StatsAnalyzer>();
  const [uiData, setUIData] = useState<StatsUIData | null>(null);
  const [cycleError, setCycleError] = useState<BlocksCycleError | null>(null);
  useEffect(() => {
    setCycleError(null);
    // A selection describes "what am I looking at" for the *previous* dataset — carrying it over
    // would keep filtering the Gantt to issue keys that may not exist in the new one, silently
    // emptying the report instead of showing the new plan.
    setSelection(null);
    let statsAnalyzer: StatsAnalyzer;
    try {
      statsAnalyzer = new StatsAnalyzer({
        issues: primary,
        uncertaintyWeight: uncertaintyWeight,
        frozenKeys: new Set(frozenSignature ? frozenSignature.split(',') : []),
        startDate: selectedStartDate,
        setUIState: (newUIData) => {
          setUIData(newUIData);
        },
      });
    } catch (error) {
      // A contradictory `Blocks` graph can't be simulated at all; surface it instead of leaving the
      // report stuck on "Starting ...." forever with no `uiData` ever arriving.
      if (error instanceof BlocksCycleError) {
        setCycleError(error);
        return;
      }
      throw error;
    }
    statsAnalyzerRef.current = statsAnalyzer;

    return () => {
      statsAnalyzer.teardown();
    };
  }, [primary, frozenSignature, frozenStartTime]);

  useEffect(() => {
    const statsAnalyzer = statsAnalyzerRef.current;
    if (!statsAnalyzer) return;
    statsAnalyzer.updateUncertaintyWeight(uncertaintyWeight);
  }, [uncertaintyWeight]);

  // stuff to draw the blockers right
  const svgRef = useRef<SVGSVGElement>(null);
  const uiDataRef = useRef(uiData);
  uiDataRef.current = uiData;
  const updateBlockers = useCallback(
    makeInsertBlockers(() => uiDataRef.current),
    [uiData?.percentComplete === 100],
  );
  useEffect(updateBlockers, [uiData?.percentComplete === 100, uiData]);

  useEffect(() => {
    // Dragging the rail divider resizes the grid on every `pointermove`, and each redraw rebuilds
    // every SVG path after a `querySelectorAll`. Coalesce to one redraw per frame.
    let frame = 0;
    const scheduleRedraw = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateBlockers();
      });
    };

    const observer = new ResizeObserver(scheduleRedraw);
    const container = svgRef.current;
    if (container) observer.observe(container);

    window.addEventListener('resize', scheduleRedraw);
    updateBlockers(); // initial draw

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleRedraw);
    };
  }, [updateBlockers]);

  // Every route, not the top five: an epic can sit on a rarely-winning route and would otherwise
  // highlight only itself while still reporting a non-zero share.
  // `topPaths` sorts the whole distinct-path map, so only pay for it while the rail is open, or a
  // selection needs it to keep highlighting after the rail closes — `uiData` gets a new reference
  // on every simulation batch (up to hundreds per run).
  const routes = useMemo(
    () => (railOpen || selection ? (uiData?.criticalPath?.topPaths(Number.POSITIVE_INFINITY) ?? []) : []),
    [uiData, railOpen, selection],
  );
  // Recomputed from the current `routes` on every render, so a still-converging simulation can't
  // leave this highlighting a route/epic set that a later batch has already superseded.
  const workItemsToHighlight = useMemo(() => highlightKeysForSelection(selection, routes), [selection, routes]);
  const epicRows = useMemo(() => (railOpen && uiData ? buildCriticalPathEpics(uiData) : []), [uiData, railOpen]);
  // Routes carry keys only, so readable labels have to come back from the simulation results.
  const routeLabel = useMemo(() => {
    const summaryByKey = new Map(
      (uiData?.simulationIssueResults ?? []).map((result) => [result.linkedIssue.key, result.linkedIssue.summary]),
    );
    return (keys: string[]) => keys.map((key) => summaryByKey.get(key) ?? key).join(' → ');
  }, [uiData]);

  const applySelection = useCallback((next: CriticalPathSelection) => {
    setSelection(next);
  }, []);
  const onSelectEpic = useCallback(
    (key: string) => applySelection(selection?.kind === 'epic' && selection.key === key ? null : { kind: 'epic', key }),
    [applySelection, selection],
  );
  const onSelectRoute = useCallback(
    (id: string) => applySelection(selection?.kind === 'route' && selection.id === id ? null : { kind: 'route', id }),
    [applySelection, selection],
  );

  if (!allIssues?.length) {
    return <div>Loading ...</div>;
  }

  if (cycleError) {
    return <BlocksCycleMessage cycle={cycleError.cycle} />;
  }

  if (!uiData) {
    return <div>Starting ....</div>;
  }

  // converts the stats into data for a grid
  const gridData = gridUIData(uiData, selectedStartDate, workItemsToHighlight, overallTimingOpen);

  if (!gridData) {
    return <EmptyTimeRangeMessage />;
  }

  // Plan-level estimate for the Summary row. Mirrors the slider exactly: a single value for
  // median/average, a range for a percentile band. `dueDay*` are business-day counts.
  const planResult = uiData.endDaySimulationResult;
  const planBottomDays = Math.round(planResult.dueDayBottom);
  const planTopDays = Math.round(planResult.dueDayTop);
  let planEstimateText: string;
  if (uncertaintyWeight === 'average') {
    planEstimateText = `${planTopDays} working days · average`;
  } else if (uncertaintyWeight === 50) {
    planEstimateText = `${planTopDays} working days · median`;
  } else if (planBottomDays === planTopDays) {
    planEstimateText = `${planTopDays} working days`;
  } else {
    planEstimateText = `${planBottomDays}–${planTopDays} working days`;
  }

  const floor = summariseFloor({
    meanPathLength: uiData.criticalPath.meanLength,
    meanPlanFinishDays: uiData.meanPlanFinishDays,
  });

  return (
    // The shell hands this report the viewport's leftover height (`REPORT_TYPES_FILLING_HEIGHT`), so
    // the grid and the rail each scroll themselves rather than scrolling the page. Padding comes
    // from the shell's `#react-report-container` gutter — the report carries none of its own, so an
    // embedded copy in a Report of Reports isn't double-indented.
    <div className="relative flex min-h-0 flex-1 flex-col print:block">
      {/* Progress Bar */}
      <div
        className={` h-1 shrink-0 bg-blue-300 transition-opacity duration-500 ${
          uiData.percentComplete === 100 ? 'opacity-0' : ''
        }`}
        style={{ width: `${uiData.percentComplete}%`, top: '' }}
      >
        &nbsp;
      </div>

      <UpdateModal startDate={selectedStartDate} issues={uiData} />

      {/* The frame lives here, not on the grid, so the grid and the rail read as one panel. */}
      <div className="flex min-h-0 flex-1 items-stretch overflow-hidden rounded border border-neutral-30 bg-white shadow-sm print:block print:overflow-visible">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Simulation Grid */}
          <div
            className="auto-scheduler-grid group/report grid min-h-0 flex-1 overflow-auto bg-white relative"
            style={{
              // `fit-content(40%)`: the labels size to their content but never take more than 40% of
              // the grid, so the bars stop losing every pixel a panel takes. The day columns carry a
              // minimum that adds up to `MIN_TIMELINE_WIDTH` whatever the plan's length — below that
              // the grid scrolls, which is what the pinned label column below keeps readable.
              gridTemplateColumns: `[what] fit-content(40%) repeat(${gridData.gridNumberOfDays}, minmax(${roundTo(
                MIN_TIMELINE_WIDTH / gridData.gridNumberOfDays,
                2,
              )}px, 1fr))`,
              gridTemplateRows: 'auto',
              // Load-bearing: this is a `flex-1` box with a definite height, so the default
              // stretching align-content inflates every auto row to fill it whenever the rows are
              // shorter than the viewport — which is what a critical-path filter produces.
              alignContent: 'start',
            }}
          >
            {/* Background SVG Layer */}
            <div
              className="relative"
              style={{
                zIndex: gridLayer.dependencies,
                gridColumn: `2 / span ${gridData.gridNumberOfDays}`,
                gridRow: `2 / span ${gridData.rowsCount - 1}`,
              }}
              id="dependencies"
            >
              <svg
                ref={svgRef}
                xmlns="http://www.w3.org/2000/svg"
                className="absolute"
                width="100%"
                height="100%"
                preserveAspectRatio="none"
              />
            </div>

            {/* Placeholder for row height. Pinned on both axes so the date scale slides under the
                label column rather than over it when the grid is scrolled sideways. */}
            <div
              className="text-xs sticky left-0 top-0 bg-white"
              style={{ zIndex: gridLayer.gridCorner, gridRow: '1 / span 1', gridColumn: '1 / span 1' }}
            >
              &nbsp;
            </div>

            {/* Row bands, like Jira Plans: every other epic in a track. Before the month lines so they
                paint underneath them. */}
            {gridData.gridifiedTeams.flatMap((team) =>
              team.gridifiedTracks.flatMap((track) =>
                track.issues.map((issue, issueIdx) =>
                  isStripedRow(issueIdx) ? (
                    <div
                      key={'band-' + issue.linkedIssue.key}
                      data-testid="row-band"
                      className="bg-neutral-20"
                      style={{
                        gridRow: `${track.style.gridRowStart + issueIdx + 1} / span 1`,
                        gridColumn: `1 / span ${gridData.gridNumberOfDays + 1}`,
                      }}
                    />
                  ) : null,
                ),
              ),
            )}

            {gridData.timeRanges.map((range, i) => {
              return (
                <div
                  key={'time' + i}
                  style={{
                    zIndex: gridLayer.dateHeader,
                    gridRow: `1 / span 1`,
                    gridColumn: `${1 + range.startDay} / span ${range.days}`,
                  }}
                  className="border-neutral-30 border-solid border-x px-1 text-xs truncate sticky top-0 bg-white"
                >
                  {range.prettyStart}
                </div>
              );
            })}
            {gridData.timeRanges.map((range, i) => {
              return (
                <div
                  key={'time' + i}
                  style={{
                    gridRow: `2 / span ${gridData.rowsCount - 1}`,
                    gridColumn: `${1 + range.startDay} / span ${range.days}`,
                  }}
                  className="border-neutral-30 border-solid border-x px-1"
                ></div>
              );
            })}

            {/* Only when work is drawn before the start date: a dashed line marks where the plan was
                meant to begin, so the bars left of it read as "has to start earlier than planned". */}
            {/* Two pieces so the line can sit above the date labels but below the pinned label
                column, which the body rows scroll under. */}
            {gridData.gridStartDay < 0 && (
              <>
                <div
                  title="Start date"
                  className="pointer-events-none sticky top-0 border-l-2 border-dashed border-orange-400"
                  style={{
                    zIndex: gridLayer.dateHeader + 1,
                    gridRow: '1 / span 1',
                    gridColumn: `${2 - gridData.gridStartDay} / span 1`,
                  }}
                />
                <div
                  data-testid="start-date-line"
                  className="pointer-events-none border-l-2 border-dashed border-orange-400"
                  style={{
                    zIndex: gridLayer.startDateLine,
                    gridRow: `2 / span ${gridData.rowsCount - 1}`,
                    gridColumn: `${2 - gridData.gridStartDay} / span 1`,
                  }}
                />
              </>
            )}

            <div
              className="bg-neutral-20 pt-2 pb-1 "
              style={{
                gridRow: `2 / span 1`,
                gridColumn: `1 / span ${gridData.gridNumberOfDays + 1}`,
              }}
            />
            <div
              className="bg-neutral-20 pt-2 pb-1 "
              style={{
                gridRow: `2 / span 1`,
                gridColumn: `1 / span ${gridData.gridNumberOfDays + 1}`,
              }}
            />

            <div
              className="pl-2 pt-2 pb-1 pr-1 flex sticky left-0 bg-neutral-20"
              style={{ zIndex: gridLayer.labelColumn, gridRow: 2, gridColumnStart: 'what' }}
            >
              <div className="text-base grow font-semibold">Summary</div>
            </div>

            {/* Lifted above the `#dependencies` SVG, which covers row 2 and would otherwise swallow
            the hover that opens the spread tooltips. */}
            <div
              className="pl-2 pt-3 pb-1 pr-5 text-xs flex flex-wrap flex-row-reverse justify-start gap-x-2 gap-y-1 relative"
              style={{
                zIndex: gridLayer.row,
                gridRow: `2 / span 1`,
                gridColumn: `2 / span ${gridData.gridNumberOfDays}`,
              }}
            >
              {uiData.planSpread && <PlanSpreadSummary spread={uiData.planSpread} />}
              <div>{planEstimateText}</div>
            </div>

            <IssueSimulationRow
              issue={uiData.endDaySimulationResult}
              gridRowStart={3}
              gridData={gridData}
              selectedStartDate={selectedStartDate}
              uncertaintyWeight={uncertaintyWeight}
              planStart={uiData.planStart}
              detailsOpen={overallTimingOpen}
              onDetailsOpenChange={setOverallTimingOpen}
            />

            {/* Team Tracks */}
            {gridData.gridifiedTeams.map((team, teamIdx) => (
              <React.Fragment key={`team-${teamIdx}`}>
                {/* Only show team if it has visible tracks/issues */}
                {team.gridifiedTracks.length > 0 && (
                  <>
                    <TeamHeaderRow
                      team={team}
                      gridNumberOfDays={gridData.gridNumberOfDays}
                      frozenIssues={frozenIssues}
                      onToggleFrozen={toggleFrozen}
                    />

                    {team.gridifiedTracks.map(
                      (gridifiedTrack, trackIdx) =>
                        gridifiedTrack.issues.length > 0 && (
                          <React.Fragment key={`track-${teamIdx}-${trackIdx}`}>
                            <div
                              className="pl-4 flex pt-0.5 pr-1 sticky left-0 bg-white"
                              style={{
                                zIndex: gridLayer.labelColumn,
                                gridRow: `${gridifiedTrack.style.gridRowStart} / span 1`,
                                gridColumnStart: 'what',
                              }}
                            >
                              <div className="text-xs grow">
                                Track {trackIdx + 1}
                                {gridifiedTrack.issues[0].isOverflowTrack ? ' (over capacity)' : ''}
                              </div>
                            </div>

                            {gridifiedTrack.issues.map((issue, issueIdx) => (
                              <IssueSimulationRow
                                key={`issue-${teamIdx}-${trackIdx}-${issueIdx}`}
                                issue={issue}
                                gridRowStart={gridifiedTrack.style.gridRowStart + issueIdx + 1}
                                gridData={gridData}
                                selectedStartDate={selectedStartDate}
                                uncertaintyWeight={uncertaintyWeight}
                                isFrozen={frozenIssues.has(issue.linkedIssue.key)}
                                onToggleFreeze={onToggleFreeze}
                                striped={isStripedRow(issueIdx)}
                              />
                            ))}
                          </React.Fragment>
                        ),
                    )}
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Routes first: the panel leads with the critical path, so the first thing under the
            heading must be critical paths. */}
        <CriticalPathRail floor={floor} open={railOpen} onOpenChange={setRailOpen}>
          <CriticalPathRoutesTable
            routes={routes}
            iterations={uiData.criticalPath.iterations}
            labelFor={routeLabel}
            selection={selection}
            onSelectRoute={onSelectRoute}
            disabled={uiData.percentComplete !== 100}
          />
          <CriticalPathEpicsTable
            rows={epicRows}
            routes={routes}
            selection={selection}
            onSelectEpic={onSelectEpic}
            disabled={uiData.percentComplete !== 100}
          />
        </CriticalPathRail>
      </div>
    </div>
  );
};

export default function AutoSchedulerWrapper(props: AutoSchedulerProps) {
  return (
    <FlagsProvider>
      <JiraProvider jira={routeData.jiraHelpers}>
        {/* `useTeamCommit` reaches the same team-configuration store the Teams sidebar writes. */}
        <StorageProvider storage={routeData.storage}>
          <QueryClientProvider client={queryClient}>
            <AutoScheduler {...props} />
          </QueryClientProvider>
        </StorageProvider>
      </JiraProvider>
    </FlagsProvider>
  );
}

/**
 * A team's header row. Split out because the dirty treatment needs `useTeamIsDirty`, and a hook
 * cannot be called inside the `gridifiedTeams.map` in `AutoScheduler`'s body.
 */
const TeamHeaderRow: FC<{
  team: GridifiedStatsTeam;
  gridNumberOfDays: number;
  frozenIssues: ReadonlySet<string>;
  onToggleFrozen: (keys: string[], frozen: boolean) => void;
}> = ({ team, gridNumberOfDays, frozenIssues, onToggleFrozen }) => {
  const isDirty = useTeamIsDirty(team.team);

  // Only this team's visible rows, so "Unfreeze all" never touches another team or a filtered row.
  const freezableKeys = team.gridifiedTracks
    .flatMap((track) => track.issues)
    .filter((issue) => canFreeze(issue.linkedIssue))
    .map((issue) => issue.linkedIssue.key);
  const allFrozen = freezableKeys.length > 0 && freezableKeys.every((key) => frozenIssues.has(key));

  return (
    <>
      <div
        data-team-row={team.team}
        data-dirty={isDirty}
        className={`relative pt-2 pb-1 ${isDirty ? 'bg-[#fff3eb] shadow-[inset_3px_0_0_#b65c02]' : 'bg-neutral-20'}`}
        style={{
          zIndex: gridLayer.teamHeaderBackground,
          gridRow: `${team.style.gridRowStart} / span 1`,
          gridColumn: `1 / span ${gridNumberOfDays + 1}`,
        }}
      />

      <div
        className={`pl-2 pt-2 pb-1 pr-1 flex max-w-sm sticky top-0 left-0 ${isDirty ? 'bg-[#fff3eb]' : 'bg-neutral-20'}`}
        style={{ zIndex: gridLayer.teamHeaderLabel, gridRow: team.style.gridRowStart, gridColumnStart: 'what' }}
      >
        {/* `min-w-0` lets the flex item shrink below its text width so `truncate` can clip it. */}
        <TruncatedText text={team.team} className="text-base grow min-w-0 font-semibold" />
      </div>

      {/* Above `#dependencies`, which would otherwise swallow every click on the capacity read view
          and the stepper, and above the rows below, which the open capacity editor overflows into. */}
      <div
        className="pl-0 pt-1.5 pb-1 pr-3 text-xs flex flex-wrap items-center justify-between gap-x-4 gap-y-1 relative"
        style={{
          zIndex: gridLayer.teamHeader,
          gridRow: `${team.style.gridRowStart} / span 1`,
          gridColumn: `2 / span ${gridNumberOfDays}`,
        }}
      >
        {/* Scoped tightly to the inputs: `useTeamCommit` suspends on the team-configuration and
            field queries, and a boundary any higher would unmount the running simulation. A failed
            query degrades the row to its read-only half rather than taking the report down. */}
        <ErrorBoundary fallback={() => <></>}>
          <Suspense fallback={<span className="inline-flex h-[22px]" />}>
            <TeamCapacityInputs
              teamName={team.team}
              hierarchyLevel={team.hierarchyLevel}
              savedVelocityPerSprint={team.teamData.velocity}
              savedTracks={team.teamData.parallelWorkLimit}
            />
          </Suspense>
        </ErrorBoundary>
        <div className="flex items-center gap-x-4">
          {freezableKeys.length > 0 && (
            <button
              type="button"
              className="text-xs text-neutral-600 underline-offset-2 hover:underline"
              onClick={() => onToggleFrozen(freezableKeys, !allFrozen)}
            >
              {allFrozen ? 'Unfreeze all' : 'Freeze all with dates'}
            </button>
          )}
          <TeamCapacityOutputs
            pointsPerDay={team.teamData.totalPointsPerDay}
            totalWorkingDays={totalWorkingDays(team) / team.teamData.parallelWorkLimit}
          />
        </div>
      </div>
    </>
  );
};

function hasUrl(issue: MinimalSimulationIssueResult | SimulationIssueResult): issue is SimulationIssueResult {
  return 'url' in issue.linkedIssue && typeof issue.linkedIssue.url === 'string';
}

/** Every other epic in a track gets a gray band, starting white. */
function isStripedRow(issueIdx: number) {
  return issueIdx % 2 === 1;
}

function totalWorkingDays(team: GridifiedStatsTeam) {
  return team.gridifiedTracks.reduce((total, track) => {
    return total + track.issues.reduce((sum, issue) => sum + issue.adjustedDaysOfWork, 0);
  }, 0);
}

const SimulationData: React.FC<{
  issue: SimulationIssueResult | MinimalSimulationIssueResult;
  gridRowStart: number;
  gridData: GridUIData;
}> = ({ issue, gridRowStart, gridData }) => {
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
      <IssueSummaryLabel
        summary={issue.linkedIssue.summary}
        url={hasUrl(issue) ? issue.linkedIssue.url : undefined}
        gridRowStart={gridRowStart}
      />
      <div
        className="relative block py-1"
        style={{
          zIndex: gridLayer.row,
          gridRow: `${gridRowStart} / span 1`,
          gridColumn: `2 / span ${gridData.gridNumberOfDays}`,
        }}
      >
        <div
          className="absolute bg-gradient-to-r from-blue-200 to-green-200 from-85% to-95% h-1 top-2.5 border-box"
          style={{
            left: percent(issue.startDayBottom),
            width: percentWidth(issue.startDayBottom, issue.dueDayTop),
          }}
        />

        <div
          id={issue.linkedIssue.key}
          className={`work-item cursor-pointer ${rangeBorderClasses()} relative bg-gradient-to-r from-blue-500 to-green-400 from-45% to-55% h-4 border-box rounded`}
          style={{
            left: percent(issue.startDateWithTimeEnoughToFinish),
            width: percentWidth(issue.startDateWithTimeEnoughToFinish, issue.dueDayTop),
          }}
        />
      </div>
    </>
  );
};

/**
 * The grid's first day, as a business-day offset from the start date: 0, or earlier when a bar
 * starts before the start date (work scheduled backward from a frozen item, or a frozen item's own
 * dates). Jira-date shadows don't count; they're clipped.
 */
export function gridStartDayFor(statsUIData: StatsUIData, includeStartTail = false): number {
  // The overall-timing row's start band too, so it is never clipped — and, while its histograms are
  // open, the 1st-percentile start. Not the very earliest: a few runs whose estimates blow up can
  // start a year early and would squash the whole plan into a sliver. The histogram counts the
  // runs cut off at its left edge.
  let earliest = Math.min(0, statsUIData.planStart?.startDay ?? 0);
  const startDays = statsUIData.planStart?.startDays ?? [];
  if (includeStartTail && startDays.length) {
    earliest = Math.min(earliest, startDays[Math.floor(startDays.length * 0.01)]);
  }
  for (const result of statsUIData.simulationIssueResults) {
    earliest = Math.min(
      earliest,
      result.startDateWithTimeEnoughToFinish,
      result.startDayBottom,
      result.ownShouldStartDay,
    );
  }
  return Math.floor(earliest);
}

function gridUIData(
  statsUIData: StatsUIData,
  startDate: Date,
  workItemsToHighlight?: Set<string> | null,
  includeStartTail = false,
) {
  const gridStartDay = gridStartDayFor(statsUIData, includeStartTail);
  // Bars come from the plan pass, which can end past the simulation's finish (a long chain does: the
  // typical epic is calibrated, not the last); should-end ticks never do, but are included for safety.
  const lastDay =
    Math.ceil(
      statsUIData.simulationIssueResults.reduce(
        (latest, result) => Math.max(latest, result.dueDayTop, result.ownDueDayTop),
        statsUIData.endDaySimulationResult.dueDayTop,
      ),
    ) + 1;
  const endDate = getUTCEndDateFromStartDateAndBusinessDays(startDate, lastDay + 1);
  // Unchanged when nothing starts early, so a plan with no frozen items lays out exactly as before.
  const gridStartDate = gridStartDay < 0 ? businessDayOffsetToDate(startDate, gridStartDay) : startDate;
  const timeRanges = bestFitRanges(gridStartDate, endDate, 12) as Array<{
    startDay: number;
    days: number;
    prettyStart: String;
  }>;

  // `bestFitRanges` can legitimately come back empty — a span containing no business days at all
  // (a weekend start date with a plan that finishes the same day) has nothing to label. There are
  // no columns to size the grid from, so bail out and let the caller show a message rather than
  // reaching into an empty array.
  const last = timeRanges[timeRanges.length - 1];
  if (!last) {
    return null;
  }

  const startingRows = 4;
  const gridifiedTeams = gridifyStatsUIData(statsUIData, 4, workItemsToHighlight);
  const lastTeam = gridifiedTeams[gridifiedTeams.length - 1] || {
    style: { gridRowStart: startingRows },
    gridRowSpan: 1,
  };
  return {
    gridNumberOfDays: last.startDay + last.days,
    /** Business-day offset of the grid's first column; day `d` is `d - gridStartDay` columns in. */
    gridStartDay,
    timeRanges,
    gridifiedTeams,
    rowsCount: lastTeam.style.gridRowStart + lastTeam.gridRowSpan,
    statsUIData,
  };
}

type StatsTeam = StatsUIData['teams'][0];
type GridifiedStatsTeam = StatsTeam & {
  style: { gridRowStart: number };
  gridRowSpan: number;
  gridifiedTracks: GridifiedStatsTrack[];
};

type StatsIssue = StatsUIData['teams'][0]['tracks'][0][0];
type GridifiedStatsTrack = {
  style: { gridRowStart: number };
  gridRowSpan: number;
  issues: StatsIssue[];
};

function gridifyStatsTeam(team: StatsTeam) {}

function gridifyStatsUIData(statsUIData: StatsUIData, startingRows: number, workItemsToHighlight?: Set<string> | null) {
  let previousGridifiedTeam: GridifiedStatsTeam | null = null;
  const plans = statsUIData.teams
    .sort((a, b) => a.team.localeCompare(b.team))
    .map((team, i) => {
      // first row of this plan
      const start = previousGridifiedTeam
        ? previousGridifiedTeam.style.gridRowStart + previousGridifiedTeam.gridRowSpan + 1
        : startingRows;
      // how much it spans ... one for each track and all the rows
      let previousTrack: GridifiedStatsTrack | null = null;
      // where is each track
      const gridifiedTracks = team.tracks
        .map((issues, i) => {
          // Filter issues if highlight is set
          const filteredIssues = workItemsToHighlight
            ? issues.filter((issue) => workItemsToHighlight.has(issue.linkedIssue.key))
            : issues;
          return (previousTrack = {
            issues: filteredIssues,
            style: {
              gridRowStart: previousTrack ? previousTrack.style.gridRowStart + previousTrack.gridRowSpan : start + 1,
            },
            gridRowSpan: filteredIssues.length + 1,
          });
        })
        .filter((track) => track.issues.length > 0) as GridifiedStatsTrack[];
      // Only include teams with visible tracks
      const gridRowSpan = gridifiedTracks.length + gridifiedTracks.reduce((a, t) => a + t.issues.length, 0);
      return (previousGridifiedTeam = {
        ...team,
        style: { gridRowStart: start },
        gridRowSpan,
        gridifiedTracks,
      });
    })
    .filter((team) => team.gridifiedTracks.length > 0);
  return plans;
}
