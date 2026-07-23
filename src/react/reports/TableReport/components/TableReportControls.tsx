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
import { Label } from '@atlaskit/form';
import DropdownMenu, { DropdownItem, DropdownItemCheckbox, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import ChevronRightIcon from '@atlaskit/icon/utility/chevron-right';

import { useRouteData } from '../../../hooks/useRouteData';
import { useJiraIssueFields } from '../../../services/jira/useJiraIssueFields';
import { buildColumnCatalog } from '../model/buildColumnCatalog';
import { addColumn } from '../model/applyView';
import { DATE_GRANULARITIES, DATE_GRANULARITY_LABELS } from '../model/dateBucketing';
import { selectMeasureColumns } from '../model/grouping';
import { effectiveMeasures } from '../model/crosstab';
import { buildColumnEntries, entriesToAggregationOverrides, entriesToColumnIds } from '../model/persistence';
import { AddColumnButton } from './AddColumnButton';
import SelectHierarchyRange from './SelectHierarchyRange';

import type { IssueFields } from '../model/buildColumnCatalog';
import type { ColumnDefinition } from '../model/columns';
import type { DateGranularity } from '../model/dateBucketing';
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

/**
 * One Group by / then-→ option: a plain item for non-date columns, or (for date-typed columns) a
 * nested submenu offering Day/Week/Month/Quarter/Year granularities (spec/012-table-and-grouper/
 * date-bucket-grouping.md). Module-level (not defined inside `TableReportControlsInner`) so its
 * identity is stable across renders — an inline component would remount on every keystroke/render,
 * closing any open submenu.
 */
const GroupOption: FC<{
  column: ColumnDefinition;
  testId: string;
  isSelected: boolean;
  selectedGranularity: string;
  onSelect: (granularity: DateGranularity | '') => void;
}> = ({ column, testId, isSelected, selectedGranularity, onSelect }) => {
  if (column.filter?.kind !== 'date') {
    return (
      <DropdownItem testId={testId} isSelected={isSelected} onClick={() => onSelect('')}>
        {column.label}
      </DropdownItem>
    );
  }
  const effectiveGranularity = (DATE_GRANULARITIES as string[]).includes(selectedGranularity)
    ? (selectedGranularity as DateGranularity)
    : 'day';
  return (
    <DropdownMenu
      placement="right-start"
      trigger={({ triggerRef, ...props }) => (
        <DropdownItem
          ref={triggerRef}
          isSelected={isSelected}
          elemAfter={<ChevronRightIcon label="choose granularity" />}
          {...props}
        >
          {column.label}
        </DropdownItem>
      )}
    >
      <DropdownItemGroup>
        {DATE_GRANULARITIES.map((g) => (
          <DropdownItem
            key={g}
            testId={`${testId}-${g}`}
            isSelected={isSelected && effectiveGranularity === g}
            onClick={() => onSelect(g)}
          >
            {DATE_GRANULARITY_LABELS[g]}
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
  const [groupByGranularity = '', setGroupByGranularity] = useRouteData<string>('tableGroupByGranularity');
  const [groupByColGranularity = '', setGroupByColGranularity] = useRouteData<string>('tableGroupByColGranularity');
  const [fieldAxis = 'rows', setFieldAxis] = useRouteData<string>('tableFieldAxis');
  const [showRowTotals = false, setShowRowTotals] = useRouteData<boolean>('tableShowRowTotals');
  const [showColTotals = false, setShowColTotals] = useRouteData<boolean>('tableShowColTotals');
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

  // How many measures the 2D cross-tab would actually render (mirrors TableReport.tsx's
  // `crossTabMeasures`), so the Fields dropdown only offers "Hidden" when there's a single measure —
  // hiding the "Field" column only makes sense when there's nothing left to distinguish per row.
  const crossTabMeasureCount = useMemo(() => {
    if (!is2D) return 0;
    const rowColumn = catalogById.get(groupBy) ?? null;
    const colColumn = catalogById.get(groupByCol) ?? null;
    if (!rowColumn || !colColumn) return 0;
    const measures = selectMeasureColumns(groupableColumns, rowColumn, colColumn);
    const excluded = new Set([rowColumn.id, colColumn.id]);
    const identityFallback = groupableColumns.filter((c) => c.isIdentity && !excluded.has(c.id));
    return effectiveMeasures(measures, identityFallback).length;
  }, [is2D, groupableColumns, catalogById, groupBy, groupByCol]);

  // Row ordering is a property of the tree column's sort (design/tree-column-brainstorm §3): there is
  // no global Rows control. Grouping and hierarchy stay mutually exclusive — selecting a group clears
  // any active tree (Hierarchy) sort so the report flattens under the group.
  const clearTreeSort = () => {
    if (sortDir === 'tree') {
      setSortColumn('');
      setSortDir('asc');
    }
  };

  // `granularity` is only meaningful for date-typed group columns (spec/012-table-and-grouper/
  // date-bucket-grouping.md); non-date columns always clear it so a stale granularity from a
  // previously-grouped date column never leaks onto the next selection.
  const handleSelectGroup = (value: string, granularity: DateGranularity | '' = '') => {
    setGroupBy(value);
    setGroupByGranularity(granularity);
    if (value) clearTreeSort();
    // Clearing the first group also drops the 2D column dimension (progressive disclosure).
    else setGroupByCol('');
  };

  const handleSelectGroupCol = (value: string, granularity: DateGranularity | '' = '') => {
    setGroupByCol(value);
    setGroupByColGranularity(granularity);
    if (value) clearTreeSort();
  };

  const handleAddColumn = (id: string) => {
    const overrides = entriesToAggregationOverrides(columns);
    // Adding a field column to `tableColumns` is enough to trigger a re-fetch of that field's data:
    // route-data's `allFieldsToRequest` derives the request field list from `tableColumns` itself
    // (issues-plan.md #2), so `tableColumns` stays the single source of truth — no parallel `fields`
    // write, and removing a column prunes its field automatically.
    setColumns(buildColumnEntries(addColumn(columnIds, id), overrides, columns));
  };

  // A date-typed group column's trigger label includes its granularity (e.g. "Due Date (Month)"),
  // defaulting an unset granularity to Day (matches the TableReport.tsx runtime default).
  const groupLabel = (id: string, granularity: string) => {
    const column = catalogById.get(id);
    if (!column) return 'None';
    if (column.filter?.kind !== 'date') return column.label;
    const g = (DATE_GRANULARITIES as string[]).includes(granularity) ? (granularity as DateGranularity) : 'day';
    return `${column.label} (${DATE_GRANULARITY_LABELS[g]})`;
  };

  // Control groups get extra breathing room between them (`ml-4`); Group by + then stay close
  // together (default `gap-1`) since they're a single row/column grouping pair.
  return (
    <>
      <div className="ml-4">
        <SelectHierarchyRange />
      </div>

      <div className="ml-4 flex gap-1">
        <ControlCell label="Group by ↓">
          <DropdownMenu testId="table-group-by" trigger={isGrouped ? groupLabel(groupBy, groupByGranularity) : 'None'}>
            <DropdownItemGroup>
              <DropdownItem testId="table-group-by-option" onClick={() => handleSelectGroup('')}>
                None
              </DropdownItem>
              {groupableColumns.map((c) => (
                <GroupOption
                  key={c.id}
                  column={c}
                  testId="table-group-by-option"
                  isSelected={groupBy === c.id}
                  selectedGranularity={groupByGranularity}
                  onSelect={(granularity) => handleSelectGroup(c.id, granularity)}
                />
              ))}
            </DropdownItemGroup>
          </DropdownMenu>
        </ControlCell>

        {/* Progressive disclosure: the column-dimension (2D) selector appears only once a first
            group field is chosen. */}
        {isGrouped && (
          <ControlCell label="then →">
            <DropdownMenu
              testId="table-group-by-col"
              trigger={groupByCol ? groupLabel(groupByCol, groupByColGranularity) : 'None'}
            >
              <DropdownItemGroup>
                <DropdownItem testId="table-group-by-col-option" onClick={() => handleSelectGroupCol('')}>
                  None
                </DropdownItem>
                {groupableColumns
                  .filter((c) => c.id !== groupBy)
                  .map((c) => (
                    <GroupOption
                      key={c.id}
                      column={c}
                      testId="table-group-by-col-option"
                      isSelected={groupByCol === c.id}
                      selectedGranularity={groupByColGranularity}
                      onSelect={(granularity) => handleSelectGroupCol(c.id, granularity)}
                    />
                  ))}
              </DropdownItemGroup>
            </DropdownMenu>
          </ControlCell>
        )}
      </div>

      {is2D && (
        <div className="ml-4">
          <ControlCell label="Fields">
            <SingleSelectDropdown
              testId="table-field-axis"
              value={fieldAxis}
              options={[
                { value: 'rows', label: '↓ Down rows' },
                { value: 'cols', label: '→ Across cols' },
                // Only offered with a single measure — with more than one there's no way to tell
                // which row/cell belongs to which field once the "Field" column is gone.
                ...(crossTabMeasureCount <= 1 ? [{ value: 'hidden', label: 'Hidden' }] : []),
              ]}
              onChange={setFieldAxis}
            />
          </ControlCell>
        </div>
      )}

      {/* Totals visibility: two INDEPENDENT toggles (not a single-select), so a checkbox-style
          DropdownItemCheckbox is used instead of the SingleSelectDropdown radio pattern above. Both
          default off — totals used to always render; this makes them opt-in per axis. The trigger
          label reflects the current combination (unlike the static "Filter Results"/"View settings"
          triggers elsewhere) so the control's state is visible without opening the menu. */}
      {is2D && (
        <div className="ml-4">
          <ControlCell label="Totals">
            <DropdownMenu
              testId="table-totals"
              trigger={
                showRowTotals && showColTotals ? 'Both' : showRowTotals ? 'Rows' : showColTotals ? 'Columns' : 'None'
              }
            >
              <DropdownItemGroup>
                <DropdownItemCheckbox
                  testId="table-totals-row"
                  id="table-totals-row"
                  isSelected={showRowTotals}
                  onClick={() => setShowRowTotals(!showRowTotals)}
                >
                  Row totals
                </DropdownItemCheckbox>
                <DropdownItemCheckbox
                  testId="table-totals-col"
                  id="table-totals-col"
                  isSelected={showColTotals}
                  onClick={() => setShowColTotals(!showColTotals)}
                >
                  Column totals
                </DropdownItemCheckbox>
              </DropdownItemGroup>
            </DropdownMenu>
          </ControlCell>
        </div>
      )}

      {/* Non-breaking-space label reserves the same header row height as the other cells, so the
          button top-aligns with them instead of sitting lower (there's no real caption to show). */}
      <div className="ml-4">
        <ControlCell label={'\u00A0'}>
          <AddColumnButton catalog={catalog} shownColumnIds={columnIds} onAdd={handleAddColumn} />
        </ControlCell>
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
