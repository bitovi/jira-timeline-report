import type { FC } from 'react';
import React from 'react';
import { colorByTeam } from './color-by-team';
import type { DerivedIssue } from '../../../jira/derived/derive';
import type {
  ComputedIssueTiming,
  TeamTimings,
} from '../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated';
import { roundTo } from '../../../utils/number/number';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

type Props = {
  teamTimings: TeamTimings;
  team: string | null;
  setTeam: React.Dispatch<React.SetStateAction<string | null>>;
};

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload as ComputedIssueTiming;

  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #ccc', padding: 10 }}>
      <a href={data.issue.url}>
        {data.key} - {data.issue.summary}
      </a>
      <div>Team: {data.issue.team.name}</div>
      <div>Estimate: {roundTo(data.estimatedTeamDays)}</div>
      <div>Start date - End date: {roundTo(data.issue.derivedTiming.datesDaysOfWork || 0)}</div>
      <div>Actual: {roundTo(data.computedActualTeamDaysOfWork)}</div>
    </div>
  );
};

export function EpicEstimatesScatter({ teamTimings, team, setTeam }: Props) {
  const allIssueTimings = teamTimings.map((teamTiming) => teamTiming.computedIssueTimings).flat(1);

  const baseIssues =
    team === null ? allIssueTimings : allIssueTimings.filter((issue) => issue.issue.team.name === team);

  const data = { historic: baseIssues };

  const minValue = Math.max(
    0.5,
    Math.min(...data.historic.map((d) => Math.min(d.estimatedTeamDays, d.computedActualTeamDaysOfWork))),
  );
  const maxEstimates = Math.max(...data.historic.map((d) => d.estimatedTeamDays));
  const maxActuals = Math.max(...data.historic.map((d) => d.computedActualTeamDaysOfWork));

  const maxValue = Math.min(maxEstimates, maxActuals);

  const teams = Array.from(new Set(data.historic.map((d) => d.issue.team.name))).sort();

  return (
    <ResponsiveContainer width="100%" height={600}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
        <CartesianGrid />
        <XAxis
          type="number"
          dataKey="computedActualTeamDaysOfWork"
          name="Actual"
          scale="log"
          domain={[0.5, 'auto']}
          ticks={[0.3, 1, 3, 10, 30, 100]}
          label={{ value: 'Actual Team Days', position: 'insideBottom', offset: -10 }}
        />
        <YAxis
          type="number"
          dataKey="estimatedTeamDays"
          name="Estimated"
          scale="log"
          domain={[0.5, 'auto']}
          ticks={[0.3, 1, 3, 10, 30, 100]}
          label={{ value: 'Estimated Team Days', angle: -90, position: 'insideLeft' }}
        />

        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
        <Legend
          verticalAlign="bottom"
          wrapperStyle={{ paddingTop: 15 }}
          onClick={({ value: clickedTeam }) => {
            setTeam(team === clickedTeam ? null : clickedTeam);
          }}
        />
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
            data={data.historic.filter((d) => d.issue.team.name === team)}
            fill={colorByTeam(team)}
            onClick={(event) => {
              window.open(event.payload.issue.url, '_blank');
            }}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
