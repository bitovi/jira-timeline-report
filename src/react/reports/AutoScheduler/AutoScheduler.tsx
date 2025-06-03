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
  const gridData = gridUIData(uiData, selectedStartDate);

  return (
    <div className="relative">
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
        className="grid bg-white relative"
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
              key={i}
              style={{
                gridRow: `1 / span 1`,
                gridColumn: `${1 + range.startDay} / span ${range.days}`,
              }}
              className="border-neutral-30 border-solid border-x px-1 text-xs truncate"
            >
              {range.prettyStart}
            </div>
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
        />

        {/* Team Tracks */}
        {gridData.gridifiedTeams.map((team, teamIdx) => (
          <React.Fragment key={`team-${teamIdx}`}>
            {/* The stripe background for the team*/}
            <div
              className="bg-neutral-20 pt-2 pb-1 "
              style={{
                gridRow: `${team.style.gridRowStart} / span 1`,
                gridColumn: `1 / span ${gridData.gridNumberOfDays + 1}`,
              }}
            />

            <div
              className="pl-2 pt-2 pb-1 pr-1 flex "
              style={{ gridRow: team.style.gridRowStart, gridColumnStart: 'what' }}
            >
              <div className="text-base grow font-semibold">{team.team}</div>
            </div>

            {team.gridifiedTracks.map((gridifiedTrack, trackIdx) => (
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
                  />
                ))}
              </React.Fragment>
            ))}
          </React.Fragment>
        ))}
      </div>
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
        ></div>
      </div>
    </>
  );
};

function gridUIData(statsUIData: StatsUIData, startDate: Date) {
  const gridNumberOfDays = Math.ceil(statsUIData.endDaySimulationResult.dueDayTop) + 1;
  const endDate = getUTCEndDateFromStartDateAndBusinessDays(startDate, gridNumberOfDays + 1);
  const timeRanges = bestFitRanges(startDate, endDate, 12) as Array<{
    startDay: number;
    days: number;
    prettyStart: String;
  }>;

  const last = timeRanges[timeRanges.length - 1];

  const startingRows = 4;

  const gridifiedTeams = gridifyStatsUIData(statsUIData, 4);

  const lastTeam = gridifiedTeams[gridifiedTeams.length - 1];
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

function gridifyStatsUIData(statsUIData: StatsUIData, startingRows: number) {
  let previousGridifiedTeam: GridifiedStatsTeam | null = null;
  const plans = statsUIData.teams.map((team, i) => {
    // first row of this plan
    const start = previousGridifiedTeam
      ? previousGridifiedTeam.style.gridRowStart + previousGridifiedTeam.gridRowSpan + 1
      : startingRows;
    // how much it spans ... one for each track and all the rows
    const span = team.tracks.length + team.tracks.reduce((a, t) => a + t.length, 0);

    let previousTrack: GridifiedStatsTrack | null = null;

    // where is each track
    const gridifiedTracks = team.tracks.map((issues, i) => {
      return (previousTrack = {
        issues: issues,
        style: {
          gridRowStart: previousTrack ? previousTrack.style.gridRowStart + previousTrack.gridRowSpan : start + 1,
        },
        gridRowSpan: issues.length + 1,
      });
    }) as GridifiedStatsTrack[];
    return (previousGridifiedTeam = {
      ...team,
      style: { gridRowStart: start },
      gridRowSpan: span,
      gridifiedTracks,
    });
  });
  const lastPlan = plans[plans.length - 1];
  //plans.gridRowSpan = lastPlan.style.gridRowStart + lastPlan.gridRowSpan;
  return plans;
}

function makeInsertBlockers(statsUIData: StatsUIData | null) {
  return () => {
    // Draw blockers after DOM is rendered
    const svg = document.getElementById('dependencies')?.querySelector('svg') as SVGSVGElement | null;
    if (!svg || !statsUIData) return;

    // Remove previous blockers
    svg.querySelectorAll('.path-blocker').forEach((el) => el.remove());
    const svgRect = svg.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${svgRect.width} ${svgRect.height}`);
    function getTopLeft(el: Element) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    }

    function minusPoint(a: { x: number; y: number }, b: { x: number; y: number }) {
      return { x: a.x - b.x, y: a.y - b.y };
    }

    // Map work-item elements by id
    const elementsAndWorkMap: Record<string, { element: HTMLElement; work: SimulationData }> = {};
    document.querySelectorAll<HTMLElement>('.work-item').forEach((element) => {
      if (element.id && (element as HTMLElement).offsetParent) {
        const work = statsUIData.simulationIssueResults.find((i) => i.linkedIssue.key === element.id);
        if (work) {
          elementsAndWorkMap[element.id] = { element: element as HTMLElement, work };
        }
      }
    });
    // Draw blockers
    Object.values(elementsAndWorkMap).forEach(({ element, work }) => {
      const blocks = work.linkedIssue.linkedBlocks;
      if (!blocks) return;
      const blockerPoint = minusPoint(getCenterRight(element), getTopLeft(svg));
      for (const blocking of blocks) {
        const blocked = elementsAndWorkMap[blocking.key];
        if (!blocked) continue;
        /*const blockedPoint = minusPoint(getCenterLeft(blocked.element), getTopLeft(svg));
                const blockingPath = path({ d: makeCurveBetweenPoints(blockerPoint, blockedPoint) });
                blockingPath.classList.add("path-blocker");
                blockingPath.id = work.linkedIssue.key + "-" + blocking.key;
                svg.appendChild(blockingPath);*/
        const blockedPoint = minusPoint(getCenterLeft(blocked.element), getTopLeft(svg));

        const blockingPath = path({
          d: makeCurveBetweenPoints(blockerPoint, blockedPoint),
          //C x1 y1, x2 y2, x y
        });
        blockingPath.classList.add('path-blocker');
        blockingPath.id = work.linkedIssue.key + '-' + blocking.key;

        svg.appendChild(blockingPath);
      }
    });
  };
}

function getCenterRight(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return { x: rect.right, y: rect.top + rect.height / 2 };
}
function getCenterLeft(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left, y: rect.top + rect.height / 2 };
}

export function path(attributes: Record<string, string>): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#97a0af');
  for (const attr in attributes) {
    path.setAttributeNS(null, attr, attributes[attr]);
  }

  return path;
}

function makeCurveBetweenPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
  controlDistance: number = 30,
) {
  return `M ${start.x} ${start.y} 
    c ${controlDistance} 0, ${end.x - start.x - controlDistance} ${end.y - start.y}, ${
      end.x - start.x
    } ${end.y - start.y}`;
}
/*
  function makeCurveBetweenPoints(p1: {x: number, y: number}, p2: {x: number, y: number}) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const c1x = p1.x + dx * 0.3;
      const c1y = p1.y;
      const c2x = p2.x - dx * 0.3;
      const c2y = p2.y;
      return `M${p1.x},${p1.y} C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }*/
/*
        function path({d}: {d: string}) {
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", d);
            p.setAttribute("fill", "none");
            p.setAttribute("stroke", "#f87171");
            p.setAttribute("stroke-width", "2");
            return p;
        }*/

function nowUTC() {
  let now = new Date();

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let day = now.getUTCDate();

  // Create a new Date object using UTC components
  return new Date(Date.UTC(year, month, day));
}
