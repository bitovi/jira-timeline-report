/**
 * "+ Add column" control for the Table report (spec/012-table-and-grouper, Phase 1).
 *
 * Opens a searchable catalog popover grouped by {@link ColumnGroup} (Common / Identity / Fields /
 * Report Fields). Only columns not already shown appear; picking one appends it to the shown columns.
 *
 * The popover itself is {@link SearchablePicker}, shared with Report of Reports' field picker
 * (spec/016-report-of-reports/009-value-report-modal, Phase 1). This file is what remains that is
 * Table-specific: the group order, the copy, the `table-add-column*` test ids, and the trigger.
 *
 * It inherited the two-layout grouped grid for free (spec/031-column-select-redesign). No
 * `shouldRenderToParent` and no `role`/`label`: this toolbar is not inside a dialog, so the popover
 * keeps the portal path exactly as it always had.
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

/**
 * The three groups `buildColumnCatalog` curates in a deliberate order, so the picker must not sort
 * them: `identity` is a hand-written array, `builtin` follows `BUILTIN_CONCEPTS`, and `reportFields`
 * follows `REPORT_FIELD_FACETS` plus the four estimation columns (`buildColumnCatalog.ts:226-271`).
 *
 * `Fields` is left to sort — `useJiraIssueFields` already returns it name-sorted, so this only
 * guarantees it. `Computed` is currently unpopulated.
 */
const UNSORTED_GROUPS: ColumnGroup[] = ['Common', 'Identity', 'Report Fields'];

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
      unsortedGroups={UNSORTED_GROUPS}
      placeholder="Search columns…"
      emptyMessage="No columns to add."
      testIdPrefix="table-add-column"
      // Its own key, so expanding here would not also expand Report of Reports' field picker.
      // **Inert while the expand/collapse toggle is parked** — see `PickerPanel`'s footer comment.
      layoutStorageKey="table-add-column-layout"
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
