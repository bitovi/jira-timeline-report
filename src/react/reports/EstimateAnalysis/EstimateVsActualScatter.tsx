import type { FC } from "react";
import React from "react";
import {colorByTeam} from "./color-by-team";
import type { DerivedIssue } from "../../../jira/derived/derive";
import { getComputedActualAndEstimatedEffort } from "../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated";
import type { TimingDataWithComputedDays } from "../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated";
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer, TooltipProps
  } from 'recharts';
  
  
  type Props = {
    issues: DerivedIssue[];
    team: string | null;
    setTeam: React.Dispatch<React.SetStateAction<string|null>>;
  };
  

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
  
    const data = payload[0].payload as TimingDataWithComputedDays;
  
    return (
      <div style={{ backgroundColor: 'white', border: '1px solid #ccc', padding: 10 }}>
        <a href={data.issue.url}>{data.key} - {data.issue.summary}</a>
        <div>Team: {data.issue.team.name}</div>
        <div>Estimate: {roundTo(data.deterministicTotalDaysOfWork)}</div>
        <div>Start date - End date: {roundTo(data.issue.derivedTiming.datesDaysOfWork || 0)}</div>
        <div>Actual: {roundTo(data.computedDaysOfWork)}</div>
        
      </div>
    );
  };

  // TODO: move somewhere centralized
  function roundTo(value: number, decimals: number = 1): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  
  export function EpicEstimatesScatter({ issues, team, setTeam }: Props) {
    const baseIssues = team === null ? issues : issues.filter( issue => issue.team.name === team)

    const data = getComputedActualAndEstimatedEffort(baseIssues);
    

    const minValue = Math.max(
        0.5,
        Math.min(...data.historic.map(d =>
          Math.min(d.deterministicTotalDaysOfWork, d.computedDaysOfWork)
        ))
      );
    const maxEstimates = Math.max(...data.historic.map(d => d.deterministicTotalDaysOfWork ));
    const maxActuals = Math.max(...data.historic.map(d => d.computedDaysOfWork ));
      
    const maxValue = Math.min(maxEstimates, maxActuals);

    const teams = Array.from(new Set(data.historic.map(d => d.issue.team.name)));
  
    return (
        <ResponsiveContainer width="100%" height={600}>
            <ScatterChart width={800} height={500} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
            <CartesianGrid />
            <XAxis type="number" dataKey="computedDaysOfWork" name="Actual" scale="log" domain={[0.5, 'auto']}  ticks={[.3, 1, 3, 10, 30, 100]} />
            <YAxis type="number" dataKey="deterministicTotalDaysOfWork" name="Estimated" scale="log" domain={[0.5, 'auto']}  ticks={[.3, 1, 3, 10, 30, 100]} />
            
            <Tooltip cursor={{ strokeDasharray: '3 3' }}  content={<CustomTooltip />} />
            <Legend onClick={({value: clickedTeam}) => {
                setTeam(team === clickedTeam ? null : clickedTeam)
            }}/>
            <ReferenceLine
                segment={[
                    { x: minValue, y: minValue }, // x = actual, y = estimated
                    { x: maxValue, y: maxValue },
                ]}
                stroke="gray"
                strokeDasharray="3 3"
                />

            {teams.map((team) => (
            <Scatter
                key={team}
                name={team}
                data={data.historic.filter(d => d.issue.team.name === team)}
                fill={colorByTeam(team)}
                onClick={ (event) => {
                    window.open(event.payload.issue.url, '_blank');
                }}
            />
            ))}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }