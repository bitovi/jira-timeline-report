/**
 * A searchable, grouped popover list — pick one item out of a catalog.
 *
 * Lifted verbatim out of Table's `+ Add column` button (spec/012-table-and-grouper, Phase 1) so that
 * Report of Reports' field picker can be the same control rather than a second one that drifts
 * (spec/016-report-of-reports/009-value-report-modal, Phase 1). The DOM, the class names, and the
 * filtering behaviour are unchanged from that original; only the item type and the test ids are
 * parameterised.
 *
 * `trigger` is a render prop because the two callers want different buttons: Table's is a fixed
 * `+ Add column`, ROR's shows the field currently picked. Everything inside the popover is shared.
 */
import React, { useState, type ReactNode } from 'react';
import Popup, { type TriggerProps } from '@atlaskit/popup';
import type { Placement } from '@atlaskit/popper';

import { PickerPanel } from './PickerPanel';
import { usePickerLayout, type PickerLayout } from './usePickerLayout';

export type { PickerLayout };

export interface PickerItem {
  id: string;
  label: string;
  group: string;
}

/**
 * What the `trigger` render prop receives. Callers keep writing `<button {...triggerProps}>` and get
 * combobox semantics for free.
 *
 * `Omit` rather than `extends`: `TriggerProps['aria-haspopup']` is `boolean | 'dialog'`
 * (`popup/dist/types/types.d.ts:9`), so narrowing it in an interface extension is an illegal
 * override. Spread Popup's own props, overwrite that one key, add `role`.
 */
export type PickerTriggerProps = Omit<TriggerProps, 'aria-haspopup'> & {
  role: 'combobox';
  'aria-haspopup': 'listbox';
};

export interface SearchablePickerProps {
  items: PickerItem[];
  /** Groups render in this order; an item whose group isn't listed is dropped. */
  groupOrder: readonly string[];
  /** Ids to hide — Table's "already shown" filter. */
  excludeIds?: readonly string[];
  /**
   * Groups whose items keep the order the caller passed; everything else sorts by `localeCompare`.
   *
   * Sorted is the default because a 3-column grid is only scannable sorted. The opt-out exists
   * because some groups are curated in their useful order on purpose.
   */
  unsortedGroups?: readonly string[];
  placeholder: string;
  emptyMessage: string;
  /** `foo` yields `foo`, `foo-popover`, `foo-search`, and `foo-option` test ids. */
  testIdPrefix: string;
  trigger: (triggerProps: PickerTriggerProps, toggle: () => void) => ReactNode;
  onSelect: (id: string) => void;

  /** The currently picked item. Gets a check on the right of its row. Single-select. */
  selectedId?: string | null;
  /**
   * `localStorage` key for the expand/collapse choice. Omit and the choice is per-mount only.
   *
   * Each caller passes **its own** key, so expanding in one picker does not also expand the other.
   */
  layoutStorageKey?: string;

  /**
   * Render the panel as a DOM sibling of the trigger instead of portalling it.
   *
   * **Needed only by a caller inside a dialog**, and there it is not a preference. A portalled panel
   * sits outside `@atlaskit/modal-dialog`'s `<FocusLock>` node, and `react-focus-lock` moves focus
   * back inside whenever `!focusInside(workingArea)` (`Trap.js:126-141`) — so the panel's search
   * field loses focus the instant it takes it. Rendering to the parent makes `focusInside` true and
   * the lock a no-op. It also lands the panel inside the modal positioner's own stacking context
   * (`positioner.js:31-38`), which is why no `zIndex` is needed — and `zIndex` is *ignored* on this
   * path, so passing it would be actively misleading.
   *
   * Safe only while nothing in the ancestry has a `transform`; a second stacked modal has one
   * (`positioner.js:76-77`). See spec/031-column-select-redesign § 8 and Risk 2.
   */
  shouldRenderToParent?: boolean;
  /** Forwarded to Popup. `'dialog'` announces the panel; must come with `label`. */
  role?: string;
  /** Forwarded to Popup as the panel's accessible name. Required whenever `role` is set. */
  label?: string;
  /**
   * Backup placements for flip to try.
   *
   * Not optional decoration for a wide panel: `@atlaskit/popper` hardcodes `flipVariations: false`
   * in its `constantModifiers` (`popper.js:28-36`), so flip will never try `bottom-end` unless it is
   * listed here.
   */
  fallbackPlacements?: Placement[];
}

export const SearchablePicker: React.FC<SearchablePickerProps> = ({
  items,
  groupOrder,
  excludeIds,
  unsortedGroups,
  placeholder,
  emptyMessage,
  testIdPrefix,
  trigger,
  onSelect,
  selectedId,
  layoutStorageKey,
  shouldRenderToParent,
  role,
  label,
  fallbackPlacements,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Here rather than in the panel: the panel unmounts on every close, so the choice would not
  // survive close/reopen if it lived there — which is visible even with no storage key.
  const [layout, setLayout] = usePickerLayout(layoutStorageKey);

  return (
    <Popup
      isOpen={isOpen}
      // No `setSearch('')` to go with this: the panel holds the query and `Popup` renders nothing
      // when closed, so closing unmounts it and the query goes with it.
      onClose={() => setIsOpen(false)}
      placement="bottom-start"
      // Deterministic rather than generated (`popup.js:88`), so the trigger's `aria-controls` is
      // assertable and stable across renders.
      id={`${testIdPrefix}-popup`}
      shouldRenderToParent={shouldRenderToParent}
      role={role}
      label={label}
      fallbackPlacements={fallbackPlacements}
      // Left at Popup's own defaults on purpose: `boundary`, `rootBoundary`, `shouldFlip`,
      // `shouldReturnFocus`, `autoFocus`, `strategy`. Never set here: `zIndex` (ignored under
      // `shouldRenderToParent`), `shouldFitViewport` (writes a `max-height` on a root whose
      // `overflow: auto` that same flag removes — `popper-wrapper.js:74` — so the panel would
      // truncate with no scroller), `shouldDisableFocusLock` (enables close-on-Tab, so tabbing off
      // the search field would close the panel), and `appearance` (`vitest.setup.ts:4-12` mocks
      // `matchMedia().matches` as a *function*, hence truthy, so every jsdom test would take the
      // small-viewport sheet branch and no browser would). See § 8.
      content={({ update }) => (
        <PickerPanel
          items={items}
          groupOrder={groupOrder}
          excludeIds={excludeIds}
          unsortedGroups={unsortedGroups}
          placeholder={placeholder}
          emptyMessage={emptyMessage}
          testIdPrefix={testIdPrefix}
          selectedId={selectedId}
          label={label}
          layout={layout}
          onToggleLayout={() => setLayout(layout === 'expanded' ? 'compact' : 'expanded')}
          repositionPopup={update}
          onSelect={(id) => {
            onSelect(id);
            setIsOpen(false);
          }}
        />
      )}
      trigger={(triggerProps) =>
        trigger({ ...triggerProps, role: 'combobox', 'aria-haspopup': 'listbox' }, () => setIsOpen((open) => !open))
      }
    />
  );
};

export default SearchablePicker;
