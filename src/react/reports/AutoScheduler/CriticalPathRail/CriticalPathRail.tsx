import type { FloorSummary } from './dependency-floor';

import React from 'react';
import Tooltip from '@atlaskit/tooltip';
import { RAIL_MAX_WIDTH, RAIL_MIN_WIDTH, useRailWidth } from './useRailWidth';

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

const QUEUEING_TOOLTIP = (
  <div className="grid gap-1">
    <div className="font-semibold">Queueing</div>
    <div>
      The plan&apos;s average finish minus the dependency floor — time lost purely to epics waiting for a free track.
    </div>
    <div>
      A large number means the plan is capacity-bound: running more of it at once would recover time. A small number
      means it is dependency-bound — the chain of <code>Blocks</code> links, not contention, sets the finish.
    </div>
    <div>
      This is not a cap on what hiring is worth. More people also raise a team&apos;s velocity, which shortens epics and
      lowers the floor itself.
    </div>
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
        title="Show the plan analysis"
        className="shrink-0 w-[30px] flex items-center justify-center gap-1.5 border-l border-neutral-30 bg-neutral-10 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-101 print:hidden"
        style={{ writingMode: 'vertical-rl' }}
      >
        <span>◧ Plan analysis</span>
      </button>
    );
  }

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the plan analysis panel"
        aria-valuenow={width}
        aria-valuemin={RAIL_MIN_WIDTH}
        aria-valuemax={RAIL_MAX_WIDTH}
        tabIndex={0}
        title="Drag to resize · click to collapse"
        {...dividerProps}
        className={`group relative w-[5px] shrink-0 cursor-col-resize bg-neutral-30 outline-none print:hidden ${
          isDragging ? 'bg-blue-300' : 'hover:bg-blue-200 focus-visible:bg-blue-200'
        }`}
      >
        {/* Absolutely positioned so it overflows the divider and costs no layout width. */}
        <span
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex h-8 w-[17px] items-center justify-center rounded-sm border text-sm leading-none shadow-sm transition-colors ${
            isDragging
              ? 'border-blue-300 bg-blue-101 text-blue-300'
              : 'border-neutral-40 bg-white text-neutral-500 group-hover:border-blue-300 group-hover:bg-blue-101 group-hover:text-blue-300 group-focus-visible:border-blue-300 group-focus-visible:bg-blue-101 group-focus-visible:text-blue-300'
          }`}
        >
          ▸
        </span>
      </div>
      <aside
        aria-label="Plan analysis"
        style={{ width }}
        // No sticky/max-height: the caller's row is clamped to the viewport, so `items-stretch` hands
        // the rail the full height and it scrolls itself.
        // No left border: the 5px drag divider above is already the separating line.
        className="critical-path-rail min-h-0 shrink-0 flex flex-col overflow-y-auto bg-neutral-10"
      >
        {/* `bg-neutral-20` matches the Gantt's group-header rows, so white stays the content surface. */}
        <header className="flex items-start gap-1.5 border-b border-neutral-30 bg-neutral-20 px-2 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            {/* Stated, not implied: every number below is a mean over all runs and ignores the slider. */}
            <b>Plan analysis</b>
            <span className="font-normal text-neutral-300"> · average case</span>
            {/* Neutral on purpose: yellow/orange is reserved for estimate-data warnings in this report. */}
            <span className="block text-xs tabular-nums text-neutral-500">
              {/* `tag` because Tooltip's default `div` wrapper is block-level and breaks the line. */}
              <Tooltip content={FLOOR_TOOLTIP} tag="span">
                <span className="cursor-help underline decoration-dotted underline-offset-2" tabIndex={0}>
                  Dependency floor
                </span>
              </Tooltip>{' '}
              <b className="font-semibold text-neutral-800">{floor.floorDays.toFixed(1)} d</b>
              {' · '}
              <Tooltip content={QUEUEING_TOOLTIP} tag="span">
                <span className="cursor-help underline decoration-dotted underline-offset-2" tabIndex={0}>
                  queueing
                </span>
              </Tooltip>{' '}
              <b className="font-semibold text-neutral-800">{floor.queueingDays.toFixed(1)} d</b>
            </span>
          </div>
          <button
            type="button"
            aria-label="Close plan analysis"
            title="Hide the plan analysis"
            onClick={onCollapse}
            className="shrink-0 rounded-sm px-1 text-sm leading-none text-neutral-500 hover:bg-neutral-30 hover:text-blue-300"
          >
            {/* Mirror of the spine's ◧: the filled half shows which side the rail is on. */}◨
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">{children}</div>
      </aside>
    </>
  );
};
