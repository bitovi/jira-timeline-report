import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

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
