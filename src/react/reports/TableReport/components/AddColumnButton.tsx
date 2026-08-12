/**
 * "+ Add column" control for the Table report (spec/012-table-and-grouper, Phase 1).
 *
 * Opens a searchable catalog popover grouped by {@link ColumnGroup} (Common / Identity / Fields /
 * Report Fields). Only columns not already shown appear; picking one appends it to the shown columns.
 *
 * The popover itself is {@link SearchablePicker}, shared with Report of Reports' field picker
 * (spec/016-report-of-reports/009-value-report-modal, Phase 1). This file is what remains that is
 * Table-specific: the group order, the copy, the `table-add-column*` test ids, and the trigger.
 */
import React, { useMemo } from 'react';

import { SearchablePicker, type PickerItem } from '../../../components/SearchablePicker';
import type { ColumnDefinition, ColumnGroup } from '../model/columns';

interface AddColumnButtonProps {
  catalog: ColumnDefinition[];
  /** Ids of columns already shown (excluded from the catalog). */
  shownColumnIds: string[];
  onAdd: (columnId: string) => void;
}

// `Common` (curated built-in facets) sits at the top, then identity, then Report Fields (canonical
// per-issue values plus the estimation parity columns), then the raw Jira fields, then computed.
const GROUP_ORDER: ColumnGroup[] = ['Common', 'Identity', 'Report Fields', 'Fields', 'Computed'];

export const AddColumnButton: React.FC<AddColumnButtonProps> = ({ catalog, shownColumnIds, onAdd }) => {
  const items = useMemo<PickerItem[]>(
    () => catalog.map((column) => ({ id: column.id, label: column.label, group: column.group })),
    [catalog],
  );

  return (
    <SearchablePicker
      items={items}
      groupOrder={GROUP_ORDER}
      excludeIds={shownColumnIds}
      placeholder="Search columns…"
      emptyMessage="No columns to add."
      testIdPrefix="table-add-column"
      onSelect={onAdd}
      trigger={(triggerProps, toggle) => (
        <button
          {...triggerProps}
          type="button"
          data-testid="table-add-column"
          className="inline-flex items-center h-8 text-sm rounded bg-neutral-201 hover:bg-neutral-301 px-2 leading-4 cursor-pointer"
          onClick={toggle}
        >
          + Add column
        </button>
      )}
    />
  );
};

export default AddColumnButton;
