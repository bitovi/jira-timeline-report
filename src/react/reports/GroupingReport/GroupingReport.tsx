/**
 * GroupingReport is a React component that enables users to group issues and issue data by various fields such as
 * parent, dates or labels and sum or roll up data for the groups.
 */
import React from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { groupAndAggregate } from './groupAndAggregate';

import type { WithRollups } from '../../../jira/rolledup-and-rolledback/rollup-and-rollback';
import Link from '@atlaskit/link';

// Define RolledUpIssue and ObservableOfIssues types for prop typing
import type { DerivedIssue } from '../../../jira/derived/derive';
type RolledUpIssue = DerivedIssue & WithRollups;
type ObservableOfIssues = CanObservable<Array<RolledUpIssue>>;

interface GroupingReportProps {
  primaryIssuesOrReleasesObs: CanObservable<Array<RolledUpIssue>>;
  allIssuesOrReleasesObs: ObservableOfIssues;
  rollupTimingLevelsAndCalculationsObs: CanObservable<any[]>;
}

export const GroupingReport: React.FC<GroupingReportProps> = ({
  primaryIssuesOrReleasesObs,
  allIssuesOrReleasesObs,
  rollupTimingLevelsAndCalculationsObs,
}) => {
  const primaryIssues = useCanObservable(primaryIssuesOrReleasesObs) || [];

  const result = groupAndAggregate(
    primaryIssues,
    [
      (issue) => {
        if (!issue.rollupDates.due) return { key: 'yearQuarter', value: null };
        return { key: 'yearQuarter', value: getYearQuarter(issue.rollupDates.due) };
      },
      (issue) => {
        return { key: 'parent', value: issue.issue.fields?.Parent?.fields?.summary || 'No Parent' };
      },
    ],
    [groupAllIssues],
  );

  console.log({ result });

  // Compute unique sorted quarters and parents
  const quarters = Array.from(
    new Set(result.filter((group) => group.yearQuarter !== null).map((group) => group.yearQuarter as string)),
  ).sort((a, b) => {
    const [aYear, aQ] = a.split('-Q');
    const [bYear, bQ] = b.split('-Q');
    const yearDiff = Number(aYear) - Number(bYear);
    if (yearDiff !== 0) return yearDiff;
    return Number(aQ) - Number(bQ);
  });
  const parents = Array.from(new Set(result.map((group) => group.parent as string)));

  // Build a lookup: { [parent]: { [quarter]: issues[] } }
  const grid: Record<string, Record<string, RolledUpIssue[]>> = {};
  for (const group of result) {
    if (group.yearQuarter === null) continue;
    const parent = group.parent as string;
    const quarter = group.yearQuarter as string;
    if (!grid[parent]) grid[parent] = {};
    grid[parent][quarter] = group.issues as RolledUpIssue[];
  }

  // CSS grid rendering for parent/quarter matrix
  return (
    <div className="overflow-x-auto py-4">
      <div
        className="grid border bg-white"
        style={{
          gridTemplateColumns: `200px repeat(${quarters.length}, minmax(200px, 1fr))`,
          gridAutoRows: 'minmax(40px,auto)',
        }}
      >
        {/* Header row */}
        <div
          className="font-bold p-2 bg-gray-50 sticky left-0 z-10 border-b border-r"
          style={{ gridRow: 1, gridColumn: 1 }}
        >
          Parent
        </div>
        {quarters.map((q, i) => (
          <div
            key={q}
            className="font-bold p-2 text-center bg-gray-50 border-b border-r"
            style={{ gridRow: 1, gridColumn: i + 2 }}
          >
            {q}
          </div>
        ))}
        {/* Parent rows and cells */}
        {parents.map((parent, rowIdx) => (
          <React.Fragment key={parent}>
            {/* Parent label cell */}
            <div
              className="font-semibold p-2 bg-gray-50 sticky left-0 z-10 border-r border-b"
              style={{ gridRow: rowIdx + 2, gridColumn: 1 }}
            >
              {parent}
            </div>
            {/* Issue cells for each quarter */}
            {quarters.map((q, colIdx) => (
              <div
                key={q}
                className="align-top p-2 min-w-[200px] border-b border-r"
                style={{ gridRow: rowIdx + 2, gridColumn: colIdx + 2 }}
              >
                <ul className="list-disc list-inside">
                  {(grid[parent]?.[q] || []).map((issue) => (
                    <li key={issue.key}>
                      <a
                        href={issue.url}
                        className="hover:text-blue-600 hover:underline cursor-pointer"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {issue.summary}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default GroupingReport;

const groupAllIssues = {
  name: 'issues',
  initial: () => [] as RolledUpIssue[],
  update: (acc: RolledUpIssue[], item: RolledUpIssue) => {
    acc.push(item);
    return acc;
  },
};

function getYearQuarter(date: Date): string {
  const year = date.getFullYear();
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}
