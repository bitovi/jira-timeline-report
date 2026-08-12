import React from 'react';
import type { StatsUIData } from '../scheduler/stats-analyzer';
import { buildCriticalPaths, type CriticalPathRow } from './build-critical-paths';

interface CriticalPathsReportProps {
  uiData: StatsUIData;
  workItemsToHighlight: Set<string> | null;
  setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}

const SERIES_WORK = '#0c66e4';
const SERIES_QUEUED = '#b65c02';

function chainKeys(row: CriticalPathRow): Set<string> {
  return new Set([...row.chain.map((wi) => wi.linkedIssue.key), ...row.fanOut.map((wi) => wi.linkedIssue.key)]);
}

function chainSummaryText(row: CriticalPathRow): string {
  const first = row.chain[0].linkedIssue.summary;
  if (row.chain.length === 1) return first;
  const last = row.chain[row.chain.length - 1].linkedIssue.summary;
  return `${first} → … → ${last}`;
}

export const CriticalPathsReport: React.FC<CriticalPathsReportProps> = ({
  uiData,
  workItemsToHighlight,
  setWorkItemsToHighlight,
}) => {
  const rows = React.useMemo(() => buildCriticalPaths(uiData), [uiData]);
  const maxTotalDays = Math.max(1, ...rows.map((row) => row.totalDays));

  function isExpanded(row: CriticalPathRow): boolean {
    if (!workItemsToHighlight) return false;
    const rowKeys = chainKeys(row);
    return rowKeys.size === workItemsToHighlight.size && [...rowKeys].every((key) => workItemsToHighlight.has(key));
  }

  function onToggle(row: CriticalPathRow, event: React.SyntheticEvent<HTMLDetailsElement>) {
    const open = event.currentTarget.open;
    setWorkItemsToHighlight(open ? chainKeys(row) : null);
  }

  return (
    <div className="bg-white border border-neutral-30 rounded shadow-sm mt-4">
      <div className="px-4 py-3 border-b border-neutral-30">
        <p className="font-bold text-base">Critical Paths (new)</p>
        <p className="text-xs text-neutral-500">
          The chains that decide when this plan finishes. Ranked by how often each one drove the finish date across the
          simulation.
        </p>
      </div>

      <div
        className="px-4 pt-1 pb-2 border-b border-neutral-30 text-[11px] font-semibold text-neutral-500 uppercase"
        style={{ display: 'grid', gridTemplateColumns: '14px 14px 36px minmax(0, 1fr) 130px 48px', columnGap: 10 }}
      >
        <span style={{ gridColumn: '1 / span 3' }}>Criticality index</span>
        <span>Critical path</span>
        <span className="flex gap-2 text-[10px] font-medium normal-case text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_WORK }} /> Work
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_QUEUED }} /> Queued
          </span>
        </span>
        <span className="text-right">Total days</span>
      </div>

      {rows.map((row, idx) => (
        <details
          key={row.rootKey}
          open={isExpanded(row)}
          onToggle={(e) => onToggle(row, e)}
          className="border-b border-neutral-30 last:border-b-0"
        >
          <summary
            className="cursor-pointer px-4 py-2 hover:bg-neutral-20"
            style={{
              display: 'grid',
              gridTemplateColumns: '14px 14px 36px minmax(0, 1fr) 130px 48px',
              columnGap: 10,
              alignItems: 'center',
            }}
          >
            <span className="text-right text-xs text-neutral-500">{idx + 1}</span>
            <span className="text-right text-sm font-semibold">{Math.round(row.criticalityIndex * 100)}%</span>
            <span />
            <span className="truncate text-sm text-blue-600">{chainSummaryText(row)}</span>
            <span className="flex h-2" style={{ width: `${Math.round((row.totalDays / maxTotalDays) * 100)}%` }}>
              <span style={{ flex: row.totalWorkDays || 0.0001, background: SERIES_WORK }} />
              {row.totalQueuedDays > 0 && (
                <span style={{ flex: row.totalQueuedDays, background: SERIES_QUEUED, marginLeft: 2 }} />
              )}
            </span>
            <span className="text-right text-sm text-neutral-500">{Math.round(row.totalDays)} d</span>
          </summary>

          <div className="px-4 pb-4 pl-10 grid gap-3">
            <div>
              <div className="text-xs text-neutral-500">Full chain</div>
              <div className="text-sm">
                {row.chain.map((wi, i) => (
                  <React.Fragment key={wi.linkedIssue.key}>
                    {i > 0 && <span className="mx-1 text-neutral-400">→</span>}
                    <a className="text-blue-600" href={wi.linkedIssue.url} target="_blank" rel="noopener noreferrer">
                      {wi.linkedIssue.summary}
                    </a>
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Biggest epic by days of work</div>
              <div className="text-sm">
                {row.biggestByWork.linkedIssue.summary} — {Math.round(row.biggestByWork.meanWorkDays)} days
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Biggest epic by queued delay</div>
              <div className="text-sm">
                {row.biggestByQueuedDelay.linkedIssue.summary} — {Math.round(row.biggestByQueuedDelay.meanQueuedDays)}{' '}
                days queued behind other plan work
              </div>
            </div>
            {row.fanOut.length > 0 && (
              <div>
                <div className="text-xs text-neutral-500">
                  Other epics blocked by this chain · {Math.round(row.fanOutTotalDays)} days total
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {row.fanOut.map((wi) => (
                    <a
                      key={wi.linkedIssue.key}
                      className="text-xs bg-neutral-10 border border-neutral-30 rounded px-1.5 py-0.5 text-blue-600"
                      href={wi.linkedIssue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {wi.linkedIssue.summary}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
};
