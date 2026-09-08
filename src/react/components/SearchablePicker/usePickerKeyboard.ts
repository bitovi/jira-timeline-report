/**
 * Arrow-key navigation for {@link SearchablePicker}'s panel — thin wiring over `picker-grid.ts`.
 *
 * Shaped after `useReportSearch.ts:52-68`: **the handler goes on the search input**, not on the list,
 * so focus never leaves the field and typing never breaks. Rows are `aria-activedescendant` targets
 * rather than tab stops.
 *
 * See spec/031-column-select-redesign § 6.
 */
import type { KeyboardEvent } from 'react';
import type { PickerItem } from './SearchablePicker';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { buildPositions, buildRows, moveActiveIndex, type MoveDirection } from './picker-grid';

/** One rendered group band: its header and the options under it. */
export interface PickerSection {
  group: string;
  items: PickerItem[];
}

export interface UsePickerKeyboardOptions {
  /** The visible groups, in render order — empty ones already dropped. */
  sections: PickerSection[];
  /** `1` in the compact layout, `EXPANDED_COLUMNS` in the expanded one. */
  columns: number;
  /** Fired on ↵ over the active option. The same path a click takes. */
  onActivate: (id: string) => void;
}

export interface PickerKeyboard {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** The active option's id — for `aria-activedescendant` and for the row's own highlight. */
  activeId: string | undefined;
  /** Flat index by id, for `onMouseEnter`. Precomputed: `flat.indexOf` per row is O(n²) over 180 fields. */
  indexById: ReadonlyMap<string, number>;
  /** Call on a query change — a new query renumbers the list, so the old index means nothing. */
  resetActiveIndex: () => void;
  /** Attach to the search input. */
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

const ARROW_DIRECTIONS: Record<string, MoveDirection> = {
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Whether ←/→ belong to the grid rather than to the caret.
 *
 * Focus lives in the search input, so the caret has first claim on ←/→ — this is the bargain a
 * browser autocomplete makes. The grid only gets them at a **collapsed** selection sitting at the
 * very start (←) or very end (→) of the text, i.e. when the caret has nowhere left to go.
 *
 * `selectionStart === null` means "not measurable" — jsdom on a field it never laid out, or an input
 * type that reports no selection — and is treated as at-the-boundary so the grid stays navigable
 * there. If this proves fussy in review, the fallback is `search === ''`; do **not** always
 * intercept, which makes the search box impossible to edit.
 */
const isCaretAtBoundary = (input: HTMLInputElement, direction: 'left' | 'right'): boolean => {
  const { selectionStart, selectionEnd, value } = input;

  if (selectionStart === null || selectionEnd === null) return true;
  // A range selection is itself somewhere for the caret to go — collapse it first.
  if (selectionStart !== selectionEnd) return false;

  return direction === 'left' ? selectionStart === 0 : selectionStart === value.length;
};

export const usePickerKeyboard = ({ sections, columns, onActivate }: UsePickerKeyboardOptions): PickerKeyboard => {
  const [activeIndex, setActiveIndex] = useState(0);

  // `activeIndex` indexes the flattened option list, so group headers are skipped for free and the
  // index means the same thing in both layouts — which is why toggling layout mid-navigation keeps
  // the same option active with no bookkeeping.
  const flat = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  const indexById = useMemo(() => new Map(flat.map((item, index) => [item.id, index])), [flat]);

  const { rows, positions } = useMemo(() => {
    const built = buildRows(
      sections.map((section) => section.items.length),
      columns,
    );

    return { rows: built, positions: buildPositions(built) };
  }, [sections, columns]);

  // A shorter list can leave the index past the end — a new query, or `excludeIds` changing while
  // the panel is open. `resetActiveIndex` covers the query; this covers everything else.
  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(flat.length - 1, 0)));
  }, [flat.length]);

  const resetActiveIndex = useCallback(() => setActiveIndex(0), []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      const active = flat[activeIndex];

      // No-op at zero matches rather than selecting whatever used to be at index 0.
      if (active) onActivate(active.id);

      return;
    }

    const direction = ARROW_DIRECTIONS[event.key];

    // Everything else — Escape above all — is left strictly alone. `Popup` closes on Escape from a
    // **`window`** keydown listener (`use-close-manager.js:163-176`), so a handler here that called
    // `stopPropagation` would break the very close it was meant to scope. See § 6's warning.
    if (!direction) return;

    if (direction === 'left' || direction === 'right') {
      // Compact is one column: ←/→ have no second axis to walk, so they stay the caret's entirely.
      if (columns <= 1) return;
      if (!isCaretAtBoundary(event.currentTarget, direction)) return;
    }

    event.preventDefault();
    setActiveIndex((index) => moveActiveIndex(rows, positions, index, direction, flat.length));
  };

  return {
    activeIndex,
    setActiveIndex,
    activeId: flat[activeIndex]?.id,
    indexById,
    resetActiveIndex,
    handleKeyDown,
  };
};
