import type { PathFrequency } from '../scheduler/critical-path-accumulator';
import type { CriticalPathEpicRow } from './build-critical-path-epics';
import type { CriticalPathSelection } from './criticalPathSelection';

import React from 'react';
import { InfoTooltip, ColumnLabel } from './InfoTooltip';
import { isEpicLit } from './criticalPathSelection';

export const EPIC_ROWS_SHOWN = 10;

export interface CriticalPathEpicsTableProps {
  /** Already sorted, from `buildCriticalPathEpics`. */
  rows: CriticalPathEpicRow[];
  routes: PathFrequency[];
  selection: CriticalPathSelection;
  onSelectEpic: (key: string) => void;
}

export const CriticalPathEpicsTable: React.FC<CriticalPathEpicsTableProps> = ({
  rows,
  routes,
  selection,
  onSelectEpic,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // See the routes table: the responding table can sit below the fold on a short viewport.
  React.useEffect(() => {
    scrollAreaRef.current?.querySelector('[data-lit]')?.scrollIntoView?.({ block: 'nearest' });
  }, [selection]);

  const hidden = rows.slice(EPIC_ROWS_SHOWN);
  const shown = expanded ? rows : rows.slice(0, EPIC_ROWS_SHOWN);
  const hiddenDaysAdded = hidden.reduce((sum, row) => sum + row.daysAdded, 0);

  return (
    // See the routes table: without an explicit minimum this card clips rather than overflows.
    <section className="flex min-h-[100px] flex-1 shrink flex-col overflow-hidden rounded border border-neutral-30 bg-white">
      <div className="shrink-0 px-2 pt-1.5">
        <div className="flex items-center gap-1 text-xs font-bold">
          <span>Epics on the critical path</span>
          <InfoTooltip label="About epics on the critical path">
            Every epic that was on the longest chain in at least one run, ranked by how much schedule it is responsible
            for.
          </InfoTooltip>
        </div>
      </div>
      {/* Not uppercase: that convention buys legibility at 9px, but at 12px it only costs width. */}
      <div className="flex shrink-0 gap-2 whitespace-nowrap px-2 pt-1 text-xs font-semibold text-neutral-500">
        <span className="flex-1">Epic</span>
        <span className="w-[72px] shrink-0 text-right">
          <ColumnLabel tip="Working days this epic contributes to the dependency floor. The column sums to it.">
            Days added
          </ColumnLabel>
        </span>
        <span className="w-12 shrink-0 text-right">
          <ColumnLabel tip="How often this epic was on the longest chain across all runs.">On path</ColumnLabel>
        </span>
      </div>
      <div
        ref={scrollAreaRef}
        data-scroll-area=""
        className="min-h-[58px] flex-1 overflow-y-auto overscroll-contain px-1 pb-1"
      >
        {shown.map((row) => {
          const lit = isEpicLit(selection, row.key, routes);
          return (
            <button
              key={row.key}
              type="button"
              data-epic-row=""
              data-lit={lit || undefined}
              onClick={() => onSelectEpic(row.key)}
              // Dimmed only for a route selection. An epic selection must not dim this table: it is
              // a ranking, and dimming destroys the comparison the click was made to read.
              className={`flex w-full gap-2 rounded px-1 py-1 text-left text-xs leading-snug hover:bg-neutral-20 ${
                lit ? 'bg-blue-101' : ''
              } ${selection?.kind === 'route' && !lit ? 'opacity-40' : ''}`}
            >
              <span className="flex-1 truncate">{row.summary}</span>
              <span className="w-[72px] shrink-0 text-right font-semibold tabular-nums">
                {row.daysAdded.toFixed(1)}
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-neutral-500">
                {Math.round(row.onPathIndex * 100)}%
              </span>
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
            <span className="flex-1">
              {expanded ? '▾' : '▸'} {hidden.length} other epic{hidden.length === 1 ? '' : 's'}
            </span>
            <span className="w-[72px] shrink-0 text-right tabular-nums">{hiddenDaysAdded.toFixed(1)}</span>
            <span className="w-12 shrink-0" />
          </button>
        )}
      </div>
    </section>
  );
};
