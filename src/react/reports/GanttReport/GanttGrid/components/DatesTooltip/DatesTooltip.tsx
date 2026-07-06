import React from 'react';
import AtlaskitTooltip, { TooltipPrimitive, type TooltipPrimitiveProps } from '@atlaskit/tooltip';
import type { DatesTooltipData } from '../../types';

export interface DatesTooltipProps {
  data: DatesTooltipData;
  children: React.ReactElement;
  /**
   * Pixels to pull the tooltip up so its top edge touches the bottom of the bar.
   *
   * Cancels Atlaskit's default trigger→tooltip gap, plus (in normal mode) the 8px bottom `py-2`
   * padding between the bar and its full-width hover container. Breakdown bars have no such
   * padding, so they pull up less.
   */
  pullUpPx?: number;
}

/**
 * Context carrying how far to pull the tooltip up so its top edge touches the bar's bottom.
 * Read by `BareTooltip`, which Atlaskit renders (via the `component` prop) without a way to pass
 * extra props through.
 */
const PullUpContext = React.createContext(5);

/**
 * A bare tooltip container with no default Atlaskit chrome (no background, padding, or shadow),
 * so the pills render exactly like the legacy report's `datesTooltipStache` — as standalone dark
 * pills — instead of sitting inside Atlaskit's default dark tooltip box.
 */
const BareTooltip = React.forwardRef<HTMLDivElement, TooltipPrimitiveProps>((props, ref) => {
  const pullUpPx = React.useContext(PullUpContext);
  return (
    <TooltipPrimitive
      {...props}
      ref={ref}
      style={{ ...props.style, background: 'transparent', padding: 0, boxShadow: 'none', marginTop: `-${pullUpPx}px` }}
    />
  );
});
BareTooltip.displayName = 'BareTooltip';

/**
 * Hover tooltip showing the start/duration/end pills for a timeline bar.
 *
 * Ports gantt-grid.js's `datesTooltipStache` + `showDatesTooltip`/`hideDatesTooltip`. Uses
 * `@atlaskit/tooltip` (hover-triggered, already a direct dependency) rather than
 * `@atlaskit/popup` (click-triggered) — this matches the legacy hover behavior more directly.
 *
 * Wraps a bar element so `position="bottom"` drops the tooltip directly below the bar; `pullUpPx`
 * closes Atlaskit's default trigger→tooltip gap so the top of the tooltip touches the bar's bottom.
 */
export const DatesTooltip: React.FC<DatesTooltipProps> = ({ data, children, pullUpPx = 5 }) => {
  if (!data.startPill && !data.durationPill && !data.endPill) return children;

  const content = (
    <div className="flex gap-0.5 px-1 pb-1 whitespace-nowrap">
      {data.labelPill && <Pill>{data.labelPill}</Pill>}
      {data.startPill && <Pill>{data.startPill}</Pill>}
      {data.durationPill && <Pill>{data.durationPill}</Pill>}
      {data.endPill && <Pill>{data.endPill}</Pill>}
    </div>
  );

  return (
    <PullUpContext.Provider value={pullUpPx}>
      <AtlaskitTooltip
        content={content}
        position="bottom"
        component={BareTooltip as React.ComponentType<TooltipPrimitiveProps>}
      >
        {children}
      </AtlaskitTooltip>
    </PullUpContext.Provider>
  );
};

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 whitespace-nowrap">{children}</div>
);
