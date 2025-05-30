import type { FC } from 'react';
import React, { useState } from 'react';

import { CanObservable } from '../../hooks/useCanObservable/useCanObservable.js';
import { useCanObservable } from '../../hooks/useCanObservable';

import type { DerivedIssue } from '../../../jira/derived/derive';

import { bestFitRanges } from '../../../utils/date/best-fit-ranges.js';
import { EpicEstimatesScatter } from './EstimateVsActualScatter.js';

import { getTeamTimingData } from '../../../jira/rollup/historical-adjusted-estimated-time/actual-vs-estimated';
import { TeamEstimateAccuracyHistogram } from './TeamEstimateAccuracyHistogram';
import { TeamEstimateAccuracyVariance } from './TeamEstimateAccuracyVariance';
import { TeamMeanVsVarianceScatter } from './TeamMeanVsVarianceScatter';

type RolledUpIssue = DerivedIssue & {
  completionRollup: { totalWorkingDays: number };
  historicalAdjustedEstimatedTime: Array<{ historicalAdjustedEstimatedTime: number; teamName: String }>;
};

type ObservableOfIssues = CanObservable<Array<RolledUpIssue>>;

function getTeamNames(issues: Array<RolledUpIssue>) {
  const teamNames = new Set();
  for (let issue of issues) {
    for (let teamRecord of issue.historicalAdjustedEstimatedTime) {
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

const headerClassNames = 'font-bold sticky top-0 bg-white p-1';

export const EstimateAnalysis: FC<{
  primaryIssuesOrReleasesObs: CanObservable<Array<RolledUpIssue>>;
  allIssuesOrReleasesObs: ObservableOfIssues;
  rollupTimingLevelsAndCalculationsObs: CanObservable<any[]>;
}> = ({ primaryIssuesOrReleasesObs, allIssuesOrReleasesObs, rollupTimingLevelsAndCalculationsObs }) => {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const primary = useCanObservable(primaryIssuesOrReleasesObs);
  const allIssues = useCanObservable(allIssuesOrReleasesObs);
  const rollupTimingLevelsAndCalculations = useCanObservable(rollupTimingLevelsAndCalculationsObs);

  if (!allIssues?.length) {
    return <div>Loading ...</div>;
  }

  const teamTimings = getTeamTimingData(primary);

  return (
    <div className="pb-8">
      <h2 className="text-xl font-bold mb-2">Team Estimation Table</h2>
      <p className="py-1">The following table shows how many estimated "team days" per day each team completed.</p>
      <TeamEstimateAccuracyVariance
        teamTimings={teamTimings}
        team={selectedTeam}
        setTeam={setSelectedTeam}
      ></TeamEstimateAccuracyVariance>

      <h2 className="text-xl font-bold mb-2">Team Accuracy and Precision</h2>
      <p>
        Compare team estimation accuracy vs precision. Teams in green are both accurate and precise. Teams in yellow are
        precise but not accurate. Teams in blue are accurate but not precise.{' '}
      </p>
      <TeamMeanVsVarianceScatter
        teamTimings={teamTimings}
        team={selectedTeam}
        setTeam={setSelectedTeam}
      ></TeamMeanVsVarianceScatter>

      <h2 className="text-xl font-bold pt-2">Estimate vs Actual Scatterplot</h2>
      <p>
        Estimated amount of total team work compared to actual amount of team work. Issues on the top left took less
        team-time than estimated, issues on the bottom right took more team time than estimated.
      </p>

      <EpicEstimatesScatter
        teamTimings={teamTimings}
        team={selectedTeam}
        setTeam={setSelectedTeam}
      ></EpicEstimatesScatter>

      <h2 className="text-xl font-bold">Actual / Estimate Histogram</h2>
      <p>
        A grouping of issues by their <code>Actual / Estimate</code> ratio presented exponentially. If this looks like a
        bell curve, it means the underlying distribution is log-normal.
      </p>
      <TeamEstimateAccuracyHistogram
        teamTimings={teamTimings}
        team={selectedTeam}
        setTeam={setSelectedTeam}
      ></TeamEstimateAccuracyHistogram>
    </div>
  );
};

type TeamEffortMap = Record<string, Map<string, number>>;

interface WorkGridResult {
  highest: number;
  startDate: Date;
  endDate: Date;
  workGrid: { team: string; values: number[] }[];
  sortedDates: Date[];
}

type JiraIssue = DerivedIssue['issue'];

function extractJiraSummary(issue: JiraIssue, minDate: string) {
  const min = new Date(minDate);

  return {
    key: issue.key,
    summary: issue.fields['Summary'],
    issueType: issue.fields['Issue Type']?.name,
    created: issue.fields['Created'],
    status: issue.fields['Status']?.name,
    storyPoints: issue.fields['Story points median'],
    labels: issue.fields['Labels'],
    dueDate: issue.fields['Due date'],
    startDate: issue.fields['Start date'],
    rank: issue.fields['Rank'],
    changelog: (issue.changelog || [])
      .filter((entry) => new Date(entry.created) >= min)
      .map((entry) => ({
        //author: entry.author?.displayName,
        created: entry.created,
        items: entry.items.map((item) => ({
          field: item.field,
          from: item.fromString,
          to: item.toString,
        })),
      })),
  };
}
