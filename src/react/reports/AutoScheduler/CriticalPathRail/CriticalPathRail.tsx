import type { FloorSummary } from './dependency-floor';

import React from 'react';
import Tooltip from '@atlaskit/tooltip';
import { useRailWidth } from './useRailWidth';

export interface CriticalPathRailProps {
  floor: FloorSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The two tables, routes first. */
  children: React.ReactNode;
}

const FLOOR_TOOLTIP = (
  <div className="grid gap-1">
    <div className="font-semibold">Dependency floor</div>
    <div>
      The average length of the longest chain of <code>Blocks</code> links, if no epic ever waited for a free track.
    </div>
    <div>
      Team velocity still applies — each epic takes as long as its team&apos;s throughput allows. Only queueing behind
      other work in this plan is removed.
    </div>
    <div>Always an average. It does not follow the confidence slider.</div>
  </div>
);

/**
 * Renders as three siblings of the Gantt grid inside the caller's flex row: the drag divider, the
 * rail itself, and — only while closed — the labelled spine.
 */
export const CriticalPathRail: React.FC<CriticalPathRailProps> = ({ floor, open, onOpenChange, children }) => {
  const onCollapse = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const { width, isDragging, dividerProps } = useRailWidth({ onCollapse });

  if (!open) {
    // Open, the spine would be 26px of Gantt spent on closing something already on screen.
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => onOpenChange(true)}
        title="Show the critical path"
        className="shrink-0 w-[26px] flex items-center justify-center gap-1.5 border-l border-neutral-30 bg-neutral-10 py-2 text-[10px] font-semibold text-blue-300 hover:bg-blue-101 print:hidden"
        style={{ writingMode: 'vertical-rl' }}
      >
        <span>◧ Critical path</span>
        <span className="font-normal text-neutral-500 tabular-nums">floor {floor.floorDays.toFixed(1)} d</span>
      </button>
    );
  }

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize · click to collapse"
        {...dividerProps}
        className={`relative w-[5px] shrink-0 cursor-col-resize bg-neutral-30 print:hidden ${
          isDragging ? 'bg-blue-300' : 'hover:bg-blue-200'
        }`}
      >
        {/* Absolutely positioned so it overflows the divider and costs no layout width. */}
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-7 w-[13px] items-center justify-center rounded-sm border border-neutral-40 bg-white text-[9px] text-neutral-500">
          ▸
        </span>
      </div>
      <aside
        aria-label="Critical path"
        style={{ width, maxHeight: 'calc(100vh - var(--fullish-document-top))' }}
        // Sticky because the grid scrolls inside `.fullish-vh` — a static rail scrolls out of view
        // and forty epics down the Gantt the tables are off screen.
        className="shrink-0 sticky top-0 flex flex-col overflow-y-auto border-l border-neutral-30 bg-neutral-10 print:static print:w-full print:max-h-none print:border-l-0"
      >
        <header className="flex items-start gap-1.5 border-b border-neutral-30 bg-white px-2 py-1.5 text-[11px]">
          <div className="min-w-0 flex-1">
            <b>Critical path</b>
            <span className="block text-[10px] tabular-nums text-yellow-500">
              <Tooltip content={FLOOR_TOOLTIP}>
                <span
                  className="cursor-help text-neutral-500 underline decoration-dotted underline-offset-2"
                  tabIndex={0}
                >
                  Dependency floor
                </span>
              </Tooltip>{' '}
              {floor.floorDays.toFixed(1)} d
              {floor.queueingDays !== null && <> · queueing {floor.queueingDays.toFixed(1)} d</>}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close critical path"
            onClick={onCollapse}
            className="shrink-0 rounded-sm px-1 text-[13px] leading-none text-neutral-500 hover:bg-neutral-20 hover:text-neutral-800"
          >
            ×
          </button>
        </header>
        <div className="flex min-h-0 flex-col gap-2 p-2">{children}</div>
      </aside>
    </>
  );
};
