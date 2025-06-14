import type {
  SimulationData,
  StatsUIData,
  SimulationIssueResult,
  MinimalSimulationIssueResult,
} from './scheduler/stats-analyzer';
import type { DerivedIssue } from '../../../jira/derived/derive';

import React, { FC, useEffect, useState, useRef, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { FlagsProvider } from '@atlaskit/flag';
import { IssueSimulationRow } from './IssueSimulationRow';
import UpdateModal from './components/UpdateModal/UpdateModal';
import { StatsAnalyzer } from './scheduler/stats-analyzer';
import { CanObservable } from '../../hooks/useCanObservable/useCanObservable.js';
import { useCanObservable } from '../../hooks/useCanObservable';
import { useUncertaintyWeight } from '../../hooks/useUncertaintyWeight/useUncertaintyWeight.js';
import { useSelectedStartDate } from '../../hooks/useSelectedStartDate/useSelectedStartDate.js';
import { JiraProvider } from '../../services/jira/JiraProvider';
import { queryClient } from '../../services/query/queryClient';
import { bestFitRanges } from '../../../utils/date/best-fit-ranges';
import routeData from '../../../canjs/routing/route-data/index';
import { getUTCEndDateFromStartDateAndBusinessDays } from '../../../utils/date/business-days.js';
import { CriticalPath } from './CriticalPath';
import { makeInsertBlockers } from './svg-blockers';
import { roundTo } from '../../../utils/number/number';

type RolledUpIssue = DerivedIssue & {
  completionRollup: { totalWorkingDays: number };
};

type ObservableOfIssues = CanObservable<Array<RolledUpIssue>>;
export type GridUIData = ReturnType<typeof gridUIData>;

interface AutoSchedulerProps {
  primaryIssuesOrReleasesObs: CanObservable<Array<RolledUpIssue>>;
  allIssuesOrReleasesObs: ObservableOfIssues;
}

const AutoScheduler: FC<AutoSchedulerProps> = ({ primaryIssuesOrReleasesObs, allIssuesOrReleasesObs }) => {
  const primary = useCanObservable(primaryIssuesOrReleasesObs);
  const allIssues = useCanObservable(allIssuesOrReleasesObs);

  const [selectedStartDate] = useSelectedStartDate();
  const [uncertaintyWeight] = useUncertaintyWeight();

  // state for which work items to highlight
  const [workItemsToHighlight, setWorkItemsToHighlight] = useState<Set<string> | null>(null);

  // stuff to get the monte-carlo data going
  const statsAnalyzerRef = useRef<StatsAnalyzer>();
  const [uiData, setUIData] = useState<StatsUIData | null>(null);
  useEffect(() => {
    const statsAnalyzer = new StatsAnalyzer({
      issues: primary,
      uncertaintyWeight: uncertaintyWeight,
      setUIState: (newUIData) => {
        setUIData(newUIData);
      },
    });
    statsAnalyzerRef.current = statsAnalyzer;

    return () => {
      statsAnalyzer.teardown;
    };
  }, [primary]);

  useEffect(() => {
    const statsAnalyzer = statsAnalyzerRef.current;
    if (!statsAnalyzer) return;
    statsAnalyzer.updateUncertaintyWeight(uncertaintyWeight);
  }, [uncertaintyWeight]);

  // stuff to draw the blockers right
  const svgRef = useRef<SVGSVGElement>(null);
  const updateBlockers = useCallback(makeInsertBlockers(uiData), [uiData?.percentComplete === 100]);
  useEffect(updateBlockers, [uiData?.percentComplete === 100, uiData]);

  useEffect(() => {
    const observer = new ResizeObserver(updateBlockers);
    const container = svgRef.current;
    if (container) observer.observe(container);

    window.addEventListener('resize', updateBlockers);
    updateBlockers(); // initial draw

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBlockers);
    };
  }, [updateBlockers]);

  if (!allIssues?.length) {
    return <div>Loading ...</div>;
  }

  if (!uiData) {
    return <div>Starting ....</div>;
  }

  // converts the stats into data for a grid
  const gridData = gridUIData(uiData, selectedStartDate, workItemsToHighlight);

  return (
    <div className="relative py-2">
      {/* Progress Bar */}
      <div
        className={` h-1 bg-orange-400 transition-opacity duration-500 ${
          uiData.percentComplete === 100 ? 'opacity-0' : ''
        }`}
        style={{ width: `${uiData.percentComplete}%`, top: '' }}
      >
        &nbsp;
      </div>

      <UpdateModal startDate={selectedStartDate} issues={uiData} />

      {/* Simulation Grid */}
      <div
        className="grid bg-white relative border border-neutral-30 rounded shadow-sm"
        style={{
          gridTemplateColumns: `[what] auto repeat(${gridData.gridNumberOfDays}, 1fr)`,
          gridTemplateRows: 'auto',
        }}
      >
        {/* Background SVG Layer */}
        <div
          className="relative z-1"
          style={{
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

        {/* Placeholder for row height */}
        <div className="text-xs" style={{ gridRow: '1 / span 1', gridColumn: '1 / span 1' }}>
          &nbsp;
        </div>

        {gridData.timeRanges.map((range, i) => {
          return (
            <div
              key={'time' + i}
              style={{
                gridRow: `1 / span 1`,
                gridColumn: `${1 + range.startDay} / span ${range.days}`,
              }}
              className="border-neutral-30 border-solid border-x px-1 text-xs truncate sticky top-0 bg-white z-40"
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

        <div className="pl-2 pt-2 pb-1 pr-1 flex " style={{ gridRow: 2, gridColumnStart: 'what' }}>
          <div className="text-base grow font-semibold">Summary</div>
        </div>

        <IssueSimulationRow
          issue={uiData.endDaySimulationResult}
          gridRowStart={3}
          gridData={gridData}
          selectedStartDate={selectedStartDate}
          uncertaintyWeight={uncertaintyWeight}
        />

        {/* Team Tracks */}
        {gridData.gridifiedTeams.map((team, teamIdx) => (
          <React.Fragment key={`team-${teamIdx}`}>
            {/* Only show team if it has visible tracks/issues */}
            {team.gridifiedTracks.length > 0 && (
              <>
                {/* The stripe background for the team*/}
                <div
                  className="bg-neutral-20 pt-2 pb-1 "
                  style={{
                    gridRow: `${team.style.gridRowStart} / span 1`,
                    gridColumn: `1 / span ${gridData.gridNumberOfDays + 1}`,
                  }}
                />

                <div
                  className="pl-2 pt-2 pb-1 pr-1 flex sticky top-0 bg-neutral-20"
                  style={{ gridRow: team.style.gridRowStart, gridColumnStart: 'what' }}
                >
                  <div className="text-base grow font-semibold">{team.team}</div>
                </div>
                <div
                  className="pl-2 pt-3 pb-1 pr-2 text-xs flex flex-row-reverse gap-2"
                  style={{
                    gridRow: `${team.style.gridRowStart} / span 1`,
                    gridColumn: `2 / span ${gridData.gridNumberOfDays}`,
                  }}
                >
                  <div>
                    {team.teamData.parallelWorkLimit === 1
                      ? `Points / Day: ${roundTo(team.teamData.pointsPerDayPerTrack, 2)}`
                      : `Points / Day / Track ${team.teamData.pointsPerDayPerTrack}`}
                  </div>
                  <div>Total Working Days: {roundTo(totalWorkingDays(team) / team.teamData.parallelWorkLimit, 0)},</div>
                </div>

                {team.gridifiedTracks.map(
                  (gridifiedTrack, trackIdx) =>
                    gridifiedTrack.issues.length > 0 && (
                      <React.Fragment key={`track-${teamIdx}-${trackIdx}`}>
                        <div
                          className="pl-4 flex pt-0.5 pr-1"
                          style={{
                            gridRow: `${gridifiedTrack.style.gridRowStart} / span 1`,
                            gridColumnStart: 'what',
                          }}
                        >
                          <div className="text-xs grow">Track {trackIdx + 1}</div>
                        </div>

                        {gridifiedTrack.issues.map((issue, issueIdx) => (
                          <IssueSimulationRow
                            key={`issue-${teamIdx}-${trackIdx}-${issueIdx}`}
                            issue={issue}
                            gridRowStart={gridifiedTrack.style.gridRowStart + issueIdx + 1}
                            gridData={gridData}
                            selectedStartDate={selectedStartDate}
                            uncertaintyWeight={uncertaintyWeight}
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
      {/* Critical Path Report */}
      <CriticalPath
        uiData={uiData}
        workItemsToHighlight={workItemsToHighlight}
        setWorkItemsToHighlight={setWorkItemsToHighlight}
      />
    </div>
  );
};

export default function AutoSchedulerWrapper(props: AutoSchedulerProps) {
  return (
    <FlagsProvider>
      <JiraProvider jira={routeData.jiraHelpers}>
        <QueryClientProvider client={queryClient}>
          <AutoScheduler {...props} />
        </QueryClientProvider>
      </JiraProvider>
    </FlagsProvider>
  );
}

function hasUrl(issue: MinimalSimulationIssueResult | SimulationIssueResult): issue is SimulationIssueResult {
  return 'url' in issue.linkedIssue && typeof issue.linkedIssue.url === 'string';
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
      <div
        className="relative block py-1 z-30"
        onMouseEnter={() => {
          console.log(issue);
        }}
        style={{
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

function gridUIData(statsUIData: StatsUIData, startDate: Date, workItemsToHighlight?: Set<string> | null) {
  const gridNumberOfDays = Math.ceil(statsUIData.endDaySimulationResult.dueDayTop) + 1;
  const endDate = getUTCEndDateFromStartDateAndBusinessDays(startDate, gridNumberOfDays + 1);
  const timeRanges = bestFitRanges(startDate, endDate, 12) as Array<{
    startDay: number;
    days: number;
    prettyStart: String;
  }>;

  const last = timeRanges[timeRanges.length - 1];
  const startingRows = 4;
  const gridifiedTeams = gridifyStatsUIData(statsUIData, 4, workItemsToHighlight);
  const lastTeam = gridifiedTeams[gridifiedTeams.length - 1] || {
    style: { gridRowStart: startingRows },
    gridRowSpan: 1,
  };
  return {
    gridNumberOfDays: last.startDay + last.days,
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
