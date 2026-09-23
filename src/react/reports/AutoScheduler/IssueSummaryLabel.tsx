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
          of remounting every time the column crosses the clipping threshold. The render-prop form
          is what stops Atlaskit wrapping the trigger in a `div` of its own, which would put a box
          between the cell and the text and break the truncation. */}
      <Tooltip content={isClipped ? summary : null}>
        {({ ref, ...triggerProps }) => (
          <div
            {...triggerProps}
            ref={(node) => {
              textRef.current = node;
              ref(node);
            }}
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
