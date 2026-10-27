import type { FC, KeyboardEvent } from 'react';

import React from 'react';

import ScrollableTabList from '../../../SettingsSidebar/components/TeamConfiguration/components/Teams/components/ScrollableTabList';
import type { FilterTab } from '../Filters/hooks/useFilterTabs';

export const filterTabId = (key: string) => `filters-panel-tab-${key}`;
export const FILTER_TAB_PANEL_ID = 'filters-panel-tabpanel';

interface FilterTabsProps {
  tabs: FilterTab[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

/**
 * The Filters panel's tab strip: one tab per level with an active-filter badge. Arrow keys move
 * between tabs (roving `tabIndex`, as in `ViewReports`). `ScrollableTabList` scrolls the strip
 * sideways, shows its arrows only while there's more strip that way, and reveals a focused tab.
 */
const FilterTabs: FC<FilterTabsProps> = ({ tabs, selectedKey, onSelect }) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) {
      return;
    }
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onSelect(next.key);
    document.getElementById(filterTabId(next.key))?.focus();
  };

  return (
    <div className="border-b border-neutral-41 px-4">
      <ScrollableTabList>
        <div role="tablist" aria-label="Filter levels" className="flex gap-1">
          {tabs.map(({ key, label, count }, index) => {
            const selected = key === selectedKey;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={filterTabId(key)}
                aria-selected={selected}
                aria-controls={FILTER_TAB_PANEL_ID}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(key)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-2 pt-1 text-sm font-medium ${
                  selected
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-neutral-801 hover:text-neutral-800'
                }`}
              >
                {label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-xs font-semibold ${
                      selected ? 'bg-blue-101 text-blue-400' : 'bg-neutral-20 text-neutral-801'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollableTabList>
    </div>
  );
};

export default FilterTabs;
