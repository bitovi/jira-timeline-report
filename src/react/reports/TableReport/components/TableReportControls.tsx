/**
 * The Table report's PRIMARY control bar (spec/012-table-and-grouper, §"Control placement").
 *
 * Rendered in the shared `ReportControls` `table2` branch, in the SAME horizontal row as
 * <SelectReportType />. These controls read/write the SAME route-data keys the report body reads
 * (via {@link useRouteData}), so the body and controls stay in sync automatically — the body
 * subscribes to the same observables through `useCanObservable`.
 *
 * Built entirely with @atlaskit components to match the other report controls. To keep the shared
 * row visually uniform (every native control — Report type, Report on, Filters, View settings — is a
 * gray DropdownMenu trigger), EVERY Table control here is also a DropdownMenu: Rows, Group by, column
 * dimension, and Fields are all single-select dropdowns; each caption uses the @atlaskit/form Label.
 *
 * {@link useJiraIssueFields} suspends, so the export wraps the inner component in a Suspense
 * boundary rendering a lightweight loading state (mirroring SelectIssueType's `isLoading`).
 */
import React, { FC, ReactNode, Suspense, useMemo } from 'react';
import Button from '@atlaskit/button/new';
import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';

import { useRouteData } from '../../../hooks/useRouteData';
import { useJiraIssueFields } from '../../../services/jira/useJiraIssueFields';
import { buildColumnCatalog } from '../model/buildColumnCatalog';
import { addColumn } from '../model/applyView';
import {
  buildColumnEntries,
  entriesToAggregationOverrides,
  entriesToColumnIds,
} from '../model/persistence';
import { AddColumnButton } from './AddColumnButton';
import SelectHierarchyRange from './SelectHierarchyRange';

import type { IssueFields } from '../model/buildColumnCatalog';
import type { ColumnDefinition } from '../model/columns';
import type { TableColumnEntry } from '../model/persistence';

/** Wrap a control so it aligns in the shared control row, matching the flow-metrics/SelectIssueType cells. */
const ControlCell: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="pt-1 flex flex-col items-start">
    <Label htmlFor="">{label}</Label>
    {children}
  </div>
);

/**
 * A single-select dropdown styled like the other row controls (Report type / Report on): a gray
 * trigger showing the current option's label, opening a menu of options. Used for Rows and Fields so
 * the whole control row is uniform DropdownMenu triggers rather than a mix of styles.
 */
const SingleSelectDropdown: FC<{
  testId: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}> = ({ testId, options, value, onChange }) => {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu testId={testId} trigger={current?.label ?? ''}>
      <DropdownItemGroup>
        {options.map((option) => (
          <DropdownItem
            key={option.value}
            testId={`${testId}-${option.value}`}
            isSelected={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </DropdownItem>
        ))}
      </DropdownItemGroup>
    </DropdownMenu>
  );
};

const TableReportControlsInner: FC = () => {
  const [columns = [], setColumns] = useRouteData<TableColumnEntry[]>('tableColumns');
  const [groupBy = '', setGroupBy] = useRouteData<string>('tableGroupBy');
  const [groupByCol = '', setGroupByCol] = useRouteData<string>('tableGroupByCol');
  const [fieldAxis = 'rows', setFieldAxis] = useRouteData<string>('tableFieldAxis');
  const [, setSortColumn] = useRouteData<string>('tableSortColumn');
  const [sortDir = 'asc', setSortDir] = useRouteData<string>('tableSortDir');

  const fields = useJiraIssueFields() as IssueFields;
  const catalog = useMemo(() => buildColumnCatalog(fields), [fields]);
  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  const columnIds = useMemo(() => entriesToColumnIds(columns), [columns]);

  // Group/dimension options are ALL the columns the user has ADDED, not the whole catalog
  // (issues.md — "Group By should show all fields being shown to the user"). Identity columns
  // (Issue Type, Key, Summary) are included too: grouping by e.g. Issue Type is meaningful, and the
  // grouped column becomes the group label in the report body. Preserves the added order.
  const groupableColumns = useMemo(
    () => columnIds.map((id) => catalogById.get(id)).filter((c): c is ColumnDefinition => !!c),
    [columnIds, catalogById],
  );
  const isGrouped = groupBy !== '';
  const is2D = groupBy !== '' && groupByCol !== '';

  // Row ordering is a property of the tree column's sort (design/tree-column-brainstorm §3): there is
  // no global Rows control. Grouping and hierarchy stay mutually exclusive — selecting a group clears
  // any active tree (Hierarchy) sort so the report flattens under the group.
  const clearTreeSort = () => {
    if (sortDir === 'tree') {
      setSortColumn('');
      setSortDir('asc');
    }
  };

  const handleSelectGroup = (value: string) => {
    setGroupBy(value);
    if (value) clearTreeSort();
    // Clearing the first group also drops the 2D column dimension (progressive disclosure).
    else setGroupByCol('');
  };

  const handleSelectGroupCol = (value: string) => {
    setGroupByCol(value);
    if (value) clearTreeSort();
  };

  // ⇄ swap exchanges which field is down the rows vs across the columns.
  const swapAxes = () => {
    setGroupBy(groupByCol);
    setGroupByCol(groupBy);
  };

  const handleAddColumn = (id: string) => {
    const overrides = entriesToAggregationOverrides(columns);
    // Adding a field column to `tableColumns` is enough to trigger a re-fetch of that field's data:
    // route-data's `allFieldsToRequest` derives the request field list from `tableColumns` itself
    // (issues-plan.md #2), so `tableColumns` stays the single source of truth — no parallel `fields`
    // write, and removing a column prunes its field automatically.
    setColumns(buildColumnEntries(addColumn(columnIds, id), overrides, columns));
  };

  const groupLabel = (id: string) => catalogById.get(id)?.label ?? 'None';

  return (
    <>
      <SelectHierarchyRange />

      <ControlCell label="Group by ↓">
        <DropdownMenu testId="table-group-by" trigger={isGrouped ? groupLabel(groupBy) : 'None'}>
          <DropdownItemGroup>
            <DropdownItem testId="table-group-by-option" onClick={() => handleSelectGroup('')}>
              None
            </DropdownItem>
            {groupableColumns.map((c) => (
              <DropdownItem key={c.id} testId="table-group-by-option" onClick={() => handleSelectGroup(c.id)}>
                {c.label}
              </DropdownItem>
            ))}
          </DropdownItemGroup>
        </DropdownMenu>
      </ControlCell>

      {/* Progressive disclosure: the swap + column-dimension (2D) selector appear only once a first
          group field is chosen. */}
      {isGrouped && (
        <>
          <div className="pt-1 self-end pb-1">
            <Button
              testId="table-swap-axes"
              spacing="compact"
              // The swap only makes sense once a second (column) dimension exists.
              isDisabled={groupByCol === ''}
              aria-label="Swap row and column grouping"
              onClick={swapAxes}
            >
              ⇄
            </Button>
          </div>

          <ControlCell label="then →">
            <DropdownMenu testId="table-group-by-col" trigger={groupByCol ? groupLabel(groupByCol) : 'None'}>
              <DropdownItemGroup>
                <DropdownItem testId="table-group-by-col-option" onClick={() => handleSelectGroupCol('')}>
                  None
                </DropdownItem>
                {groupableColumns
                  .filter((c) => c.id !== groupBy)
                  .map((c) => (
                    <DropdownItem key={c.id} testId="table-group-by-col-option" onClick={() => handleSelectGroupCol(c.id)}>
                      {c.label}
                    </DropdownItem>
                  ))}
              </DropdownItemGroup>
            </DropdownMenu>
          </ControlCell>
        </>
      )}

      {is2D && (
        <ControlCell label="Fields">
          <SingleSelectDropdown
            testId="table-field-axis"
            value={fieldAxis}
            options={[
              { value: 'rows', label: '↓ Down rows' },
              { value: 'cols', label: '→ Across cols' },
            ]}
            onChange={setFieldAxis}
          />
        </ControlCell>
      )}

      <div className="pt-1 self-end pb-1">
        <AddColumnButton catalog={catalog} shownColumnIds={columnIds} onAdd={handleAddColumn} />
      </div>
    </>
  );
};

/** Loading state shown while {@link useJiraIssueFields} resolves (mirrors SelectIssueType's isLoading). */
const TableReportControlsFallback: FC = () => (
  <div className="pt-1 flex flex-col items-start" data-testid="table-controls-loading">
    <Label htmlFor="">Rows</Label>
    <DropdownMenu trigger="Loading..." isLoading />
  </div>
);

export const TableReportControls: FC = () => (
  <Suspense fallback={<TableReportControlsFallback />}>
    <TableReportControlsInner />
  </Suspense>
);

export default TableReportControls;
