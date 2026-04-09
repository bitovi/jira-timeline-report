import React, { useEffect, useMemo } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { DerivedIssue } from '../../../jira/derived/derive';
import { calculateTimeInStatus } from './data/calculateTimeInStatus';
import { aggregateTimeByStatus } from './data/aggregateTimeByStatus';
import { buildStatusCategoryMap } from './data/buildStatusCategoryMap';
import { aggregateTimeByCategory } from './data/aggregateTimeByCategory';
import { TimeInStatusCell } from './components/TimeInStatusCell';

interface FlowMetricsProps {
  filteredDerivedIssuesObs: CanObservable<DerivedIssue[]>;
}

const CATEGORY_ORDER: Record<string, number> = {
  'to do': 0,
  'in progress': 1,
  done: 2,
};

function categoryOrder(cat: string): number {
  return CATEGORY_ORDER[cat.toLowerCase()] ?? 99;
}

const CATEGORY_COLORS: Record<string, { header: string; subheader: string; total: string }> = {
  'to do': {
    header: 'bg-neutral-200 text-neutral-700',
    subheader: 'bg-neutral-100 text-neutral-500',
    total: 'bg-neutral-100',
  },
  'in progress': {
    header: 'bg-blue-100 text-blue-700',
    subheader: 'bg-blue-50 text-blue-500',
    total: 'bg-blue-50',
  },
  done: {
    header: 'bg-green-100 text-green-700',
    subheader: 'bg-green-50 text-green-500',
    total: 'bg-green-50',
  },
};

function categoryColors(cat: string) {
  return (
    CATEGORY_COLORS[cat.toLowerCase()] ?? {
      header: 'bg-purple-100 text-purple-700',
      subheader: 'bg-purple-50 text-purple-500',
      total: 'bg-purple-50',
    }
  );
}

export function FlowMetrics({ filteredDerivedIssuesObs }: FlowMetricsProps) {
  const issues = useCanObservable(filteredDerivedIssuesObs) ?? [];

  const categoryMap = useMemo(() => buildStatusCategoryMap(issues), [issues]);

  const issueRows = useMemo(
    () =>
      issues.map((issue) => {
        const periods = calculateTimeInStatus(issue);
        const byStatus = aggregateTimeByStatus(periods);
        const byCategory = aggregateTimeByCategory(byStatus, categoryMap);
        return { issue, byStatus, byCategory };
      }),
    [issues, categoryMap],
  );

  // Debug: log statuses whose category can't be determined
  useEffect(() => {
    for (const { issue, byStatus } of issueRows) {
      for (const statusName of Object.keys(byStatus)) {
        if (!categoryMap[statusName]) {
          console.log(
            `[FlowMetrics] Unknown category — issue: ${issue.key}, status: "${statusName}". ` +
              `This status does not appear as the current status of any issue in the dataset, ` +
              `so its Jira category is unavailable.`,
          );
        }
      }
    }
  }, [issueRows, categoryMap]);

  // Build category groups (sorted, excluding Unknown)
  const categoryGroups = useMemo(() => {
    const catToStatuses = new Map<string, Set<string>>();

    for (const { byStatus } of issueRows) {
      for (const statusName of Object.keys(byStatus)) {
        const cat = categoryMap[statusName];
        if (!cat) continue; // skip Unknown
        if (!catToStatuses.has(cat)) catToStatuses.set(cat, new Set());
        catToStatuses.get(cat)!.add(statusName);
      }
    }

    return Array.from(catToStatuses.entries())
      .map(([category, statuses]) => ({
        category,
        statuses: Array.from(statuses).sort(),
        colors: categoryColors(category),
      }))
      .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
  }, [issueRows, categoryMap]);

  if (issues.length === 0) {
    return <div className="p-4 text-neutral-40">No issues to display.</div>;
  }

  const FIXED_COLS = 4;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          {/* Row 1 — category group headers */}
          <tr className="border-b border-neutral-200 text-left text-xs font-semibold">
            <th className="bg-neutral-50 px-3 py-2 whitespace-nowrap text-neutral-600">Key</th>
            <th className="bg-neutral-50 px-3 py-2 text-neutral-600">Summary</th>
            <th className="bg-neutral-50 px-3 py-2 whitespace-nowrap text-neutral-600">Type</th>
            <th className="bg-neutral-50 px-3 py-2 whitespace-nowrap text-neutral-600">Current Status</th>
            {categoryGroups.map(({ category, statuses, colors }) => (
              <th
                key={category}
                colSpan={statuses.length + 1}
                className={`px-3 py-2 text-center whitespace-nowrap border-l border-neutral-200 ${colors.header}`}
              >
                {category}
              </th>
            ))}
          </tr>
          {/* Row 2 — individual status sub-headers + Total */}
          <tr className="border-b border-neutral-200 text-left text-xs">
            {Array.from({ length: FIXED_COLS }).map((_, i) => (
              <th key={i} className="bg-neutral-50 px-3 py-2" />
            ))}
            {categoryGroups.map(({ category, statuses, colors }) =>
              statuses
                .map((status) => (
                  <th
                    key={`${category}-${status}`}
                    className={`px-3 py-2 text-center font-normal whitespace-nowrap border-l border-neutral-200 first:border-l ${colors.subheader}`}
                  >
                    {status}
                  </th>
                ))
                .concat(
                  <th
                    key={`${category}-total`}
                    className={`px-3 py-2 text-center font-semibold whitespace-nowrap border-l border-neutral-200 ${colors.subheader}`}
                  >
                    Total
                  </th>,
                ),
            )}
          </tr>
        </thead>
        <tbody>
          {issueRows.map(({ issue, byStatus, byCategory }) => (
            <tr key={issue.key} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-3 py-2 whitespace-nowrap">
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono text-xs"
                >
                  {issue.key}
                </a>
              </td>
              <td className="px-3 py-2 max-w-xs truncate" title={issue.summary}>
                {issue.summary}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{issue.type}</td>
              <td className="px-3 py-2 whitespace-nowrap">{issue.status ?? '—'}</td>
              {categoryGroups.map(({ category, statuses, colors }) =>
                statuses
                  .map((status) => (
                    <td key={`${category}-${status}`} className={`px-3 py-2 text-center border-l border-neutral-200`}>
                      {byStatus[status] ? (
                        <TimeInStatusCell totalMs={byStatus[status].totalMs} periods={byStatus[status].periods} />
                      ) : (
                        <span className="text-neutral-40">—</span>
                      )}
                    </td>
                  ))
                  .concat(
                    <td
                      key={`${category}-total`}
                      className={`px-3 py-2 text-center border-l border-neutral-200 ${colors.total}`}
                    >
                      {byCategory[category] ? (
                        <TimeInStatusCell
                          totalMs={byCategory[category].totalMs}
                          periods={byCategory[category].periods}
                        />
                      ) : (
                        <span className="text-neutral-40">—</span>
                      )}
                    </td>,
                  ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
