import type { FC } from 'react';

import React from 'react';
import ChevronDownIcon from '@atlaskit/icon/glyph/chevron-down';
import ChevronRightIcon from '@atlaskit/icon/glyph/chevron-right';

export interface CollapseToggleProps {
  isCollapsed: boolean;
  /**
   * Names the section in the accessible label — "Collapse Q3" rather than a page of buttons all
   * reading "Collapse", the same individuation `NodeControls` does.
   */
  label: string;
  onToggle: () => void;
  /**
   * Whether the row this caret belongs to is hovered — its reveal condition while expanded (below).
   * Irrelevant while collapsed, since a collapsed caret is always shown regardless.
   */
  isRowActive?: boolean;
}

/**
 * A section's caret. Down when expanded, right when collapsed; `aria-expanded` says the same thing to
 * a screen reader, which is what makes this a disclosure rather than a mystery arrow.
 *
 * A caret appears wherever there is content beneath the row: sections, embedded reports, and a
 * latest-comment value. An ordinary inline value is a row and nothing else, so it renders no caret and
 * reserves no space for one.
 * See spec/016-report-of-reports/004-redesign §3.
 *
 * It's the row's last child, right-aligned — `#687879` meets the contrast floor (rule 7 of
 * spec/029-report-of-reports-redesign) on every section fill, and `flex-none` (`shrink-0`) keeps a
 * long title's truncation from squeezing it. It darkens to `#002A2D` with `isRowActive`, the same
 * "which row you're on" signal the title's own color follows (`reportTitleColorClassName`) — see
 * spec/029-report-of-reports-redesign, "hover reveals the section you're in".
 *
 * **Visible only when it's telling you something you can't already see.** Collapsed, it's the only
 * signal that content is hidden, so it always shows. Expanded, a caret on every row at every level is
 * clutter that mostly conveys nothing, so it's hidden until the row is hovered (`isRowActive` — the
 * same hover state `NodeControls` reveals on). This isn't a CSS `:hover`/`group-hover` rule: hover
 * here is the row's own React state, not the caret's, for the reason `useNodeRow`'s doc comment gives
 * — CSS `:hover` bubbles to every ancestor a nested row sits inside, not just the one under the
 * pointer.
 *
 * Clicking the caret toggles collapse directly, and clicking the rest of the row does the same thing
 * (`useNodeRow`) — this button doesn't need its own `stopPropagation`, because `NodeRow` already stops
 * a click on the caret (or the controls beside it) from also bubbling up and firing the row's handler
 * a second time.
 *
 * Opacity only, and never unmounted or `hidden` — the caret stays in layout at every state so the row
 * never reflows when it appears or fades. `focus-visible` is the keyboard path to a caret a mouse
 * would otherwise never reveal.
 */
export const CollapseToggle: FC<CollapseToggleProps> = ({ isCollapsed, label, onToggle, isRowActive }) => (
  <button
    type="button"
    aria-expanded={!isCollapsed}
    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}
    onClick={onToggle}
    className={[
      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[12px]',
      isRowActive ? 'text-[#002A2D]' : 'text-[#687879]',
      'hover:bg-neutral-201 print-hidden transition-opacity duration-[120ms] ease-in-out',
      isCollapsed || isRowActive
        ? 'opacity-100'
        : 'opacity-0 pointer-events-none focus-visible:opacity-100 focus-visible:pointer-events-auto',
    ].join(' ')}
  >
    {isCollapsed ? <ChevronRightIcon label="" size="small" /> : <ChevronDownIcon label="" size="small" />}
  </button>
);

export default CollapseToggle;
