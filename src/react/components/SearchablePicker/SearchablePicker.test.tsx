import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { SearchablePicker, type PickerItem } from './SearchablePicker';

const items: PickerItem[] = [
  { id: 'a', label: 'Assignee', group: 'Common' },
  { id: 'b', label: 'Story Points', group: 'Fields' },
  { id: 'c', label: 'Story Points', group: 'Report Fields' },
  { id: 'd', label: 'Hidden', group: 'Ignored' },
];

const renderPicker = (props: Partial<React.ComponentProps<typeof SearchablePicker>> = {}) =>
  render(
    <SearchablePicker
      items={items}
      groupOrder={['Common', 'Report Fields', 'Fields']}
      placeholder="Search fields…"
      emptyMessage="No fields to add."
      testIdPrefix="picker"
      onSelect={vi.fn()}
      trigger={(triggerProps, toggle) => (
        <button {...triggerProps} type="button" data-testid="picker" onClick={toggle}>
          Open
        </button>
      )}
      {...props}
    />,
  );

const open = () => fireEvent.click(screen.getByTestId('picker'));

// `fireEvent`, not `userEvent`: the search field lives in a popper portal that repositions as it
// mounts, and `userEvent.type`'s per-keystroke awaits let it type into a stale node under load —
// which showed up as this file passing alone and failing in the full suite.
const search = (text: string) => fireEvent.change(screen.getByTestId('picker-search'), { target: { value: text } });

describe('<SearchablePicker>', () => {
  // A persisted `compact` would otherwise leak from one test into the next — the convention at
  // `SelectCloud.test.tsx:56-63`.
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('opens on the trigger and closes on select', () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });

    expect(screen.queryByTestId('picker-popover')).not.toBeInTheDocument();
    open();
    fireEvent.click(screen.getByText('Assignee'));

    expect(onSelect).toHaveBeenCalledWith('a');
    expect(screen.queryByTestId('picker-popover')).not.toBeInTheDocument();
  });

  it('filters by case-insensitive substring, not prefix', () => {
    renderPicker();
    open();

    search('point');

    expect(screen.getAllByText('Story Points')).toHaveLength(2);
    expect(screen.queryByText('Assignee')).not.toBeInTheDocument();
  });

  it('renders groups in groupOrder and drops groups not listed', () => {
    renderPicker();
    open();

    const headings = within(screen.getByTestId('picker-popover'))
      .getAllByText(/^(Common|Report Fields|Fields|Ignored)$/)
      .map((el) => el.textContent);

    expect(headings).toEqual(['Common', 'Report Fields', 'Fields']);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('drops a group once filtering empties it', () => {
    renderPicker();
    open();

    search('assignee');

    expect(screen.getByText('Common')).toBeInTheDocument();
    expect(screen.queryByText('Fields')).not.toBeInTheDocument();
  });

  it('honours excludeIds', () => {
    renderPicker({ excludeIds: ['a'] });
    open();

    expect(screen.queryByText('Assignee')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('picker-option')).toHaveLength(2);
  });

  it('shows the empty message when nothing matches', () => {
    renderPicker();
    open();

    search('nothing matches this');

    expect(screen.getByText('No fields to add.')).toBeInTheDocument();
    expect(screen.queryAllByTestId('picker-option')).toHaveLength(0);
  });

  it('clears the search between openings', () => {
    renderPicker();
    open();
    search('assignee');
    fireEvent.click(screen.getByText('Assignee'));

    open();

    expect(screen.getByTestId('picker-search')).toHaveValue('');
    expect(screen.getAllByTestId('picker-option')).toHaveLength(3);
  });

  // The trigger is a combobox over a listbox, from us; `ref`, `aria-expanded` and `aria-controls`
  // come from Popup (`popup.js:126-131`). Callers just spread `triggerProps`.
  // See spec/031-column-select-redesign § 7.
  it('gives the trigger combobox semantics and a deterministic aria-controls', () => {
    renderPicker();

    const trigger = screen.getByTestId('picker');

    expect(trigger).toHaveAttribute('role', 'combobox');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Generated ids are unassertable (`popup.js:88` falls back to `useId`), so the popup is given one.
    expect(trigger).not.toHaveAttribute('aria-controls');

    open();

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', 'picker-popup');
  });

  // `shouldRenderToParent` exists for one caller — ROR's, inside a modal, where a portalled panel
  // loses focus to `react-focus-lock`. Table must keep the portal path exactly as it is, so the
  // default has to be provably off. See spec/031-column-select-redesign § 8.
  describe('shouldRenderToParent', () => {
    // `.atlaskit-portal` is the class `@atlaskit/portal`'s `createContainer` sets
    // (`portal-dom-utils.js:14-18`), so it is the honest test for "did this go through the portal".
    const popoverIsPortalled = () => screen.getByTestId('picker-popover').closest('.atlaskit-portal') !== null;

    it('portals by default, as Table needs', () => {
      renderPicker();
      open();

      expect(popoverIsPortalled()).toBe(true);
    });

    it('renders beside the trigger when asked, as a caller inside a dialog needs', () => {
      renderPicker({ shouldRenderToParent: true });
      open();

      expect(popoverIsPortalled()).toBe(false);
      // Beside the trigger, not merely un-portalled: `popup.js:128` skips the portal branch and the
      // panel becomes a sibling under react-popper's `Manager`.
      expect(screen.getByTestId('picker').parentElement).toContainElement(screen.getByTestId('picker-popover'));
    });
  });
});

// The one layout assertion that still describes today's behaviour.
describe('<SearchablePicker> AlwaysExpanded', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('opens expanded and offers no way to collapse', () => {
    renderPicker();
    open();

    expect(screen.getByTestId('picker-popover')).toHaveAttribute('data-picker-layout', 'expanded');
    expect(screen.queryByTestId('picker-layout-toggle')).not.toBeInTheDocument();
  });

  // The guard that makes the constant worth having over the hook: a `"compact"` left behind by an
  // earlier build must not strand anyone in a layout with no control to get out of it.
  it('ignores a compact value left in storage, which nothing can now undo', () => {
    localStorage.setItem('picker-layout', '"compact"');
    renderPicker({ layoutStorageKey: 'picker-layout' });
    open();

    expect(screen.getByTestId('picker-popover')).toHaveAttribute('data-picker-layout', 'expanded');
  });

  it('writes nothing to storage, since there is no choice to remember', () => {
    renderPicker({ layoutStorageKey: 'picker-layout' });
    open();
    fireEvent.click(screen.getByText('Assignee'));

    expect(localStorage.length).toBe(0);
  });
});

/**
 * **The panel is always expanded and the toggle is parked** — see `PickerPanel`'s commented-out
 * footer for why and how to restore it. So this whole suite is skipped rather than deleted: it is
 * the spec for the layout choice, and it should come back with the control.
 *
 * What stays live is `AlwaysExpanded` below, plus `picker-grid.test.ts`'s one-column cases (pure
 * math, still correct) and `usePickerLayout.test.ts`'s `parseLayout` guards (that code is untouched).
 *
 * See spec/031-column-select-redesign § 5 and § 3.
 */
describe.skip('<SearchablePicker> layout', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const layout = () => screen.getByTestId('picker-popover').getAttribute('data-picker-layout');
  const toggle = () => screen.getByTestId('picker-layout-toggle');
  /** The trigger both opens and closes; `use-close-manager` treats it as inside, not as an outside click. */
  const close = () => fireEvent.click(screen.getByTestId('picker'));

  it('opens expanded, because a 180-entry group is unscannable one per row', () => {
    renderPicker();
    open();

    expect(layout()).toBe('expanded');
    expect(toggle()).toHaveAccessibleName('Collapse field list');
    expect(toggle()).toHaveTextContent('Collapse');
  });

  it('flips the layout, the label and the accessible name on the toggle', () => {
    renderPicker();
    open();

    fireEvent.click(toggle());

    expect(layout()).toBe('compact');
    expect(toggle()).toHaveAccessibleName('Expand field list');
    expect(toggle()).toHaveTextContent('Expand');

    fireEvent.click(toggle());

    expect(layout()).toBe('expanded');
  });

  it('remembers the choice across close and reopen, as JSON under the given key', () => {
    renderPicker({ layoutStorageKey: 'picker-layout' });
    open();
    fireEvent.click(toggle());
    close();

    open();

    expect(layout()).toBe('compact');
    // The default `serialize` is `JSON.stringify`, and only the read side is guarded — so the stored
    // value has to stay JSON or `parseLayout` would be reading something it never wrote.
    expect(localStorage.getItem('picker-layout')).toBe('"compact"');
  });

  it('opens compact from a pre-seeded key', () => {
    localStorage.setItem('picker-layout', '"compact"');
    renderPicker({ layoutStorageKey: 'picker-layout' });
    open();

    expect(layout()).toBe('compact');
  });

  it('opens expanded from a value nobody should have written, rather than throwing', () => {
    localStorage.setItem('picker-layout', 'not json');
    renderPicker({ layoutStorageKey: 'picker-layout' });
    open();

    expect(layout()).toBe('expanded');
  });

  it('keeps the choice for the mount but writes nothing without a key', () => {
    renderPicker();
    open();
    fireEvent.click(toggle());
    close();

    open();

    // The choice lives in `SearchablePicker`, which stays mounted — the panel does not.
    expect(layout()).toBe('compact');
    expect(localStorage.length).toBe(0);
  });

  it('starts a fresh mount expanded when there is no key to read', () => {
    renderPicker();
    open();
    fireEvent.click(toggle());
    cleanup();

    renderPicker();
    open();

    expect(layout()).toBe('expanded');
  });

  it('does not read or write another picker’s key', () => {
    localStorage.setItem('other-picker-layout', '"compact"');
    renderPicker({ layoutStorageKey: 'picker-layout' });
    open();

    // Expanded despite the other key saying compact — each caller passes its own, so expanding in
    // the modal does not also expand the table's picker.
    expect(layout()).toBe('expanded');

    fireEvent.click(toggle());

    expect(localStorage.getItem('picker-layout')).toBe('"compact"');
    expect(localStorage.getItem('other-picker-layout')).toBe('"compact"');

    fireEvent.click(toggle());

    expect(localStorage.getItem('picker-layout')).toBe('"expanded"');
    expect(localStorage.getItem('other-picker-layout')).toBe('"compact"');
  });
});

describe('<SearchablePicker> selectedId', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('checks exactly the picked row', () => {
    renderPicker({ selectedId: 'a' });
    open();

    expect(screen.getAllByRole('option', { selected: true })).toHaveLength(1);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent('Assignee');
    expect(screen.getAllByTestId('picker-check')).toHaveLength(1);
  });

  // `AddColumnButton` never passes one, so "no check anywhere" is the case that guards it.
  it('checks nothing when no id is given', () => {
    renderPicker();
    open();

    expect(screen.queryAllByRole('option', { selected: true })).toHaveLength(0);
    expect(screen.queryAllByTestId('picker-check')).toHaveLength(0);
  });
});

/**
 * `TableReportControls.test.tsx:92-94` reaches a group's options through
 * `getByText('Fields').closest('div')`. Re-asserted here so it fails in the picker's own file first,
 * and in **both** layouts — the expanded one puts a grid wrapper between the band and its options,
 * which `within` sees through but `.closest('div')` from the header must still land above.
 */
describe('<SearchablePicker> the group-header traversal other suites depend on', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const optionInFieldsGroup = () => {
    const popover = screen.getByTestId('picker-popover');
    const fieldsSection = within(popover).getByText('Fields').closest('div') as HTMLElement;

    return within(fieldsSection).getByText('Story Points');
  };

  it('lands on the element that also holds that group’s options, expanded', () => {
    renderPicker();
    open();

    expect(screen.getByTestId('picker-popover')).toHaveAttribute('data-picker-layout', 'expanded');
    expect(optionInFieldsGroup()).toBeInTheDocument();
  });

  // Parked with the toggle. The expanded case above is the one that runs in production, and it is
  // the harder of the two — it has a grid wrapper between the band and its options.
  it.skip('lands on the element that also holds that group’s options, compact', () => {
    renderPicker();
    open();
    fireEvent.click(screen.getByTestId('picker-layout-toggle'));

    expect(screen.getByTestId('picker-popover')).toHaveAttribute('data-picker-layout', 'compact');
    expect(optionInFieldsGroup()).toBeInTheDocument();
  });

  it('names each band with its own header, for AT', () => {
    renderPicker();
    open();

    const bands = screen.getAllByRole('group');

    expect(bands).toHaveLength(3);
    bands.forEach((band) => {
      const header = document.getElementById(band.getAttribute('aria-labelledby') ?? '');

      expect(header).not.toBeNull();
      expect(band).toContainElement(header);
    });
  });
});

// ---------------------------------------------------------------------------------------------------
// Keyboard navigation. See spec/031-column-select-redesign § 6.
//
// Every label carries "Date" so a single query can leave the whole grid matching — which is what
// lets the "←/→ are the caret's while there is text to move through" case be tested at all.
// ---------------------------------------------------------------------------------------------------

const gridItems: PickerItem[] = [
  { id: 'g1', label: 'Created Date', group: 'Common' },
  { id: 'g2', label: 'Due Date', group: 'Common' },
  { id: 'g3', label: 'End Date', group: 'Fields' },
  { id: 'g4', label: 'Resolved Date', group: 'Fields' },
  { id: 'g5', label: 'Start Date', group: 'Fields' },
  { id: 'g6', label: 'Target Date', group: 'Fields' },
  { id: 'g7', label: 'Updated Date', group: 'Fields' },
];

describe('<SearchablePicker> keyboard navigation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  // 3 columns over groups of 2 and 5, so the rows are [g1 g2] [g3 g4 g5] [g6 g7] — a group boundary
  // that is also a row boundary, and a ragged last row.
  const renderGrid = (props: Partial<React.ComponentProps<typeof SearchablePicker>> = {}) =>
    renderPicker({ items: gridItems, groupOrder: ['Common', 'Fields'], ...props });

  const searchField = () => screen.getByTestId('picker-search') as HTMLInputElement;
  const active = () => searchField().getAttribute('aria-activedescendant');
  const press = (key: string) => fireEvent.keyDown(searchField(), { key });
  /** ←/→ only reach the grid at a collapsed caret on a text boundary, so tests have to say where it is. */
  const putCaretAt = (at: number) => searchField().setSelectionRange(at, at);

  it('starts on the first option', () => {
    renderGrid();
    open();

    expect(active()).toBe('picker-option-g1');
  });

  /**
   * **The keyboard handler is on the search input, so focus landing there is what makes every case
   * below reachable at all.**
   *
   * The mechanism is `ContentProps.setInitialFocusRef`, threaded to the field's `ref`, because
   * `use-focus-manager.js` builds its trap with `initialFocus: initialFocusRef || popupRef` — so
   * without it focus-trap focuses the popup's own root `<div tabIndex={0}>` and no arrow key ever
   * reaches the input. That was measured in a real browser, where React's `autoFocus` lost to the
   * trap's later frame.
   *
   * **What this test does and does not prove, checked by trying both:** it fails if the field has no
   * focus mechanism at all, and it passes either way with `autoFocus` *or* the ref — jsdom does not
   * discriminate, because focus-trap does not take focus back here. So it guards the crude
   * regression only; the browser is the only place the real one shows, hence the story.
   *
   * Every other case in this block drives the field with `fireEvent` on the node directly, which
   * needs no focus — which is exactly how the whole keyboard story passed green while being dead.
   */
  it('puts the caret in the search field, not on the popup root', async () => {
    renderGrid();
    open();

    // The trap activates in an animation frame, so it is not focused synchronously on open.
    await waitFor(() => expect(searchField()).toHaveFocus());
  });

  it('moves down and up one visual row, keeping the column', () => {
    renderGrid();
    open();

    press('ArrowDown');
    expect(active()).toBe('picker-option-g3');

    press('ArrowDown');
    expect(active()).toBe('picker-option-g6');

    press('ArrowUp');
    expect(active()).toBe('picker-option-g3');
  });

  it('clamps at both ends rather than wrapping', () => {
    renderGrid();
    open();

    press('ArrowUp');
    expect(active()).toBe('picker-option-g1');

    press('ArrowDown');
    press('ArrowDown');
    press('ArrowDown');
    expect(active()).toBe('picker-option-g6');
  });

  describe('left and right', () => {
    it('walk the grid in reading order when the caret has nowhere to go', () => {
      renderGrid();
      open();

      press('ArrowRight');
      expect(active()).toBe('picker-option-g2');

      // Off the end of the *group*, which is also the end of the row — no special case for either.
      press('ArrowRight');
      expect(active()).toBe('picker-option-g3');

      press('ArrowLeft');
      expect(active()).toBe('picker-option-g2');
    });

    it('are left to the caret while there is text to move through', () => {
      renderGrid();
      open();
      search('date');
      putCaretAt(2);

      press('ArrowRight');
      press('ArrowLeft');

      // Still the first match — the search box has to stay editable.
      expect(active()).toBe('picker-option-g1');
    });

    // Parked with the toggle — there is no way to reach the compact layout from the UI today.
    // `picker-grid.test.ts` still covers one-column movement as pure math.
    it.skip('are ignored entirely in the compact layout, which has no second axis', () => {
      renderGrid();
      open();
      fireEvent.click(screen.getByTestId('picker-layout-toggle'));

      press('ArrowRight');

      expect(active()).toBe('picker-option-g1');
    });
  });

  // Parked with the toggle. The property it asserts is structural — `activeIndex` indexes the flat
  // list, which is layout-independent — so it costs nothing while the toggle is away.
  it.skip('keeps the same option active across a layout toggle', () => {
    renderGrid();
    open();
    press('ArrowDown');
    expect(active()).toBe('picker-option-g3');

    fireEvent.click(screen.getByTestId('picker-layout-toggle'));

    // Flat reading order is layout-independent, so this costs no bookkeeping. And compact is one
    // column, so from here Down is +1.
    expect(active()).toBe('picker-option-g3');

    press('ArrowDown');
    expect(active()).toBe('picker-option-g4');
  });

  it('selects the active option on Enter and closes', () => {
    const onSelect = vi.fn();
    renderGrid({ onSelect });
    open();

    press('ArrowDown');
    press('Enter');

    expect(onSelect).toHaveBeenCalledWith('g3');
    expect(screen.queryByTestId('picker-popover')).not.toBeInTheDocument();
  });

  it('does nothing on Enter with no matches', () => {
    const onSelect = vi.fn();
    renderGrid({ onSelect });
    open();
    search('nothing matches this');

    press('Enter');

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('picker-popover')).toBeInTheDocument();
  });

  it('resets to the first match on a new query', () => {
    renderGrid();
    open();
    press('ArrowDown');
    press('ArrowRight');
    expect(active()).toBe('picker-option-g4');

    search('start');

    expect(active()).toBe('picker-option-g5');
  });

  it('follows the mouse, so hover and the keyboard cannot disagree', () => {
    renderGrid();
    open();

    fireEvent.mouseEnter(screen.getByText('Target Date'));

    expect(active()).toBe('picker-option-g6');
  });

  // Escape is intercepted by `useCloseOnEscapeBeforeAnyLayer`, a capture-phase `window` listener, and
  // stopped there — because `@atlaskit/popup` and `@atlaskit/modal-dialog` resolve two separate
  // copies of `@atlaskit/layering`, so the library's own level coordination cannot scope the press.
  // The dialog half of that contract is asserted in `AddReportModal.test.tsx`; this is the half that
  // says the panel still closes, and that closing is not a selection.
  it('closes the popover on Escape, and selects nothing', () => {
    const onSelect = vi.fn();
    renderGrid({ onSelect });
    open();

    press('Escape');

    expect(screen.queryByTestId('picker-popover')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  /**
   * Scrolling the active row into view writes `container.scrollTop` directly. `scrollIntoView()`
   * scrolls **every** scrollable ancestor including the page, so inside a modal it drags the dialog
   * — and jsdom does not implement it at all, so a stray call would throw here rather than in a
   * browser.
   */
  it('never calls scrollIntoView', () => {
    const scrollIntoView = vi.fn();
    // jsdom omits it entirely, so this is an addition, not an override — hence the explicit delete.
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = scrollIntoView;

    try {
      renderGrid();
      open();
      press('ArrowDown');
      press('ArrowRight');
      press('ArrowUp');

      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      delete (Element.prototype as unknown as { scrollIntoView?: () => void }).scrollIntoView;
    }
  });
});

// See spec/031-column-select-redesign § 4.
describe('<SearchablePicker> sorting', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const curated: PickerItem[] = [
    { id: 'z', label: 'Zulu', group: 'Common' },
    { id: 'a', label: 'Alpha', group: 'Common' },
    { id: 'y', label: 'Yankee', group: 'Fields' },
    { id: 'b', label: 'Bravo', group: 'Fields' },
  ];

  const labels = () => screen.getAllByTestId('picker-option').map((option) => option.textContent);

  it('sorts within each group by default, because a 3-column grid is only scannable sorted', () => {
    renderPicker({ items: curated, groupOrder: ['Common', 'Fields'] });
    open();

    expect(labels()).toEqual(['Alpha', 'Zulu', 'Bravo', 'Yankee']);
  });

  it('leaves a listed group in the order the caller passed', () => {
    renderPicker({ items: curated, groupOrder: ['Common', 'Fields'], unsortedGroups: ['Common'] });
    open();

    // `Common` is curated in its useful order on purpose (`fieldCatalog.ts:57-68`); `Fields` is not.
    expect(labels()).toEqual(['Zulu', 'Alpha', 'Bravo', 'Yankee']);
  });
});
