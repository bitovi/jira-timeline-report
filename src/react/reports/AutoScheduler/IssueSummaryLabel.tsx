import type { FC } from 'react';

import React, { useEffect, useRef, useState } from 'react';
import Tooltip from '@atlaskit/tooltip';

import { gridLayer } from './z-layers';

interface IssueSummaryLabelProps {
  summary: string;
  /** Absent when the issue has no Jira link — the summary then renders as plain text. */
  url?: string;
  openInNewTab?: boolean;
  /** Extra classes for the text itself. The two call sites differ only in their hover treatment. */
  textClassName?: string;
  gridRowStart: number;
}

/**
 * The pinned `what`-column cell: an issue's summary, clipped to the column, with the full text on
 * hover only when it is actually clipped.
 *
 * The tooltip is not decoration. The column is `fit-content(40%)` and yields to the timeline's
 * `MIN_TIMELINE_WIDTH` floor (see `AutoScheduler.tsx`), so a report squeezed by a sidebar panel
 * clips summaries that read fine at full width — hover is the only way to get them back.
 *
 * `truncate` sits on the element that *directly* holds the text. `text-overflow` only applies to a
 * box's own line boxes, so the previous markup — `truncate` on the cell with the summary in a
 * nested block — clipped the text with no ellipsis at all.
 */
export const IssueSummaryLabel: FC<IssueSummaryLabelProps> = ({
  summary,
  url,
  openInNewTab = false,
  textClassName,
  gridRowStart,
}) => {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [isClipped, setIsClipped] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const measure = () => setIsClipped(element.scrollWidth > element.clientWidth);
    measure();

    // The width that matters here changes when a sibling panel opens, not when the window resizes,
    // so a `resize` listener would miss every case this exists for.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [summary]);

  return (
    <div
      className="pl-5 self-center pr-2 max-w-sm sticky left-0 bg-white"
      style={{ zIndex: gridLayer.labelColumn, gridRow: gridRowStart, gridColumnStart: 'what' }}
    >
      {/* `content` is nulled rather than the Tooltip being dropped entirely: Atlaskit renders
          nothing for falsy content, so the trigger stays mounted and keeps its measurement instead
          of remounting every time the column crosses the clipping threshold.

          The render-prop form of `children` (`@atlaskit/tooltip` 18.8.3, `TriggerProps`) hands the
          trigger props straight to the element being measured. Passing the element directly would
          also work — Atlaskit would wrap it in an unstyled `div` — but then its ref lands on that
          wrapper rather than on the text, and this needs the ref and the truncation on one element. */}
      <Tooltip content={isClipped ? summary : null}>
        {({ ref, ...triggerProps }) => (
          <div
            {...triggerProps}
            ref={(node) => {
              textRef.current = node;
              ref(node);
            }}
            // Atlaskit only opens on focus for focusable children. A linked summary already has one
            // — the anchor — and React's `onFocus` is `focusin`, which bubbles up to this handler,
            // so only the plain-text case needs a tab stop of its own. Gated on `isClipped` as well
            // because an unclipped row has no tooltip to reveal, and a plan is mostly unclipped
            // rows: without the gate every one of them becomes a tab stop that does nothing.
            tabIndex={!url && isClipped ? 0 : undefined}
            className={['text-gray-600 truncate', textClassName].filter(Boolean).join(' ')}
          >
            {url ? (
              <a href={url} target={openInNewTab ? '_blank' : undefined}>
                {summary}
              </a>
            ) : (
              summary
            )}
          </div>
        )}
      </Tooltip>
    </div>
  );
};
