import React, { useState, useMemo } from 'react';

import type { TeamTimings } from '../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated';
import { businessDaysInclusive } from '../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated';

import { bestFitRanges } from '../../../utils/date/best-fit-ranges';

import { parseDateIntoLocalTimezone } from '../../../utils/date/date-helpers';

const headerBase = 'font-semibold border-b border-gray-300 pb-1 px-2';
const emptyCell = 'border-b border-gray-100';
const cellBase = 'border-b border-gray-100 py-1 px-2';

type Props = {
  teamTimings: TeamTimings;
  team: string | null;
  setTeam: React.Dispatch<React.SetStateAction<string | null>>;
};

function sortWithNaNAtTheEnd(value1: number, value2: number) {
  if (isNaN(value2)) {
    return -1;
  }
  if (isNaN(value1)) {
    return 1;
  } else {
    return value2 - value1;
  }
}

type SortColumn = keyof TeamStats;
type SortDirection = 'asc' | 'desc';

export const TeamEstimateAccuracyVariance: React.FC<Props> = ({ teamTimings, team, setTeam }) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('team');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const rows = team
    ? teamTimings.filter((data) => data.team === team)
    : teamTimings.sort((team1, team2) => sortWithNaNAtTheEnd(team1.mean, team2.mean));

  const sortedData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? sortWithNaNAtTheEnd(aValue, bValue) : sortWithNaNAtTheEnd(bValue, aValue);
      }

      return 0;
    });
    return sorted;
  }, [teamTimings, sortColumn, sortDirection]);

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? <div>u</div> : <div>d</div>;
  };

  // stuff for the heat map
  const teamEffort = getTeamEffortMap(teamTimings);
  const effortData = transformEffortData(teamEffort);
  const ranges = bestFitRanges(effortData.startDate, effortData.endDate, 10) as Array<{
    startDay: number;
    days: number;
    prettyStart: String;
  }>;

  const dataColumnsCount = 5;
  const dayColumnsCount = effortData.sortedDates.length;
  const columnCount = dataColumnsCount + dayColumnsCount;

  return (
    <div className="mb-4">
      {/* One grid for entire table */}
      <div
        className="grid text-sm"
        style={{ gridTemplateColumns: `repeat(${dataColumnsCount}, auto) repeat(${dayColumnsCount}, 1fr)` }}
      >
        {/* Header row */}
        <div className={headerBase} onClick={() => toggleSort('team')}>
          Team
        </div>
        <div className={headerBase} onClick={() => toggleSort('issueCount')}>
          Issues Count
        </div>
        <div className={headerBase}>Ignored Issues</div>
        <div className={headerBase} onClick={() => toggleSort('mean')}>
          Mean (A / E)
        </div>
        <div className={headerBase} onClick={() => toggleSort('variance')}>
          Variance
        </div>
        {ranges.map((range) => {
          return (
            <div
              style={{
                gridRow: `1 / span 1`,
                gridColumn: `${dataColumnsCount + range.startDay} / span ${range.days}`,
              }}
              className={headerBase}
            >
              {range.prettyStart}
            </div>
          );
        })}

        {/* Data rows */}
        {sortedData.map((row, rowIndex) => (
          <React.Fragment key={row.team}>
            <div
              className={cellBase + ' border-r'}
              onClick={() => {
                setTeam(team === row.team ? null : row.team);
              }}
              style={{
                gridRow: `${rowIndex + 2} / span 1`,
                gridColumn: `1 / span 1`,
              }}
            >
              {row.team}
            </div>
            <div
              className={cellBase + ' border-r text-right'}
              style={{
                gridRow: `${rowIndex + 2} / span 1`,
                gridColumn: `2 / span 1`,
              }}
            >
              {row.issueCount}
            </div>
            <div
              className={cellBase + ' border-r text-right'}
              style={{
                gridRow: `${rowIndex + 2} / span 1`,
                gridColumn: `3 / span 1`,
              }}
            >
              {row.ignoredIssues.length}
            </div>
            <div
              className={cellBase + ' border-r text-right'}
              style={{
                gridRow: `${rowIndex + 2} / span 1`,
                gridColumn: `4 / span 1`,
              }}
            >
              {row.mean.toFixed(2)}
            </div>
            <div
              className={cellBase + ' text-right'}
              style={{
                gridRow: `${rowIndex + 2} / span 1`,
                gridColumn: `5 / span 1`,
              }}
            >
              {row.variance.toFixed(2)}
            </div>
            {effortData.workForTeam[row.team].map((value, index) => (
              <div
                key={`${team}/${index}`}
                className={emptyCell + ' text-center min-h-1 py-1'}
                style={{
                  backgroundColor: `rgba(0, 128, 0, ${Math.min(value / effortData.highest, 1)})`,
                  gridRow: `${rowIndex + 2} / span 1`,
                  gridColumn: `${6 + index} / span 1`,
                }}
                onClick={() => {
                  const teamTiming = teamTimings.find((tt) => tt.team === row.team)?.businessDaysToIssueTimings;
                  if (teamTiming) {
                    const issueTimings = teamTiming.get(effortData.sortedDateStrings[index]) || [];
                    console.log({
                      value,
                      issueTimings: issueTimings,
                      summaries: issueTimings.map((issueTiming) => {
                        return issueTiming.issue.summary;
                      }),
                    });
                  }
                }}
              ></div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export type TeamStats = {
  team: string;
  mean: number;
  median: number;
  variance: number;
  // here so sorting is easier
  issueCount: number;
  //pointsPerDay: ReturnType<typeof estimatedPointsForEachBusinessDay>
};

type TeamEffortMap = Record<string, Map<string, number>>;

function getTeamEffortMap(teamTimings: TeamTimings): TeamEffortMap {
  const teamEffort = {} as TeamEffortMap;
  for (const teamTiming of teamTimings) {
    const effortMap = new Map();
    for (const [date, timings] of teamTiming.businessDaysToIssueTimings) {
      effortMap.set(
        date,
        timings.reduce((prev, cur) => prev + cur.estimatedTeamDaysPerCalendarDay, 0),
      );
    }
    teamEffort[teamTiming.team] = effortMap;
  }
  return teamEffort;
}

interface WorkGridResult {
  highest: number;
  startDate: Date;
  endDate: Date;
  workGrid: { team: string; values: number[] }[];
  workForTeam: Record<string, number[]>;
  sortedDates: Date[];
  sortedDateStrings: string[];
}

function transformEffortData(data: TeamEffortMap): WorkGridResult {
  // Step 1: Collect all unique dates from all teams
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const teamMap of Object.values(data)) {
    for (const dateStr of teamMap.keys()) {
      const date = parseDateIntoLocalTimezone(dateStr) as Date;
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
  }

  // Step 2: Sort dates chronologically!
  const sortedDates = makeSortedDates(minDate, maxDate);
  const sortedDateStrings = sortedDates.map((d) => d.toISOString().slice(0, 10));

  // Step 3: Build workGrid and find the highest effort
  const workGrid: { team: string; values: number[] }[] = [];
  let highest = 0;

  for (const [team, dateEffortMap] of Object.entries(data)) {
    const values: number[] = [];
    for (const date of sortedDateStrings) {
      const effort = dateEffortMap.get(date) || 0;
      values.push(effort);
      if (effort > highest) highest = effort;
    }
    workGrid.push({ team, values });
  }

  const workForTeam = {} as Record<string, number[]>;
  workGrid.forEach((work) => {
    workForTeam[work.team] = work.values;
  });

  return {
    highest,
    startDate: new Date(sortedDates[0]),
    endDate: new Date(sortedDates[sortedDates.length - 1]),
    workGrid: workGrid,
    workForTeam,
    sortedDates,
    sortedDateStrings,
  };
}

function makeSortedDates(minDate: Date | null, maxDate: Date | null) {
  if (minDate == null || maxDate == null) {
    return [];
  }
  const sortedDates: Date[] = [];
  for (const current of businessDaysInclusive(minDate, maxDate)) {
    sortedDates.push(current);
  }
  return sortedDates;
}
