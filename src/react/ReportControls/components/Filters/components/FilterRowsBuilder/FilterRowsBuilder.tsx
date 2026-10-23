import React from 'react';
import Select from '@atlaskit/select';
import Button from '@atlaskit/button/new';
import { IconButton } from '@atlaskit/button/new';
import CrossIcon from '@atlaskit/icon/glyph/cross';
import VisuallyHidden from '@atlaskit/visually-hidden';

import type { FilterField, FilterOperator } from '../../../../../../jira/rollup/filter-rows/filter-rows';

export interface FilterFieldDefinition<F extends string = FilterField> {
  field: F;
  label: string;
  operators: FilterOperator[];
  options: { label: string; value: string }[];
}

/** Any `field · operator · value[]` row — `FilterRow` and `SourceFilterRow` both fit. */
export interface FilterRowLike<F extends string = FilterField> {
  id: string;
  field: F;
  operator: FilterOperator;
  value: string[];
}

export interface FilterRowsBuilderProps<F extends string = FilterField> {
  rows: FilterRowLike<F>[];
  onChange: (rows: FilterRowLike<F>[]) => void;
  fieldDefinitions: FilterFieldDefinition<F>[];
  /**
   * `inline` (default) puts Field / Operator / Value / remove on one grid line. `stacked` fits a
   * narrow sidebar: each row is a panel with Field / Operator / remove on top and Value below.
   */
  layout?: 'inline' | 'stacked';
  addLabel?: string;
  showClearAll?: boolean;
}

// Stacked rows sit on a grey panel, where the Select's own input background reads as transparent.
const whiteControlStyles = {
  control: (base: object) => ({
    ...base,
    backgroundColor: 'var(--ds-surface, #FFFFFF)',
    '&:hover': { backgroundColor: 'var(--ds-surface, #FFFFFF)' },
  }),
};

const makeRowId = () => `filter-row-${Math.random().toString(36).slice(2, 9)}`;

const getFieldDefinition = <F extends string>(fieldDefinitions: FilterFieldDefinition<F>[], field: F) =>
  fieldDefinitions.find((def) => def.field === field) ?? fieldDefinitions[0];

/**
 * Generic, Jira-Plans-style filter row builder: one row per entry (Field / Operator / Value
 * multi-select / remove), a "+ Add filter" button, and a "Clear all filters" action. This is a
 * pure, presentation-only component — all matching logic lives in the pure predicate modules
 * (`filter-rows.ts`, `source-filter-rows.ts`); this component only produces/edits rows.
 */
export const FilterRowsBuilder = <F extends string = FilterField>({
  rows,
  onChange,
  fieldDefinitions,
  layout = 'inline',
  addLabel = '+ Add filter',
  showClearAll = true,
}: FilterRowsBuilderProps<F>) => {
  const updateRow = (id: string, updates: Partial<FilterRowLike<F>>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const handleFieldChange = (row: FilterRowLike<F>, newField: F) => {
    const fieldDef = getFieldDefinition(fieldDefinitions, newField);
    updateRow(row.id, { field: newField, operator: fieldDef.operators[0], value: [] });
  };

  const handleRemoveRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const handleAddFilter = () => {
    const firstFieldDef = fieldDefinitions[0];
    onChange([
      ...rows,
      { id: makeRowId(), field: firstFieldDef.field, operator: firstFieldDef.operators[0], value: [] },
    ]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const stacked = layout === 'stacked';
  const selectStyles = stacked ? whiteControlStyles : undefined;

  return (
    <div>
      {showClearAll && (
        <div className="flex justify-end pb-2">
          <button
            type="button"
            className="text-sm font-semibold text-blue-600 hover:underline disabled:text-zinc-400 disabled:no-underline"
            onClick={handleClearAll}
            disabled={rows.length === 0}
          >
            Clear all filters
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const fieldDef = getFieldDefinition(fieldDefinitions, row.field);
          const fieldOptions = fieldDefinitions.map((def) => ({ label: def.label, value: def.field }));
          const operatorOptions = fieldDef.operators.map((operator) => ({ label: operator, value: operator }));
          // Keep a selected value visible even when it isn't among the options (e.g. before issues
          // have loaded, or a status no longer present in the data).
          const selectedValues = row.value.map(
            (value) => fieldDef.options.find((option) => option.value === value) ?? { label: value, value },
          );

          const fieldSelect = (
            <div>
              <VisuallyHidden>
                <label htmlFor={`${row.id}-field`}>Field</label>
              </VisuallyHidden>
              <Select
                styles={selectStyles}
                inputId={`${row.id}-field`}
                options={fieldOptions}
                value={fieldOptions.find((option) => option.value === row.field)}
                onChange={(option) => option && handleFieldChange(row, option.value)}
              />
            </div>
          );
          const operatorSelect = (
            <div>
              <VisuallyHidden>
                <label htmlFor={`${row.id}-operator`}>Operator</label>
              </VisuallyHidden>
              <Select
                styles={selectStyles}
                inputId={`${row.id}-operator`}
                options={operatorOptions}
                value={operatorOptions.find((option) => option.value === row.operator)}
                onChange={(option) => option && updateRow(row.id, { operator: option.value })}
              />
            </div>
          );
          const valueSelect = (
            <div>
              <VisuallyHidden>
                <label htmlFor={`${row.id}-value`}>Value</label>
              </VisuallyHidden>
              <Select
                styles={selectStyles}
                inputId={`${row.id}-value`}
                isMulti
                isSearchable
                options={fieldDef.options}
                value={selectedValues}
                onChange={(options) => updateRow(row.id, { value: (options ?? []).map((option) => option.value) })}
              />
            </div>
          );
          const removeButton = (
            <IconButton
              appearance="subtle"
              icon={CrossIcon}
              label="Remove filter"
              onClick={() => handleRemoveRow(row.id)}
            />
          );

          if (stacked) {
            return (
              <div key={row.id} data-testid="filter-row" className="flex flex-col gap-2 rounded-md bg-neutral-20 p-2">
                <div className="grid grid-cols-[1fr_110px_28px] gap-2 items-start">
                  {fieldSelect}
                  {operatorSelect}
                  {removeButton}
                </div>
                {valueSelect}
              </div>
            );
          }

          return (
            <div
              key={row.id}
              data-testid="filter-row"
              className="grid grid-cols-[160px_110px_1fr_28px] gap-2 items-start"
            >
              {fieldSelect}
              {operatorSelect}
              {valueSelect}
              {removeButton}
            </div>
          );
        })}
      </div>
      <div className="pt-2">
        {stacked ? (
          // Blue text action at regular size, styled like "Clear all filters".
          <button
            type="button"
            className="h-8 px-2 rounded text-sm font-semibold text-blue-600 hover:bg-neutral-20"
            onClick={handleAddFilter}
          >
            {addLabel}
          </button>
        ) : (
          <Button appearance="subtle" spacing="compact" onClick={handleAddFilter}>
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

export default FilterRowsBuilder;
