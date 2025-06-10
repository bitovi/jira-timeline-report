/**
 * GroupingReport is a React component that enables users to group issues and issue data by various fields such as
 * parent, dates or labels and sum or roll up data for the groups.
 */
import React from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { groupAndAggregate } from './data/groupAndAggregate';
import { createStableObjectKey } from './data/group';

import { quarterGrouper, parentGrouper } from './ui/grouper';
import type { Grouper } from './ui/grouper';

// Define RolledUpIssue and ObservableOfIssues types for prop typing
import type { RolledUpIssue } from './ui/grouper';

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

  // Hardcoded groupers array for 2D abstraction
  const groupers = [quarterGrouper, parentGrouper];

  // Build groupByKeys for groupAndAggregate
  const groupByKeys = groupers.map((g) => g.groupByKey);
  const result = groupAndAggregate(primaryIssues, groupByKeys, [groupAllIssues]);

  // For 2D: columns = groupers[0], rows = groupers[1]
  const [colGrouper, rowGrouper] = groupers;

  const { values: cols, titles: colTitles } = getAxisValues<string | null>(result, colGrouper);
  const { values: rowObjs, titles: rowTitles } = getAxisValues<{ key: string; summary: string }>(result, rowGrouper);

  // Build a lookup: { [rowKey]: { [col]: issues[] } }
  const grid = buildGrid(result, colGrouper, rowGrouper);

  // CSS grid rendering for row/col matrix
  return (
    <div className="overflow-x-auto py-4">
      <div
        className="grid border bg-white"
        style={{
          gridTemplateColumns: `200px repeat(${cols.length}, minmax(200px, 1fr))`,
          gridAutoRows: 'minmax(40px,auto)',
        }}
      >
        {/* Header row */}
        <div
          className="font-bold p-2 bg-gray-50 sticky left-0 z-10 border-b border-r"
          style={{ gridRow: 1, gridColumn: 1 }}
        >
          {rowGrouper.label}
        </div>
        {cols.map((c, i) => (
          <div
            key={String(c)}
            className="font-bold p-2 text-center bg-gray-50 border-b border-r"
            style={{ gridRow: 1, gridColumn: i + 2 }}
          >
            {colTitles[i]}
          </div>
        ))}
        {/* Row labels and cells */}
        {rowObjs.map((rowObj, rowIdx) => (
          <React.Fragment key={rowObj.key}>
            {/* Row label cell */}
            <div
              className="font-semibold p-2 bg-gray-50 sticky left-0 z-10 border-r border-b"
              style={{ gridRow: rowIdx + 2, gridColumn: 1 }}
            >
              {rowTitles[rowIdx]}
            </div>
            {/* Issue cells for each column */}
            {cols.map((c, colIdx) => (
              <div
                key={String(c)}
                className="align-top p-2 min-w-[200px] border-b border-r"
                style={{ gridRow: rowIdx + 2, gridColumn: colIdx + 2 }}
              >
                <ul className="list-disc list-inside">
                  {(grid[rowObj.key]?.[c as string] || []).map((issue: RolledUpIssue) => (
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

/**
 * Returns only unique values from an array, using createStableObjectKey for objects and Set for primitives.
 */
function getUniqueValues<T>(values: T[]): T[] {
  if (values.length > 0 && typeof values[0] === 'object') {
    return Array.from(new Map(values.map((v) => [createStableObjectKey(v as any), v])).values());
  } else {
    return Array.from(new Set(values));
  }
}

// Helper to extract axis values (unique, sorted, filled, titled)
function getAxisValues<GroupValueType>(result: any[], grouper: Grouper) {
  const key = grouper.groupByKey.key;
  // filter out nulls (not sure we want this, but keeping for now)
  const rawValues = result.map((group) => group[key] as GroupValueType).filter((v) => v !== null);

  let values = getUniqueValues(rawValues);
  if (grouper.sort) {
    values.sort(grouper.sort as any);
  }
  if (grouper.fillGaps) {
    values = (grouper.fillGaps as any)(values);
  }
  const titles = grouper.titles(values);
  return { values, titles };
}

/**
 * Builds a 2D grid lookup from grouped results, using the provided groupers and getGroupValue helper.
 */
function buildGrid(
  result: any[],
  colGrouper: Grouper,
  rowGrouper: Grouper,
): Record<string, Record<string, RolledUpIssue[]>> {
  const grid: Record<string, Record<string, RolledUpIssue[]>> = {};
  for (const group of result) {
    const colValue = getGroupValue(group, colGrouper);
    if (colValue === null) continue;
    const rowValue = getGroupValue(group, rowGrouper);
    const rowKey = rowValue && typeof rowValue === 'object' ? rowValue.key : rowValue;
    const col = colValue as string;
    if (!grid[rowKey]) grid[rowKey] = {};
    grid[rowKey][col] = group.issues as RolledUpIssue[];
  }
  return grid;
}

/**
 * Helper to extract group value for a given grouper from a group object.
 */
function getGroupValue(group: any, grouper: Grouper) {
  const key = grouper.groupByKey.key;
  return group[key];
}
