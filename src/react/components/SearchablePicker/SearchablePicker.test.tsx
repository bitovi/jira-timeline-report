import React from 'react';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';

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

// See spec/031-column-select-redesign § 5 and § 3.
describe('<SearchablePicker> layout', () => {
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

  it('lands on the element that also holds that group’s options, compact', () => {
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
