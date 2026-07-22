/**
 * "+ Add column" control for the Table report (spec/012-table-and-grouper, Phase 1).
 *
 * Opens a searchable catalog popover grouped by {@link ColumnGroup} (Common / Identity / Fields /
 * Estimation). Only columns not already shown appear; picking one appends it to the shown columns.
 */
import React, { useMemo, useState } from 'react';
import Popup from '@atlaskit/popup';
import Textfield from '@atlaskit/textfield';

import type { ColumnDefinition, ColumnGroup } from '../model/columns';

interface AddColumnButtonProps {
  catalog: ColumnDefinition[];
  /** Ids of columns already shown (excluded from the catalog). */
  shownColumnIds: string[];
  onAdd: (columnId: string) => void;
}

// `Common` (curated built-in facets) sits at the top, then the identity columns, then the raw Jira
// fields, then computed/estimation.
const GROUP_ORDER: ColumnGroup[] = ['Common', 'Identity', 'Fields', 'Estimation', 'Computed'];

export const AddColumnButton: React.FC<AddColumnButtonProps> = ({ catalog, shownColumnIds, onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const shown = useMemo(() => new Set(shownColumnIds), [shownColumnIds]);

  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const available = catalog.filter(
      (c) => !shown.has(c.id) && (needle === '' || c.label.toLowerCase().includes(needle)),
    );
    return GROUP_ORDER.map((group) => ({
      group,
      columns: available.filter((c) => c.group === group),
    })).filter((section) => section.columns.length > 0);
  }, [catalog, shown, search]);

  return (
    <Popup
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        setSearch('');
      }}
      placement="bottom-start"
      content={() => (
        <div className="p-3 w-72 flex flex-col gap-2" data-testid="table-add-column-popover">
          <Textfield
            testId="table-add-column-search"
            placeholder="Search columns…"
            value={search}
            autoFocus
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
          <div className="max-h-72 overflow-auto flex flex-col gap-2">
            {grouped.length === 0 && <div className="text-neutral-801 text-xs px-1">No columns to add.</div>}
            {grouped.map((section) => (
              <div key={section.group} className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-801 px-1 py-1">{section.group}</span>
                {section.columns.map((column) => (
                  <button
                    key={column.id}
                    type="button"
                    data-testid="table-add-column-option"
                    className="text-left text-sm px-2 py-1 rounded hover:bg-neutral-201"
                    onClick={() => {
                      onAdd(column.id);
                      setSearch('');
                      setIsOpen(false);
                    }}
                  >
                    {column.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          data-testid="table-add-column"
          className="text-sm rounded bg-neutral-201 hover:bg-neutral-301 px-2 py-1 leading-4 cursor-pointer"
          onClick={() => setIsOpen((open) => !open)}
        >
          + Add column
        </button>
      )}
    />
  );
};

export default AddColumnButton;
