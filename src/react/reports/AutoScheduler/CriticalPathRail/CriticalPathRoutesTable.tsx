import type { PathFrequency } from '../scheduler/critical-path-accumulator';
import type { CriticalPathSelection } from './criticalPathSelection';

import React from 'react';
import { InfoTooltip, ColumnLabel } from './InfoTooltip';
import { isRouteLit, routeId } from './criticalPathSelection';

export const ROUTE_ROWS_SHOWN = 5;

export interface CriticalPathRoutesTableProps {
  /** Already sorted, from `topPaths(Infinity)`. */
  routes: PathFrequency[];
  iterations: number;
  labelFor: (keys: string[]) => string;
  selection: CriticalPathSelection;
  onSelectRoute: (id: string) => void;
  /** True while the simulation is still running — rankings only stop shifting once it completes. */
  disabled: boolean;
}

export const CriticalPathRoutesTable: React.FC<CriticalPathRoutesTableProps> = ({
  routes,
  iterations,
  labelFor,
  selection,
  onSelectRoute,
  disabled,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // On a short viewport the other table is below the fold, so a selection made there would
  // otherwise light rows nobody can see.
  React.useEffect(() => {
    scrollAreaRef.current?.querySelector('[data-lit]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selection]);

  const hidden = routes.slice(ROUTE_ROWS_SHOWN);
  const shown = expanded ? routes : routes.slice(0, ROUTE_ROWS_SHOWN);

  // Share of every iteration, not of the rows shown — a route winning 41 of 10,000 runs must not
  // read as a majority because it happens to top a short list.
  const percentOfRuns = (count: number) => (iterations === 0 ? 0 : Math.round((count / iterations) * 100));
  const hiddenRuns = hidden.reduce((sum, route) => sum + route.count, 0);

  return (
    // `min-height` is load-bearing: `overflow-hidden` resets a flex item's automatic minimum size
    // to zero, and without this the card clips its rows instead of overflowing to the rail.
    <section className="flex min-h-[80px] flex-1 shrink flex-col overflow-hidden rounded border border-neutral-30 bg-white">
      <div className="shrink-0 px-2 pt-1.5">
        <div className="flex items-center gap-1 text-xs font-bold">
          <span>Most common critical paths</span>
          <InfoTooltip label="About most common critical paths">
            The chain of blocked epics with the most total work. Team capacity is ignored, so it may not be the chain
            that finishes last on the chart.
          </InfoTooltip>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 whitespace-nowrap px-2 pt-1 text-xs font-semibold text-neutral-500">
        <span className="w-9 shrink-0">
          <ColumnLabel tip="How often the chain came out longest across all runs.">Share</ColumnLabel>
        </span>
        <span className="flex-1">Chain</span>
      </div>
      <div
        ref={scrollAreaRef}
        data-scroll-area=""
        className="min-h-[58px] flex-1 overflow-y-auto overscroll-contain px-1 pb-1"
      >
        {shown.map((route) => {
          const id = routeId(route.keys);
          const lit = isRouteLit(selection, route);
          return (
            <button
              key={id}
              type="button"
              data-route-row=""
              data-lit={lit || undefined}
              disabled={disabled}
              onClick={() => onSelectRoute(id)}
              // Dim, never filter: the comparison the user clicked in order to make only survives
              // if the routes they did not pick stay on screen.
              className={`flex w-full gap-2 rounded px-1 py-1 text-left text-xs leading-snug hover:bg-neutral-20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${
                lit ? 'bg-blue-101' : ''
              } ${selection && !lit ? 'opacity-40' : ''}`}
            >
              <span className="w-9 shrink-0 font-semibold tabular-nums">{percentOfRuns(route.count)}%</span>
              <span className="flex-1">{labelFor(route.keys)}</span>
            </button>
          );
        })}
        {hidden.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="flex w-full gap-2 rounded px-1 py-1 text-left text-xs text-neutral-500 hover:bg-neutral-20"
          >
            <span className="w-9 shrink-0 font-semibold tabular-nums">{percentOfRuns(hiddenRuns)}%</span>
            <span className="flex-1">
              {expanded ? '▾' : '▸'} {hidden.length} other route{hidden.length === 1 ? '' : 's'}
            </span>
          </button>
        )}
      </div>
    </section>
  );
};
