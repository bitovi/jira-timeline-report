/**
 * Everything inside {@link SearchablePicker}'s popover: the search field, the grouped list in one of
 * two layouts, and the layout toggle.
 *
 * **Moving `search` in here is a simplification, not a relocation.** `Popup` renders nothing at all
 * when closed, so this component unmounts on every close and takes the query, the refs and the
 * active index with it. That is why `SearchablePicker` no longer clears the query on select or on
 * close: "clears the search between openings" now holds for a structural reason rather than a
 * bookkeeping one.
 *
 * **Each group is a full-width band**, not a column of a shared grid: a header, then that group's
 * options in their own `grid-cols-3`. Because each band is its own block, a group can never continue
 * on the previous group's line — the requirement falls out of the structure — and the bands stay in
 * `groupOrder` DOM order, which `SearchablePicker.test.tsx:61-71` asserts.
 *
 * See spec/031-column-select-redesign § 2 and § 5.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Textfield from '@atlaskit/textfield';
import GrowDiagonalIcon from '@atlaskit/icon/core/grow-diagonal';
import ShrinkDiagonalIcon from '@atlaskit/icon/core/shrink-diagonal';
import CheckMarkIcon from '@atlaskit/icon/utility/check-mark';

import type { PickerItem } from './SearchablePicker';
import type { PickerSection } from './usePickerKeyboard';
import { usePickerKeyboard } from './usePickerKeyboard';
import { EXPANDED_COLUMNS, type PickerLayout } from './usePickerLayout';

export interface PickerPanelProps {
  items: PickerItem[];
  groupOrder: readonly string[];
  excludeIds?: readonly string[];
  /** Groups whose items keep the order the caller passed. Everything else sorts by `localeCompare`. */
  unsortedGroups?: readonly string[];
  placeholder: string;
  emptyMessage: string;
  testIdPrefix: string;
  /** Selects **and** closes — the panel does not distinguish the two. */
  onSelect: (id: string) => void;
  /** Gets a check on the right of its row. Single-select; `AddColumnButton` passes none. */
  selectedId?: string | null;
  layout: PickerLayout;
  onToggleLayout: () => void;
  /**
   * `ContentProps.update` (`popup/dist/types/types.d.ts:19-23`).
   *
   * Toggling 288px ↔ 640px moves the panel's edges and popper does not observe it, so without this
   * the panel stays positioned for the width it used to have.
   */
  repositionPopup: () => Promise<unknown>;
  /**
   * `ContentProps.setInitialFocusRef` — handed straight to the search field as its `ref`.
   *
   * **Not optional, and jsdom cannot show why.** `use-focus-manager.js` builds its focus trap with
   * `initialFocus: initialFocusRef || popupRef`, so without this focus-trap focuses the popup's own
   * root `<div tabIndex={0}>` instead of the input. Measured in a real browser: the caret went to
   * `#…-popup`, so typing did nothing and the arrow keys — whose handler is on the input — never
   * fired at all. React's `autoFocus` does not survive it; the trap activates in a later animation
   * frame and takes focus back.
   *
   * Every unit test drives the field with `fireEvent` on the node directly, which needs no focus, so
   * the whole keyboard story passed green while being dead in a browser.
   */
  setInitialFocusRef: (element: HTMLElement | null) => void;
  /** The popup's accessible name when the caller gave one; names the listbox. */
  label?: string;
}

export const PickerPanel: React.FC<PickerPanelProps> = ({
  items,
  groupOrder,
  excludeIds,
  unsortedGroups,
  placeholder,
  emptyMessage,
  testIdPrefix,
  onSelect,
  selectedId,
  layout,
  onToggleLayout,
  repositionPopup,
  setInitialFocusRef,
  label,
}) => {
  const [search, setSearch] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const isGrid = layout === 'expanded';
  const columns = isGrid ? EXPANDED_COLUMNS : 1;

  const listboxId = `${testIdPrefix}-listbox`;
  const headerId = (group: string) => `${testIdPrefix}-group-${group.replace(/\s+/g, '-').toLowerCase()}`;
  const optionId = (id: string) => `${testIdPrefix}-option-${id}`;

  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const unsorted = useMemo(() => new Set(unsortedGroups ?? []), [unsortedGroups]);

  const sections = useMemo<PickerSection[]>(() => {
    const needle = search.trim().toLowerCase();
    const available = items.filter(
      (item) => !excluded.has(item.id) && (needle === '' || item.label.toLowerCase().includes(needle)),
    );

    return groupOrder
      .map((group) => {
        const inGroup = available.filter((item) => item.group === group);

        // A 3-column grid is only scannable if it is sorted — but some groups are curated in their
        // useful order on purpose (`fieldCatalog.ts:57-68`, `buildColumnCatalog.ts:226-271`), so the
        // opt-out honours both. Copy before sorting: `filter` returns a fresh array today, but that
        // is an implementation detail worth not depending on.
        return {
          group,
          items: unsorted.has(group) ? inGroup : [...inGroup].sort((a, b) => a.label.localeCompare(b.label)),
        };
      })
      .filter((section) => section.items.length > 0);
  }, [items, excluded, unsorted, search, groupOrder]);

  const { activeId, indexById, setActiveIndex, resetActiveIndex, handleKeyDown } = usePickerKeyboard({
    sections,
    columns,
    onActivate: onSelect,
  });

  // Popper does not observe the panel's own size, so a width change has to be announced.
  // `sections.length` too: filtering shortens the panel, which moves its bottom edge.
  useEffect(() => {
    void repositionPopup();
  }, [layout, sections.length, repositionPopup]);

  /**
   * Keep the active row visible **by writing `scrollTop`**, never with `scrollIntoView()` — that
   * scrolls every scrollable ancestor including the page, so inside a modal it drags the dialog, and
   * jsdom does not implement it at all (nothing in `vitest.setup.ts` polyfills it), so a stray call
   * throws in tests.
   *
   * In jsdom all three measurements are `0`, which makes this an inert no-op: it cannot crash a test
   * and no test can come to depend on a measurement jsdom has no layout to produce. Real
   * verification belongs in the story.
   */
  useEffect(() => {
    const container = scrollRef.current;
    const option = activeRef.current;

    if (!container || !option) return;

    // `offsetTop` is relative to the offsetParent, which is the scroll container because it is the
    // only positioned ancestor. That invariant is why the band and grid wrappers stay static.
    // The group's own sticky header would otherwise sit over its top row.
    const header = option.closest('[data-group]')?.firstElementChild as HTMLElement | null;
    const headroom = header?.offsetHeight ?? 0;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;

    if (top - headroom < container.scrollTop) {
      container.scrollTop = top - headroom;
    } else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = bottom - container.clientHeight;
    }
    // 288px ↔ 640px reflows every row, so the measurements taken above are layout-dependent.
  }, [activeId, layout]);

  const renderOption = (item: PickerItem) => {
    const isActive = item.id === activeId;
    const isSelected = item.id === selectedId;

    return (
      <button
        key={item.id}
        // `role="option"` overrides the implicit button role for AT; it stays a `<button>` so it is
        // still clickable, and `tabIndex={-1}` cedes the cursor to `aria-activedescendant`.
        type="button"
        role="option"
        id={optionId(item.id)}
        aria-selected={isSelected}
        tabIndex={-1}
        ref={isActive ? activeRef : undefined}
        data-testid={`${testIdPrefix}-option`}
        // A grid item's `min-width` is `auto`, so without `min-w-0` a long custom-field name blows
        // the column out instead of truncating. `title` keeps truncated text readable.
        title={item.label}
        className={`flex min-w-0 items-center gap-1 rounded px-2 py-1 text-left text-sm text-neutral-800 hover:bg-neutral-201 ${
          isActive ? 'bg-blue-101' : ''
        }`}
        onMouseEnter={() => setActiveIndex(indexById.get(item.id) ?? 0)}
        onClick={() => onSelect(item.id)}
      >
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {isSelected && <CheckMarkIcon label="" testId={`${testIdPrefix}-check`} />}
      </button>
    );
  };

  return (
    // Horizontal padding lives here and **not** on the scroll body, so the sticky header spans the
    // full scrollport with no sliver of content beside it.
    <div
      className={`flex flex-col gap-2 p-3 ${isGrid ? 'w-[640px]' : 'w-72'}`}
      data-testid={`${testIdPrefix}-popover`}
      data-picker-layout={layout}
    >
      <Textfield
        testId={`${testIdPrefix}-search`}
        placeholder={placeholder}
        value={search}
        // `Textfield` forwards its ref to the `<input>` (`text-field.js:94-104,149`), so this hands
        // popup's focus manager the input itself. See the prop's docblock — without it the caret
        // lands on the popup root and the keyboard navigation below is unreachable.
        ref={setInitialFocusRef}
        // It has no accessible name otherwise — a placeholder is not one.
        aria-label={placeholder}
        aria-controls={listboxId}
        aria-activedescendant={activeId ? optionId(activeId) : undefined}
        onChange={(e) => {
          setSearch((e.target as HTMLInputElement).value);
          // A new query renumbers the list, so the old active index no longer means anything.
          resetActiveIndex();
        }}
        // On the **input**, not the list, so the field keeps focus and typing never breaks.
        onKeyDown={handleKeyDown}
      />
      {/*
        `role="listbox"` sits on the scrolling body rather than the outer panel: the panel also holds
        the search field and the footer button, and a listbox may own only options and groups, so
        putting it outside would be invalid ARIA. Raised in review deliberately — § 7 (a).

        `relative` makes this the options' `offsetParent`, which the scroll math above depends on.
        The `50vh` clamp matters because § 8 forbids `shouldFitViewport`.
      */}
      <div
        ref={scrollRef}
        role="listbox"
        id={listboxId}
        aria-label={label ?? placeholder}
        className="relative flex max-h-[min(24rem,50vh)] flex-col gap-2 overflow-y-auto"
      >
        {sections.length === 0 && <div className="text-neutral-801 text-xs px-1">{emptyMessage}</div>}
        {sections.map((section) => (
          // `role="group"` goes on the band itself, and the header stays a `<span>` that is a direct
          // child of it: `TableReportControls.test.tsx:92-94` does
          // `getByText('Fields').closest('div')` and clicks an option inside the result, so any
          // wrapper between the two silently breaks it. `data-group` is the non-fragile selector
          // future work should move to.
          <div
            key={section.group}
            role="group"
            aria-labelledby={headerId(section.group)}
            data-testid={`${testIdPrefix}-group`}
            data-group={section.group}
            className="flex flex-col"
          >
            {/* The opaque background and `z-10` are both load-bearing — without them the rows scroll
                *over* the header rather than under it. The surface token rather than a hard white so
                it still disappears into the popover under a theme that isn't white. */}
            <span
              id={headerId(section.group)}
              className="sticky top-0 z-10 block bg-[var(--ds-surface-overlay,#fff)] px-1 py-1 text-xs font-semibold text-neutral-801"
            >
              {section.group}
            </span>
            {isGrid ? (
              // `grid-cols-3` compiles to `repeat(3, minmax(0, 1fr))`, the value the design asked
              // for. `presentation` because a listbox may own only options and groups.
              <div role="presentation" className="grid grid-cols-3 gap-x-2">
                {section.items.map(renderOption)}
              </div>
            ) : (
              // Byte-identical to the layout this control has always had: one option per row.
              section.items.map(renderOption)
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end border-t border-neutral-301 pt-2">
        <button
          type="button"
          data-testid={`${testIdPrefix}-layout-toggle`}
          aria-label={isGrid ? 'Collapse field list' : 'Expand field list'}
          className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm text-neutral-801 hover:bg-neutral-201"
          // Clicking must not take focus off the search input, or the arrow keys stop working right
          // after a toggle. Preventing the default mousedown is all it takes — no ref-and-refocus.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleLayout}
        >
          {/* Diagonal, not the horizontal pair: an angled arrow reads as "resize" where ← →
              reads as "move", which is the wrong promise for a button that changes the panel's
              shape. Neither of these is deprecated, unlike `core/collapse` — which
              `collapse.js:16-17` supersedes with `shrink-horizontal`, making `expand`/`collapse` a
              half-deprecated pair. (`grow-diagonal`'s axis is SW–NE; the design system ships no
              NW–SE arrow pair, only the boxed `maximize` glyph.) */}
          {isGrid ? <ShrinkDiagonalIcon label="" /> : <GrowDiagonalIcon label="" />}
          {isGrid ? 'Collapse' : 'Expand'}
        </button>
      </div>
    </div>
  );
};

export default PickerPanel;
