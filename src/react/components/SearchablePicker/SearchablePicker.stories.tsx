/**
 * **These stories are not optional polish — they are the only verification this component has for
 * most of what it does.**
 *
 * jsdom has no layout, so the three-column grid, the sticky headers, the scrollport, the
 * scroll-into-view math, the truncation of a long label in a narrow cell, and every z-order and
 * pixel claim are unassertable in the unit suite. `vitest.setup.ts` says as much in its own comment
 * about the inert observer stubs. Everything in `SearchablePicker.test.tsx` is a proxy for what is
 * checked here by eye.
 *
 * See spec/031-column-select-redesign § 13.
 */
import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SearchablePicker, type PickerItem } from './SearchablePicker';

const item = (label: string, group: string): PickerItem => ({ id: `${group}:${label}`, label, group });

const of = (group: string, ...labels: string[]) => labels.map((label) => item(label, group));

/**
 * Six groups of 1 to 11, deliberately ragged: the single-item `Derived` band sits beside an 11-item
 * one, which is the uneven case the full-width band layout exists for. If groups were laid out as
 * columns instead, `Derived` would leave two dead cells and `Fields` would wrap under them.
 */
const GROUPS = ['Derived', 'Identity', 'Common', 'Report Fields', 'Fields', 'Computed'];

const catalog: PickerItem[] = [
  ...of('Derived', 'Latest Comment'),
  ...of('Identity', 'Issue Key', 'Issue Type', 'Summary', 'Hierarchy'),
  ...of('Common', 'Summary', 'Status', 'Assignee', 'Reporter', 'Priority', 'Issue Type', 'Due Date', 'Labels'),
  ...of('Report Fields', 'Start Date', 'Due Date', 'Estimated Days', 'Timed Days', 'Rolled Up Days'),
  ...of(
    'Fields',
    'Acceptance Criteria',
    'Affects Version',
    'Components',
    'Epic Link',
    'Fix Version',
    'Original Estimate',
    'Rank',
    'Sprint',
    'Story Points',
    'Team',
    'Time Spent',
  ),
  ...of('Computed', 'Percent Complete', 'Work Status'),
];

/** The trigger is a render prop, so every story supplies one; this is the plain case. */
const Picker: React.FC<Partial<React.ComponentProps<typeof SearchablePicker>>> = (props) => {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 p-6">
      <SearchablePicker
        items={catalog}
        groupOrder={GROUPS}
        placeholder="Search fields…"
        emptyMessage="No fields match."
        testIdPrefix="story-picker"
        onSelect={setPicked}
        trigger={(triggerProps, toggle) => (
          <button
            {...triggerProps}
            type="button"
            className="inline-flex h-8 cursor-pointer items-center rounded bg-neutral-201 px-2 text-sm leading-4 hover:bg-neutral-301"
            onClick={toggle}
          >
            Choose a field
          </button>
        )}
        {...props}
      />
      <p className="text-sm text-slate-600">
        Picked: <span className="font-mono">{picked ?? '—'}</span>
      </p>
    </div>
  );
};

const meta: Meta<typeof SearchablePicker> = {
  title: 'Components/SearchablePicker',
  component: SearchablePicker,
};
export default meta;

type Story = StoryObj<typeof SearchablePicker>;

// Parked with the `Compact` story below.
// const COMPACT_SEED_KEY = 'story-picker-compact-seed';

/**
 * **The default review story.** Open it and check, in this order:
 *
 * 1. Three columns, equal width, groups in `groupOrder` top to bottom.
 * 2. **No group continues on the previous group's line** — `Derived`'s single item leaves the rest
 *    of its row empty rather than pulling `Identity`'s first item up beside it.
 * 3. Scroll: each group's header sticks to the top of the scrollport and the rows pass **under** it,
 *    not over it. The header's background must be opaque for the whole scrollport width — no sliver
 *    of a row visible beside it.
 * 4. Arrow keys move a blue highlight in reading order; ↑/↓ keep the column and clamp into the
 *    ragged last row of a group; the search field keeps focus and the caret throughout, and ←/→ move
 *    the caret first while there is text to move through.
 *
 * There is no expand/collapse footer: the panel is always expanded (see `PickerPanel`'s
 * commented-out footer). The compact branch is still live code, reviewable via the parked `Compact`
 * story below.
 */
export const Expanded: Story = { render: () => <Picker /> };

/**
 * **Parked with the toggle.** The panel is always expanded — see `PickerPanel`'s commented-out
 * footer. Left here because the compact branch is still live code (`layout`/`isGrid` drive it, and
 * `picker-grid.ts` treats one column as the same code path), so this is the story that reviews it
 * the day the control comes back. Uncomment then.
 *
export const Compact: Story = {
  decorators: [
    (Story) => {
      // In a decorator, not `play`: `play` runs after the story mounts, and the layout is read once
      // when `SearchablePicker` mounts. Seeded only when absent, so a toggle here persists.
      if (window.localStorage.getItem(COMPACT_SEED_KEY) === null) {
        window.localStorage.setItem(COMPACT_SEED_KEY, '"compact"');
      }

      return <Story />;
    },
  ],
  render: () => <Picker layoutStorageKey={COMPACT_SEED_KEY} />,
};
 */

/** The check sits at the right of its row and must not push the label into the next column. */
export const WithSelection: Story = {
  render: () => <Picker selectedId="Common:Assignee" />,
};

/**
 * `Common` keeps the order it was passed (Summary / Status / Assignee first, as `fieldCatalog.ts`
 * curates it); every other group sorts. Compare against `Expanded`, where `Common` is alphabetical.
 */
export const WithCuratedGroup: Story = {
  render: () => <Picker unsortedGroups={['Common']} />,
};

/**
 * **The case the redesign exists for.** 180 fields is what a real Jira instance returns, and one per
 * row in a 288px column is not a list anyone can scan.
 *
 * Also the scroll-into-view check: hold ↓ to the bottom and back. The active row must stay visible,
 * must never end up **under** its own sticky group header, and the *page* must not scroll — the
 * effect writes `container.scrollTop` rather than calling `scrollIntoView()`, precisely because that
 * would scroll every scrollable ancestor.
 */
export const ManyFields: Story = {
  render: () => (
    <Picker
      items={[
        ...of('Common', 'Summary', 'Status', 'Assignee'),
        ...Array.from({ length: 180 }, (_, at) => item(`Custom Field ${at + 1}`, 'Fields')),
      ]}
    />
  ),
};

/**
 * A grid cell's `min-width` is `auto`, so without `min-w-0 truncate` a name this long blows its
 * column out and the other two collapse. It must truncate with an ellipsis, keep all three columns
 * equal, and show the full name on hover via `title`.
 */
export const LongLabels: Story = {
  render: () => (
    <Picker
      items={[
        ...of('Common', 'Summary', 'Status', 'Assignee'),
        ...of(
          'Fields',
          'Original story point estimate for the delivery workstream',
          'Acceptance criteria as agreed with the platform team',
          'Sprint',
          'Team',
        ),
      ]}
    />
  ),
};

/**
 * Nothing to offer at all — the empty message, and the footer still usable beneath it. The same
 * state a query that matches nothing produces, which is worth typing into `Expanded` to compare.
 */
export const Empty: Story = {
  render: () => <Picker items={[]} />,
};
