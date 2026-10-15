import type { FC, ReactNode } from 'react';

import React, { useEffect, useRef, useState } from 'react';
import Tooltip from '@atlaskit/tooltip';

interface TruncatedTextProps {
  /** The full text, shown in the tooltip only when the rendered text is clipped. */
  text: string;
  /** What is rendered in place. Defaults to `text`; pass a link here to keep the anchor. */
  children?: ReactNode;
  /** Whether `children` already holds a focusable element (an anchor) — if not, a clipped label
   * gets a tab stop of its own so the tooltip is reachable by keyboard. */
  hasFocusableChild?: boolean;
  className?: string;
}

/**
 * A single line of text in the pinned `what` column, ending in an ellipsis when it overflows, with
 * the full text on hover only when it is actually clipped.
 *
 * The tooltip is not decoration. The column is `fit-content(40%)` and yields to the timeline's
 * `MIN_TIMELINE_WIDTH` floor (see `AutoScheduler.tsx`), so a report squeezed by a sidebar panel
 * clips labels that read fine at full width — hover is the only way to get them back.
 *
 * `truncate` sits on the element that *directly* holds the text. `text-overflow` only applies to a
 * box's own line boxes, so `truncate` on a parent with the text in a nested block clips the text
 * with no ellipsis at all.
 */
export const TruncatedText: FC<TruncatedTextProps> = ({ text, children, hasFocusableChild = false, className }) => {
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
  }, [text]);

  return (
    // `content` is nulled rather than the Tooltip being dropped entirely: Atlaskit renders nothing
    // for falsy content, so the trigger stays mounted and keeps its measurement instead of
    // remounting every time the column crosses the clipping threshold.
    //
    // The render-prop form of `children` (`@atlaskit/tooltip` 18.8.3, `TriggerProps`) hands the
    // trigger props straight to the element being measured. Passing the element directly would
    // also work — Atlaskit would wrap it in an unstyled `div` — but then its ref lands on that
    // wrapper rather than on the text, and this needs the ref and the truncation on one element.
    <Tooltip content={isClipped ? text : null}>
      {({ ref, ...triggerProps }) => (
        <div
          {...triggerProps}
          ref={(node) => {
            textRef.current = node;
            ref(node);
          }}
          // Atlaskit only opens on focus for focusable children. A linked label already has one —
          // the anchor — and React's `onFocus` is `focusin`, which bubbles up to this handler, so
          // only the plain-text case needs a tab stop of its own. Gated on `isClipped` as well
          // because an unclipped row has no tooltip to reveal, and a plan is mostly unclipped
          // rows: without the gate every one of them becomes a tab stop that does nothing.
          tabIndex={!hasFocusableChild && isClipped ? 0 : undefined}
          className={['truncate', className].filter(Boolean).join(' ')}
        >
          {children ?? text}
        </div>
      )}
    </Tooltip>
  );
};
