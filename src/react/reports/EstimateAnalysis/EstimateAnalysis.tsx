import type { FC } from "react";
import React, {useState} from "react";

import { CanObservable } from "../../hooks/useCanObservable/useCanObservable.js";
import { useCanObservable } from "../../hooks/useCanObservable";

import type { DerivedIssue } from "../../../jira/derived/derive";

import {bestFitRanges} from "../../../utils/date/best-fit-ranges.js";
import { EpicEstimatesScatter } from "./EstimateVsActualScatter.js";

import {
    addHistoricalAdjustedEstimatedTime,
    FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES,
    getTeamHistoricalEpicData
  } from "../../../jira/rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time";


type RolledUpIssue = DerivedIssue & {
    completionRollup: {totalWorkingDays: number},
    historicalAdjustedEstimatedTime: Array<{historicalAdjustedEstimatedTime: number, teamName: String}>
}

type ObservableOfIssues = CanObservable<Array<RolledUpIssue>>;

function getTeamNames(issues: Array<RolledUpIssue>) {
    const teamNames = new Set();
    for(let issue of issues) {
        for(let teamRecord of issue.historicalAdjustedEstimatedTime) {
            teamNames.add(teamRecord.teamName);
        }
    }
    return [...teamNames] as Array<string>;
}


function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }


type HistoricalEpicData = {
    [teamName: string]: {
      historicIssues: RolledUpIssue[];
      compareData: {
        startDate: Date;
        dueDate: Date;
        totalDaysOfWork: number;
        deterministicTotalDaysOfWork: number;
        key: string;
        issue: RolledUpIssue;
      }[];
      ignoredIssues: RolledUpIssue[];
      theoreticalMean: number;
      pointsPerDay: Map<string, number>;
    };
  };



const headerClassNames = "font-bold sticky top-0 bg-white p-1"

export const EstimateAnalysis: FC<{
    primaryIssuesOrReleasesObs: CanObservable<Array<RolledUpIssue>>,
    allIssuesOrReleasesObs: ObservableOfIssues,
    rollupTimingLevelsAndCalculationsObs: CanObservable<any[]>
}> = 
    ({ primaryIssuesOrReleasesObs, allIssuesOrReleasesObs, rollupTimingLevelsAndCalculationsObs }) => {
    
    const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

    const primary = useCanObservable(primaryIssuesOrReleasesObs);
    const allIssues = useCanObservable(allIssuesOrReleasesObs);
    const rollupTimingLevelsAndCalculations = useCanObservable(rollupTimingLevelsAndCalculationsObs);

    
    let historicalAdjustedData = getTeamHistoricalEpicData(
        primary
      ) as HistoricalEpicData;

    const allTeamNames = Object.keys(historicalAdjustedData);

    

    const teamEffort = {} as TeamEffortMap;
    for(const team of allTeamNames) {
        teamEffort[team] = historicalAdjustedData[team].pointsPerDay;
    }
    const effortData = transformEffortData(teamEffort);

    

    if(!allIssues?.length) {
        return <div>Loading ...</div>
    }
    
    const ranges = bestFitRanges(effortData.startDate, effortData.endDate, 10) as 
        Array<{startDay: number, days: number, prettyStart: String}>;

    
    const dataColumnsCount = 4;
    const dayColumnsCount = effortData.sortedDates.length;
    const columnCount =
        dataColumnsCount + dayColumnsCount;


    console.log({historicalAdjustedData, effortData, ranges});

    return (
        <div className="">

        <h2>Estimates vs Actuals</h2>
        <EpicEstimatesScatter issues={primary} team={selectedTeam}></EpicEstimatesScatter>

        <h2 className="text-xl font-bold">Estimated Points Per Day</h2>
        <p className="text-sm">How many points on average does each team complete.
            This can help you identify if a team over or under estimates. 

        </p>
        <div
            className="grid w-full text-lg items-center"
            style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, auto))`,
            }}
        >
            {/* Header Row */}
            <div className={headerClassNames}>Team</div>
            <div className={headerClassNames}>Average</div>
            <div className={headerClassNames}>Included</div>
            <div className={headerClassNames}>Excluded</div>
            {ranges.map(range => {
                return <div 
                    style={{
                        gridRow: `1 / span 1`,
                        gridColumn: `${ dataColumnsCount + range.startDay} / span ${range.days}`
                    }}
                    className={headerClassNames}>{range.prettyStart}</div>
            })}


            {/* Data Rows */}
            {effortData.workGrid.map(({ team, values }, index) => {
                const data = historicalAdjustedData[team];
                return (
                    <React.Fragment key={team}>
                    <div style={{
                            gridRow: `${index + 2} / span 1`,
                            gridColumn: `1 / span 1`
                        }}
                        onClick={ ()=>{ setSelectedTeam(team === selectedTeam ? null : team) }}>{team}</div>
                    <div style={{
                        gridRow: `${index + 2} / span 1`,
                        gridColumn: `2 / span 1`
                    }}>{isNaN(data.theoreticalMean) ? " " : roundTo(data.theoreticalMean, 1)}</div>
                    <div style={{
                        gridRow: `${index + 2} / span 1`,
                        gridColumn: `3 / span 1`
                    }}
                        onClick={()=>{
                            console.log({team, historicIssues: data.historicIssues});
                        }}
                    >{data.historicIssues.length}</div>
                    <div style={{
                        gridRow: `${index + 2} / span 1`,
                        gridColumn: `4 / span 1`
                    }}
                        onClick={()=>{
                            console.log({team, ignoredIssues: data.ignoredIssues});
                        }}
                    >{data.ignoredIssues.length}</div>
                    {values.map((value, index) => (
                        <div key={`${team}/${index}`} className="text-center min-w-1 min-h-1 py-1"
                            style={{
                                backgroundColor: `rgba(0, 128, 0, ${Math.min(value / effortData.highest, 1)})`,
                            }}
                            onClick={ ()=> {
                                console.log({value, date: effortData.sortedDates[index]})
                            }}
                            >
                            
                        </div>
                    ))}
                    {/* Pad with empty cells if values are shorter than max length */}
                    {Array.from({ length: columnCount - dataColumnsCount - values.length }).map(
                        (_, i) => (
                        <div key={`${team}-pad-${i}`} />
                        )
                    )}
                    </React.Fragment>
                );
            })}
        </div>
        </div>
  );

    
    
    /*return (
        <div className="">
            <div>{primary.length} items</div>
            <table className="w-full">
                <thead>
                <tr>
                    <th>Team</th>
                    <th>Average</th>
                    <th>Included</th>
                    <th>Excluded</th>
                </tr>
                </thead>
                <tbody>
            {effortData.workGrid.map( ({team, values}) => {
                return <tr className="my-3 text-lg" key={team}>
                    <td>{team}</td>
                    <td>{roundTo(historicalAdjustedData[team].theoreticalMean,1)}</td>
                    <td>{historicalAdjustedData[team].historicIssues.length}</td>
                    <td>{historicalAdjustedData[team].ignoredIssues.length}</td>
                    {values.map( (value, index)=>{
                        return <td key={team+"/"+index}>{value}</td>
                    } )}
                </tr>
            })}
                </tbody>
            </table>
        </div>
    );


    return (<div>Primary Issues: {primary.length}, All Issues {allIssues.length}</div>);*/
};


type TeamEffortMap = Record<string, Map<string, number>>;

interface WorkGridResult {
  highest: number;
  startDate: Date;
  endDate: Date;
  workGrid: { team: string; values: number[] }[];
  sortedDates: Date[];
}

function transformEffortData(data: TeamEffortMap): WorkGridResult {
  // Step 1: Collect all unique dates from all teams
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const teamMap of Object.values(data)) {
    for (const dateStr of teamMap.keys()) {
      const date = new Date(dateStr);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
  }

  // Step 2: Sort dates chronologically
  const sortedDates = makeSortedDates(minDate, maxDate);
  const sortedDateStrings = sortedDates.map(d => d.toISOString().slice(0, 10))

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

  return {
    highest,
    startDate: new Date(sortedDates[0]),
    endDate: new Date(sortedDates[sortedDates.length - 1]),
    workGrid: workGrid.sort((gridA, gridB) => {
        if(gridA.team > gridB.team) {
            return 1;
        } else {
            return -1;
        }
    }),
    sortedDates
  };
}


function makeSortedDates(minDate: Date | null, maxDate: Date | null){
    if(minDate == null || maxDate == null ) {
        return []
    }
    const sortedDates: Date[] = [];
    const current = minDate;
    while (current <= maxDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        sortedDates.push(new Date(current)); // "YYYY-MM-DD"
      }
      current.setDate(current.getDate() + 1);
    }
    return sortedDates;
}

type JiraIssue = DerivedIssue["issue"];

function extractJiraSummary(issue: JiraIssue, minDate: string) {
    const min = new Date(minDate);
  
    return {
      key: issue.key,
      summary: issue.fields["Summary"],
      issueType: issue.fields["Issue Type"]?.name,
      created: issue.fields["Created"],
      status: issue.fields["Status"]?.name,
      storyPoints: issue.fields["Story points median"],
      labels: issue.fields["Labels"],
      dueDate: issue.fields["Due date"],
      startDate: issue.fields["Start date"],
      rank: issue.fields["Rank"],
      changelog: (issue.changelog || [])
        .filter(entry => new Date(entry.created) >= min)
        .map(entry => ({
          //author: entry.author?.displayName,
          created: entry.created,
          items: entry.items.map(item => ({
            field: item.field,
            from: item.fromString,
            to: item.toString
          }))
        }))
    };
  }