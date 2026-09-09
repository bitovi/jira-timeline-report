/**
 * A searchable, grouped popover list — pick one item out of a catalog, in one of two layouts.
 *
 * Lifted out of Table's `+ Add column` button (spec/012-table-and-grouper, Phase 1) so that Report of
 * Reports' field picker can be the same control rather than a second one that drifts
 * (spec/016-report-of-reports/009-value-report-modal, Phase 1), and redesigned into an expandable
 * three-column grid in spec/031-column-select-redesign — because against a real Jira instance the
 * `Fields` group is 180+ entries, which one per row in a 288px column is not a list anyone can scan.
 *
 * `trigger` is a render prop for **three** reasons now. The two callers want different buttons
 * (Table's is a fixed `+ Add column`; ROR's shows the field currently picked and has to pass for an
 * `@atlaskit/select`), and ROR's Suspense fallback has to render that same button with no picker
 * behind it at all — so the trigger cannot be something this component owns.
 *
 * **This is conditional sharing, and that is the standing risk.** There is a portal path (Table) and
 * an inline path (ROR) differing in focus, stacking, and whether the popup root scrolls, and four of
 * the props below exist for one caller. If a third divergence appears, the honest move is two
 * components over a shared `PickerPanel` rather than a fifth flag. See § Risks 4.
 */
import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
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
   * **Safe only while nothing in the ancestry has a `transform`.** A transformed ancestor makes the
   * panel positioned relative to it *and clipped by it*, and a second **stacked modal** has one:
   * `positioner.js` applies `transform: translateY(...)` at `stackIndex > 0`. Checked for ROR — the
   * only other overlay in that island, `DeleteConfirm`, is itself a `Popup`, not a `Modal`, and it
   * opens from a node row the Add Report dialog covers, so `stackIndex` cannot leave 0 today. It
   * would stop being safe the moment a second `Modal` can stack, or someone puts a CSS transition on
   * the modal; the fallbacks then are the portal path plus `data-no-focus-lock` on the panel, or a
   * `focusLockAllowlist` on `<Modal>`.
   *
   * **And every focus conclusion here rests on `platform_dst_popup-disable-focuslock` resolving
   * `false`**, which it does because no feature-flag resolver is installed. `@atlaskit/popup` has two
   * entirely separate focus code paths behind that flag (`use-focus-manager.js`,
   * `use-close-manager.js`), so one `setBooleanFeatureFlagResolver` call anywhere in this app — or a
   * default flip in a version bump — changes popup-in-modal focus wholesale.
   *
   * See spec/031-column-select-redesign § 8 and Risks 2 and 3.
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

/**
 * Close on Escape ourselves, from a **capture-phase `window` listener that stops the event there**.
 *
 * `@atlaskit/popup` already closes itself on Escape, and `@atlaskit/layering` is supposed to be what
 * stops the same press *also* closing an enclosing `@atlaskit/modal-dialog`: the modal wraps in a
 * `<Layering>` (level 1), the open popup wraps its content in another (level 2), and the modal's
 * `useCloseOnEscapePress` bails on `isLayerDisabled()`.
 *
 * **In this install that coordination does not happen, and cannot.** `@atlaskit/popup` resolves
 * `@atlaskit/layering` to its own nested copy (0.8.0) and `@atlaskit/modal-dialog` to its own
 * (0.7.3) — verified with `require.resolve`. Two copies of the module are two distinct React
 * contexts, so the popup's level push is written into a `TopLevelContext` the modal never reads. The
 * modal therefore still sees level 1, `isLayerDisabled()` returns `false`, and **one Escape closes
 * both the panel and the dialog** — which is how spec/031 phase 8's layering test first failed.
 *
 * Both library listeners are bubble-phase on `window` (`use-close-manager.js`'s `bindAll`, and
 * layering's `useCloseOnEscapePress`), so a capture-phase listener on `window` runs before either of
 * them and before the event even reaches the search input. Stopping propagation there is what keeps
 * the press scoped to one layer without depending on which copy of `layering` won.
 *
 * This is why nothing else writes an Escape handler: a React `onKeyDown` on the search input would
 * be far too late — it fires between the two window listeners' phases — and `stopPropagation` from
 * there is at the mercy of where React attached its root listener.
 *
 * Closing by flipping `isOpen` keeps focus return intact: `Popup` unmounts its content and
 * `focus-trap`'s `returnFocusOnDeactivate` puts the cursor back on the trigger, exactly as it does
 * when an option is clicked.
 *
 * See spec/031-column-select-redesign § 6 and § 11 — this **supersedes** their conclusion that the
 * layering chain handles it.
 */
const useCloseOnEscapeBeforeAnyLayer = (isOpen: boolean, close: () => void) => {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // `Esc` as well as `Escape`: `use-close-manager.js` accepts both, so this has to shadow both.
      if (event.key !== 'Escape' && event.key !== 'Esc') return;

      event.stopPropagation();
      event.preventDefault();
      close();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });

    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isOpen, close]);
};

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

  const close = useCallback(() => setIsOpen(false), []);

  useCloseOnEscapeBeforeAnyLayer(isOpen, close);

  // Here rather than in the panel: the panel unmounts on every close, so the choice would not
  // survive close/reopen if it lived there — which is visible even with no storage key.
  const [layout, setLayout] = usePickerLayout(layoutStorageKey);

  return (
    <Popup
      isOpen={isOpen}
      // No `setSearch('')` to go with this: the panel holds the query and `Popup` renders nothing
      // when closed, so closing unmounts it and the query goes with it.
      //
      // Still wired even though Escape is intercepted above — this is also Popup's outside-click
      // close, which is untouched.
      onClose={close}
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
