import type { FC } from "react";
import React from "react";
import {colorByTeam} from "./color-by-team";
import type { DerivedIssue } from "../../../jira/derived/derive";
import type { ComputedIssueTiming, TeamTimings } from "../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated";

import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, TooltipProps
  } from 'recharts';
  
  
  type Props = {
    teamTimings: TeamTimings;
    team: string | null;
    setTeam: React.Dispatch<React.SetStateAction<string|null>>;
  };
  

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
  
    const data = payload[0].payload as TeamTimings[number];
  
    return (
      <div style={{ backgroundColor: 'white', border: '1px solid #ccc', padding: 10 }}>
       
        <div>Team: {data.team}</div>
        <div>Mean: {data.mean}</div>
        <div>Variance: {data.variance}</div>
        <div>Issue Count: {data.issueCount}</div>
      </div>
    );
  };

  // TODO: move somewhere centralized
  function roundTo(value: number, decimals: number = 1): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  function isANumber(num: number){
    return !isNaN(num);
  }
  
  export function TeamMeanVsVarianceScatter({ teamTimings, team, setTeam }: Props) {
    const filteredTeamTimings = team === null ? teamTimings : teamTimings.filter( tt => tt.team === team)
    
    const sortedAlphaTeamTimings = [...filteredTeamTimings].sort( (ttA, ttB)=> {
        if(ttA.team > ttB.team) {
            return 1;
        } else {
            return -1;
        }
    })
    
    const minVariance = Math.min(...sortedAlphaTeamTimings.map(tt => tt.variance).filter(isANumber));
    const maxVariance = Math.max(...sortedAlphaTeamTimings.map(tt => tt.variance).filter(isANumber) );
    const niceMinVariance = Math.pow(10, Math.floor(Math.log10(minVariance)));
    const niceMaxVariance = Math.max( Math.pow(10, Math.ceil(Math.log10(maxVariance))), 0.3);

    const minMean = Math.min(...sortedAlphaTeamTimings.map(tt => tt.mean).filter(isANumber) );
    const maxMean = Math.max(...sortedAlphaTeamTimings.map(tt => tt.mean).filter(isANumber) );
    const niceMaxMean = Math.max( Math.ceil(maxMean), 1);
    /*const allIssueTimings = teamTimings.map( teamTiming => teamTiming.computedIssueTimings ).flat(1);

    const baseIssues = team === null ? allIssueTimings : allIssueTimings.filter( issue => issue.issue.team.name === team)

    const data = {historic: baseIssues};
    

    const minValue = Math.max(
        0.5,
        Math.min(...data.historic.map(d =>
          Math.min(d.estimatedTeamDays, d.computedActualTeamDaysOfWork)
        ))
      );
    const maxEstimates = Math.max(...data.historic.map(d => d.estimatedTeamDays ));
    const maxActuals = Math.max(...data.historic.map(d => d.computedActualTeamDaysOfWork ));
      
    const maxValue = Math.min(maxEstimates, maxActuals);

    const teams = Array.from(new Set(data.historic.map(d => d.issue.team.name))).sort();*/
  
    return (
        <ResponsiveContainer width="100%" height={800}>
            <ScatterChart  margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
            <CartesianGrid />
            <YAxis type="number" dataKey="mean" name="Actual" 
                label={{ value: "Mean", angle: -90, position: "insideLeft" }}
                
                domain={[0, niceMaxMean]}
                ticks={generateWholeNumberTicks(0, niceMaxMean)} 
                allowDataOverflow={true}/>
            <XAxis type="number" dataKey="variance" 
                name="Variance"
                scale="log"
                ticks={generateLogTicksWithSteps(niceMinVariance, niceMaxVariance)}
                domain={[niceMinVariance, niceMaxVariance]} 
                label={{ value: "Variance", position: "insideBottom", offset: -10 }} 
                allowDataOverflow={true}
                />
            
            <Tooltip cursor={{ strokeDasharray: '3 3' }}  content={<CustomTooltip />} />
            <Legend 
                verticalAlign="bottom"
                wrapperStyle={{ paddingTop: 15 }}
                onClick={({value: clickedTeam}) => {
                    setTeam(team === clickedTeam ? null : clickedTeam)
                }}/>

            <ReferenceLine
                segment={[
                    { x: 0.3, y: 0 }, // x = actual, y = estimated
                    { x: 0.3, y:niceMaxMean  },
                ]}
                stroke="gray"
                strokeDasharray="3 3"
                strokeWidth={3}
                />
            <ReferenceLine
                segment={[
                    { x: niceMinVariance, y: 1 }, // x = actual, y = estimated
                    { x: niceMaxVariance, y: 1 },
                ]}
                stroke="gray"
                strokeDasharray="3 3"
                strokeWidth={3}
                />


            {sortedAlphaTeamTimings.map((teamTiming) => (
                <Scatter
                    key={teamTiming.team}
                    name={teamTiming.team}
                    data={[teamTiming]}
                    fill={colorByTeam(teamTiming.team)}
                    onClick={({team: clickedTeam}) => {
                        debugger
                        setTeam(team === clickedTeam ? null : clickedTeam)
                    }}
                />
            ))}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  export function generateWholeNumberTicks(min: number, max: number): number[] {
    const start = Math.ceil(min);
    const end = Math.floor(max);
  
    if (end < start) return [];
  
    const ticks: number[] = [];
    for (let i = start; i < end; i++) {
      ticks.push(i);
    }
    return ticks;
  }

  function generateLogTicks(min: number, max: number): number[] {
    const ticks: number[] = [];
    const startExp = Math.ceil(Math.log10(min));
    const endExp = Math.floor(Math.log10(max));
  
    for (let exp = startExp; exp <= endExp; exp++) {
      ticks.push(Math.pow(10, exp));
    }
  
    return ticks;
  }

  export function generateLogTicksWithSteps(min: number, max: number): number[] {
    const bases = [1, 3];
    const ticks: number[] = [];
  
    const minExp = Math.floor(Math.log10(min));
    const maxExp = Math.ceil(Math.log10(max));
  
    for (let exp = minExp; exp <= maxExp; exp++) {
      for (const base of bases) {
        const tick = roundTo(base * Math.pow(10, exp), 6);
        if (tick >= min && tick <= max) {
          ticks.push(tick);
        }
      }
    }
  
    return ticks;
  }