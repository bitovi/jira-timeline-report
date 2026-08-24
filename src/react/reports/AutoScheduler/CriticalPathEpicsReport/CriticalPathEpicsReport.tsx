import React from 'react';
import type { StatsUIData } from '../scheduler/stats-analyzer';
import { buildCriticalPathEpics, highlightKeysFor } from './build-critical-path-epics';

interface CriticalPathEpicsReportProps {
  uiData: StatsUIData;
  /** Controlled by `AutoScheduler`: expanding restarts the simulation with tracking on. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  workItemsToHighlight: Set<string> | null;
  setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}

/** Routes shown for context. The epic table beside it carries the ranking, so this can be short. */
const ROUTES_SHOWN = 5;
/** Epic rows listed before the tail is folded into one residual row. */
const EPIC_ROWS_SHOWN = 10;

export const CriticalPathEpicsReport: React.FC<CriticalPathEpicsReportProps> = ({
  uiData,
  expanded,
  onExpandedChange,
  workItemsToHighlight,
  setWorkItemsToHighlight,
}) => {
  return (
    <div className="bg-white border border-neutral-30 rounded shadow-sm mt-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => onExpandedChange(!expanded)}
        className="w-full text-left px-4 py-3 hover:bg-neutral-20"
      >
        <p className="font-bold text-base">
          <span className="mr-2 text-neutral-500">{expanded ? '▾' : '▸'}</span>
          Epics on the critical path
        </p>
        <p className="text-xs text-neutral-500">
          Ranked by the days each adds · ignoring team contention · average of all simulation runs
        </p>
      </button>
      {/* Rendered conditionally, not hidden: nothing should sort or map while collapsed. */}
      {expanded && (
        <CriticalPathEpicsBody
          uiData={uiData}
          workItemsToHighlight={workItemsToHighlight}
          setWorkItemsToHighlight={setWorkItemsToHighlight}
        />
      )}
    </div>
  );
};

const CriticalPathEpicsBody: React.FC<{
  uiData: StatsUIData;
  workItemsToHighlight: Set<string> | null;
  setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}> = ({ uiData, workItemsToHighlight, setWorkItemsToHighlight }) => {
  const criticalPath = uiData.criticalPath;
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const highlightWeWrote = React.useRef<Set<string> | null>(null);

  // `CriticalPathsReport` and the Gantt write to the same shared set. When one of them does, this
  // report's row selection no longer describes what the grid is showing, so it is dropped. Fully
  // deriving the selection instead would mean sorting every path on every render.
  React.useEffect(() => {
    if (workItemsToHighlight !== highlightWeWrote.current) setSelectedKey(null);
  }, [workItemsToHighlight]);

  const allRows = React.useMemo(() => buildCriticalPathEpics(uiData), [uiData]);
  const rows = allRows.slice(0, EPIC_ROWS_SHOWN);
  const otherRows = allRows.slice(EPIC_ROWS_SHOWN);
  const otherRowDaysAdded = otherRows.reduce((sum, row) => sum + row.daysAdded, 0);

  /** Routes carry keys only, so readable labels have to come back from the simulation results. */
  const summaryByKey = React.useMemo(
    () => new Map(uiData.simulationIssueResults.map((r) => [r.linkedIssue.key, r.linkedIssue.summary])),
    [uiData],
  );

  const { routes, otherRouteCount, otherRouteRuns } = React.useMemo(() => {
    // Hidden, not dimmed: with a hundred epics on screen a dimmed row is still noise, and the
    // point of the click is to isolate the blocking chain. Asks for every route rather than the
    // top five so a rarely-winning route containing the selected epic is not lost behind them.
    const matching = selectedKey
      ? criticalPath.topPaths(Number.POSITIVE_INFINITY).filter((path) => path.keys.includes(selectedKey))
      : null;
    const shown = (matching ?? criticalPath.topPaths(ROUTES_SHOWN)).slice(0, ROUTES_SHOWN);
    const shownRuns = shown.reduce((sum, path) => sum + path.count, 0);
    return {
      routes: shown,
      otherRouteCount: (matching ? matching.length : criticalPath.distinctPathCount) - shown.length,
      otherRouteRuns:
        (matching ? matching.reduce((sum, path) => sum + path.count, 0) : criticalPath.iterations) - shownRuns,
    };
  }, [criticalPath, selectedKey]);

  function onRowClick(key: string) {
    if (selectedKey === key) {
      setSelectedKey(null);
      highlightWeWrote.current = null;
      setWorkItemsToHighlight(null);
      return;
    }
    setSelectedKey(key);
    // Every route, not just the five shown: an epic can sit on a rare route and would otherwise
    // highlight only itself while still reporting a non-zero percentage. Clicks are rare, so
    // paying for the full sort here is cheap.
    const keys = highlightKeysFor(criticalPath.topPaths(Number.POSITIVE_INFINITY), key);
    highlightWeWrote.current = keys;
    setWorkItemsToHighlight(keys);
  }

  // Share of every run, not of the routes shown — otherwise a route that wins 41 of 10,000 runs
  // would read as a majority just because it tops a short list.
  const percentOfRuns = (count: number) =>
    criticalPath.iterations === 0 ? 0 : Math.round((count / criticalPath.iterations) * 100);
  const routeLabel = (keys: string[]) => keys.map((key) => summaryByKey.get(key) ?? key).join(' → ');

  return (
    <div className="flex gap-4 p-4 pt-0 items-start">
      <div className="flex-1 min-w-0 border-t border-neutral-30">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] font-semibold text-neutral-500 uppercase">
              <th className="px-4 py-2 text-left font-semibold">Epic</th>
              <th className="px-4 py-2 text-right font-semibold">Days added</th>
              <th className="px-4 py-2 text-right font-semibold">How often on the critical path</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={selectedKey === row.key ? 'bg-blue-50' : undefined}>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    className="text-blue-600 text-left hover:underline"
                    onClick={() => onRowClick(row.key)}
                  >
                    {row.summary}
                  </button>
                  <span className="text-neutral-500"> · {row.teamName}</span>
                </td>
                <td className="px-4 py-2 text-right font-semibold">{row.daysAdded.toFixed(1)}</td>
                <td className="px-4 py-2 text-right">{Math.round(row.onPathIndex * 100)}%</td>
              </tr>
            ))}
          </tbody>
          {otherRows.length > 0 && (
            // Keeps the column honest: the listed values plus this one still add up to the footer.
            <tbody>
              <tr className="text-neutral-500">
                <td className="px-4 py-2">{otherRows.length} other epics</td>
                <td className="px-4 py-2 text-right">{otherRowDaysAdded.toFixed(1)}</td>
                <td />
              </tr>
            </tbody>
          )}
          <tfoot>
            <tr className="border-t border-neutral-30">
              <td className="px-4 py-2">Critical path length</td>
              <td className="px-4 py-2 text-right">{criticalPath.meanLength.toFixed(1)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border border-neutral-30 rounded w-72 shrink-0">
        <div className="px-4 py-3 border-b border-neutral-30">
          <p className="font-bold text-base">Most common critical paths</p>
          <p className="text-xs text-neutral-500">Context only — the table on the left carries the ranking</p>
        </div>
        <div className="px-4 py-2 grid gap-2">
          {routes.map((path) => (
            <div key={path.keys.join('>')} className="text-xs">
              <span className="font-semibold mr-2">{percentOfRuns(path.count)}%</span>
              <span className="text-neutral-600">{routeLabel(path.keys)}</span>
            </div>
          ))}
          {otherRouteCount > 0 && (
            // Also the only cue that a click filtered the list, since non-matching routes vanish.
            <div className="text-xs text-neutral-500">
              <span className="font-semibold mr-2">{percentOfRuns(otherRouteRuns)}%</span>
              <span>
                {otherRouteCount} other route{otherRouteCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
