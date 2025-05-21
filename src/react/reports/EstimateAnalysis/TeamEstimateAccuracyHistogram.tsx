import {colorByTeam} from "./color-by-team";
import type { ComputedIssueTiming, TeamTimings } from "../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated";


import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';


// TODO, move
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #ccc', padding: 10, maxWidth: 300 }}>
      <strong>{label}</strong>
      {payload.map((entry: any) => {
        const team = entry.name;
        const issues = entry.payload[`__issues_${team}`] as ComputedIssueTiming[];
        if (!issues) return null;

        return (
          <div key={team} style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 'bold', color: entry.color }}>{team}</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {issues.map((issue) => (
                <li key={issue.key}>
                  {issue.key} - {issue.issue.summary}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
// ({issue.computedDaysOfWork.toFixed(1)} / {issue.deterministicTotalDaysOfWork.toFixed(1)})



// Build histogram bins for team issue counts
// Build histogram bins for team issue counts with attached issue data
function buildTeamCountHistogramWithIssues(
  issues: ComputedIssueTiming[],
  binCount = 12
) {
  const bins: Record<string, Record<string, any>> = {};

  const validRatios = issues
    .filter(issue => issue.estimatedTeamDays > 0)
    .map(issue => issue.computedActualTeamDaysOfWork / issue.estimatedTeamDays)
    .filter(r => r > 0);

  if (validRatios.length === 0) return [];

  const minRatio = Math.min(...validRatios);
  const maxRatio = Math.max(...validRatios);

  const logMin = Math.log10(minRatio);
  const logMax = Math.log10(maxRatio);
  const logStep = (logMax - logMin) / binCount;

  // Define exponential bin edges and labels
  const binEdges: number[] = [];
  const binLabels: string[] = [];
  for (let i = 0; i < binCount; i++) {
    const start = Math.pow(10, logMin + i * logStep);
    const end = Math.pow(10, logMin + (i + 1) * logStep);
    binEdges.push(start);
    const label = `${start.toFixed(2)}–${end.toFixed(2)}`;
    binLabels.push(label);
    bins[label] = {};
  }

  for (const issue of issues) {
    if (issue.estimatedTeamDays <= 0) continue;

    const ratio = issue.computedActualTeamDaysOfWork / issue.estimatedTeamDays;
    const team = issue.issue.team.name;

    // Find correct exponential bin index
    let binIndex = binEdges.findIndex((start, i) => {
      const end = i < binEdges.length - 1 ? binEdges[i + 1] : Infinity;
      return ratio >= start && ratio < end;
    });
    if (binIndex === -1) binIndex = binCount - 1;

    const label = binLabels[binIndex];
    bins[label][team] = (bins[label][team] || 0) + 1;

    const key = `__issues_${team}`;
    if (!bins[label][key]) bins[label][key] = [];
    bins[label][key].push(issue);
  }

  return Object.entries(bins).map(([bin, teamData]) => ({
    bin,
    ...teamData,
  }));
}

interface Props {
  teamTimings: TeamTimings;
  team: string | null;
  setTeam: React.Dispatch<React.SetStateAction<string|null>>;
}

export const TeamEstimateAccuracyHistogram: React.FC<Props> = 
  ({ teamTimings, team, setTeam }) => {

    const allIssueTimings = teamTimings.map( teamTiming => teamTiming.computedIssueTimings ).flat(1);

    const data = buildTeamCountHistogramWithIssues(allIssueTimings);
    const teams = Array.from(new Set(allIssueTimings.map(i => i.issue.team.name))).sort();


  return (
    <ResponsiveContainer width="100%" height={500}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="bin" />
        <YAxis allowDecimals={false} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }}  content={<CustomTooltip />} />
       <Legend onClick={({value: clickedTeam}) => {
                       setTeam(team === clickedTeam ? null : clickedTeam)
                   }}/>
        {teams.map(team => (
          <Bar
            key={team}
            dataKey={team}
            stackId="a"
            fill={colorByTeam(team)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};