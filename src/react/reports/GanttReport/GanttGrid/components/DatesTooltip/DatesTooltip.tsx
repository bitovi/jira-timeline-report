import React from 'react';
import { createPortal } from 'react-dom';
import { Popper } from '@atlaskit/popper';
import type { DatesTooltipData } from '../../types';
import { TimelineBoundaryContext } from './TimelineBoundaryContext';
import { buildDatesTooltipModifiers } from './modifiers';

export interface DatesTooltipTriggerProps {
  /** Spread onto the element that should show the tooltip on hover (may be larger than the anchor). */
  triggerProps: Pick<React.HTMLAttributes<HTMLElement>, 'onMouseEnter' | 'onMouseLeave'>;
  /** Ref for the element the tooltip is positioned against — the bar itself. */
  anchorRef: (element: HTMLElement | null) => void;
}

export interface DatesTooltipProps {
  data: DatesTooltipData;
  children: (props: DatesTooltipTriggerProps) => React.ReactNode;
}

const TOOLTIP_Z_INDEX = 10000;

const noop = () => {};

/**
 * Hover tooltip showing the start/duration/end pills for a timeline bar.
 *
 * Ports gantt-grid.js's `datesTooltipStache` + `showDatesTooltip`/`hideDatesTooltip`. The tooltip is
 * placed directly below the bar (`anchorRef`), centered on it, then shifted horizontally as needed
 * so it stays inside the timeline area (see `TimelineBoundaryContext`). The hover trigger can be a
 * larger element than the anchor, so hovering anywhere in a row still shows the tooltip.
 */
export const DatesTooltip: React.FC<DatesTooltipProps> = ({ data, children }) => {
  const boundary = React.useContext(TimelineBoundaryContext);
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  const modifiers = React.useMemo(() => buildDatesTooltipModifiers(boundary), [boundary]);
  const triggerProps = React.useMemo(
    () => ({ onMouseEnter: () => setIsOpen(true), onMouseLeave: () => setIsOpen(false) }),
    [],
  );

  if (!data.startPill && !data.durationPill && !data.endPill) {
    return <>{children({ triggerProps: { onMouseEnter: noop, onMouseLeave: noop }, anchorRef: noop })}</>;
  }

  return (
    <>
      {children({ triggerProps, anchorRef: setAnchor })}
      {isOpen &&
        anchor &&
        createPortal(
          <Popper placement="bottom" offset={[0, 0]} referenceElement={anchor} modifiers={modifiers}>
            {({ ref, style }) => (
              <div
                ref={ref}
                style={{ ...style, zIndex: TOOLTIP_Z_INDEX, pointerEvents: 'none' }}
                role="tooltip"
                data-testid="dates-tooltip"
              >
                <div className="flex gap-0.5 px-1 pb-1 whitespace-nowrap">
                  {data.labelPill && <Pill>{data.labelPill}</Pill>}
                  {data.startPill && <Pill>{data.startPill}</Pill>}
                  {data.durationPill && <Pill>{data.durationPill}</Pill>}
                  {data.endPill && <Pill>{data.endPill}</Pill>}
                </div>
              </div>
            )}
          </Popper>,
          document.body,
        )}
    </>
  );
};

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs rounded-[3px] text-white bg-neutral-801 py-0.5 px-1.5 whitespace-nowrap">{children}</div>
);
