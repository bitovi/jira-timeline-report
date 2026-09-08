/**
 * Everything inside {@link SearchablePicker}'s popover: the search field, the grouped list, and the
 * layout toggle.
 *
 * **Moving `search` in here is a simplification, not a relocation.** `Popup` renders nothing at all
 * when closed, so this component unmounts on every close and takes the query, the refs and the
 * active index with it. That is why `SearchablePicker` no longer clears the query on select or on
 * close: "clears the search between openings" now holds for a structural reason rather than a
 * bookkeeping one.
 *
 * See spec/031-column-select-redesign § 2 and § 5.
 */
import React, { useMemo, useState } from 'react';
import Textfield from '@atlaskit/textfield';

import type { PickerItem } from './SearchablePicker';
import type { PickerSection } from './usePickerKeyboard';

export interface PickerPanelProps {
  items: PickerItem[];
  groupOrder: readonly string[];
  excludeIds?: readonly string[];
  placeholder: string;
  emptyMessage: string;
  testIdPrefix: string;
  /** Selects **and** closes — the panel does not distinguish the two. */
  onSelect: (id: string) => void;
}

export const PickerPanel: React.FC<PickerPanelProps> = ({
  items,
  groupOrder,
  excludeIds,
  placeholder,
  emptyMessage,
  testIdPrefix,
  onSelect,
}) => {
  const [search, setSearch] = useState('');

  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  const sections = useMemo<PickerSection[]>(() => {
    const needle = search.trim().toLowerCase();
    const available = items.filter(
      (item) => !excluded.has(item.id) && (needle === '' || item.label.toLowerCase().includes(needle)),
    );

    return groupOrder
      .map((group) => ({
        group,
        items: available.filter((item) => item.group === group),
      }))
      .filter((section) => section.items.length > 0);
  }, [items, excluded, search, groupOrder]);

  return (
    <div className="p-3 w-72 flex flex-col gap-2" data-testid={`${testIdPrefix}-popover`}>
      <Textfield
        testId={`${testIdPrefix}-search`}
        placeholder={placeholder}
        value={search}
        autoFocus
        onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
      />
      <div className="max-h-72 overflow-auto flex flex-col gap-2">
        {sections.length === 0 && <div className="text-neutral-801 text-xs px-1">{emptyMessage}</div>}
        {sections.map((section) => (
          <div key={section.group} className="flex flex-col">
            <span className="text-xs font-semibold text-neutral-801 px-1 py-1">{section.group}</span>
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`${testIdPrefix}-option`}
                className="text-left text-sm px-2 py-1 rounded hover:bg-neutral-201"
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PickerPanel;
