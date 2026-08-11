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
import React, { useMemo, useState, type ReactNode } from 'react';
import Popup, { type TriggerProps } from '@atlaskit/popup';
import Textfield from '@atlaskit/textfield';

export interface PickerItem {
  id: string;
  label: string;
  group: string;
}

export interface SearchablePickerProps {
  items: PickerItem[];
  /** Groups render in this order; an item whose group isn't listed is dropped. */
  groupOrder: readonly string[];
  /** Ids to hide — Table's "already shown" filter. */
  excludeIds?: readonly string[];
  placeholder: string;
  emptyMessage: string;
  /** `foo` yields `foo`, `foo-popover`, `foo-search`, and `foo-option` test ids. */
  testIdPrefix: string;
  trigger: (triggerProps: TriggerProps, toggle: () => void) => ReactNode;
  onSelect: (id: string) => void;
}

export const SearchablePicker: React.FC<SearchablePickerProps> = ({
  items,
  groupOrder,
  excludeIds,
  placeholder,
  emptyMessage,
  testIdPrefix,
  trigger,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  const grouped = useMemo(() => {
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
    <Popup
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        setSearch('');
      }}
      placement="bottom-start"
      content={() => (
        <div className="p-3 w-72 flex flex-col gap-2" data-testid={`${testIdPrefix}-popover`}>
          <Textfield
            testId={`${testIdPrefix}-search`}
            placeholder={placeholder}
            value={search}
            autoFocus
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
          <div className="max-h-72 overflow-auto flex flex-col gap-2">
            {grouped.length === 0 && <div className="text-neutral-801 text-xs px-1">{emptyMessage}</div>}
            {grouped.map((section) => (
              <div key={section.group} className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-801 px-1 py-1">{section.group}</span>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`${testIdPrefix}-option`}
                    className="text-left text-sm px-2 py-1 rounded hover:bg-neutral-201"
                    onClick={() => {
                      onSelect(item.id);
                      setSearch('');
                      setIsOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      trigger={(triggerProps) => trigger(triggerProps, () => setIsOpen((open) => !open))}
    />
  );
};

export default SearchablePicker;
