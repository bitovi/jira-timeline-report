import type { PathFrequency } from '../scheduler/critical-path-accumulator';
import type { CriticalPathEpicRow } from './build-critical-path-epics';
import type { CriticalPathSelection } from './criticalPathSelection';

import React from 'react';
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
    <section className="flex min-h-[100px] shrink flex-col overflow-hidden rounded border border-neutral-30 bg-white">
      <div className="shrink-0 px-2 pt-1.5">
        <div className="text-xs font-bold">Epics on the critical path</div>
        {/* Names the tie to the header figure without restating it. */}
        <div className="text-[9px] text-neutral-500">Days each epic adds to the dependency floor</div>
      </div>
      <div className="flex shrink-0 gap-2 px-2 pt-1 text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
        <span className="flex-1">Epic</span>
        <span className="w-11 shrink-0 text-right">Days added</span>
        <span className="w-9 shrink-0 text-right">On path</span>
      </div>
      <div
        ref={scrollAreaRef}
        data-scroll-area=""
        className="min-h-[58px] max-h-[232px] flex-1 overflow-y-auto overscroll-contain px-1 pb-1"
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
              className={`flex w-full gap-2 rounded px-1 py-1 text-left text-[11px] leading-snug hover:bg-neutral-20 ${
                lit ? 'bg-blue-101' : ''
              } ${selection?.kind === 'route' && !lit ? 'opacity-40' : ''}`}
            >
              <span className="flex-1 truncate">{row.summary}</span>
              <span className="w-11 shrink-0 text-right font-semibold tabular-nums">{row.daysAdded.toFixed(1)}</span>
              <span className="w-9 shrink-0 text-right tabular-nums text-neutral-500">
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
            className="flex w-full gap-2 rounded px-1 py-1 text-left text-[11px] text-neutral-500 hover:bg-neutral-20"
          >
            <span className="flex-1">
              {expanded ? '▾' : '▸'} {hidden.length} other epic{hidden.length === 1 ? '' : 's'}
            </span>
            <span className="w-11 shrink-0 text-right tabular-nums">{hiddenDaysAdded.toFixed(1)}</span>
            <span className="w-9 shrink-0" />
          </button>
        )}
      </div>
    </section>
  );
};
